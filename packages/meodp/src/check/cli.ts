import type { CheckOptions } from './types'
import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { load } from 'js-yaml'
import { checkLinks } from './check'
import { normalizeTargets } from './input'
import { readReport, saveReport, writeReports, writeReportSite } from './report'
import { checkSitemap } from './sitemap'

const help = `Usage: meodp check <links.json|links.yml> [options]

Check only the listed HTTP(S) URLs, with no browser or recursive resource scan.
Input: an array of URL strings or objects with url and optional name.
This makes network requests. To render saved data instead, use meodp report.

  --output <directory>  Write report.json, report.md, report.html (default: reports/meodp)
  --history <file>      Read previous observations and save the completed report
  --observer <name>     Identify this network/environment (default: hostname)
  --concurrency <n>     Concurrent sites (default: 5)
  --timeout <ms>        Timeout per HTTP request (default: 10000)
  --retries <n>         Retries for transport/5xx failures (default: 1)
  --max-redirects <n>   Follow at most n redirects (default: 5)
  --fail-on <policy>    unavailable (default), review, or none
  -h, --help           Show this help

Exit codes: 0 = policy passed; 1 = findings match --fail-on; 2 = input/execution error.
Restricted results and redirects require review; they do not prove a dead site.
`

export async function runCheckCli(args = process.argv.slice(3)): Promise<number> {
  return runScanCli('links', args)
}

export async function runSitemapCli(args = process.argv.slice(3)): Promise<number> {
  return runScanCli('sitemap', args)
}

async function runScanCli(mode: 'links' | 'sitemap', args: string[]): Promise<number> {
  try {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        'output': { type: 'string', default: 'reports/meodp' },
        'history': { type: 'string' },
        'observer': { type: 'string' },
        'concurrency': { type: 'string' },
        'timeout': { type: 'string' },
        'retries': { type: 'string' },
        'max-redirects': { type: 'string' },
        'fail-on': { type: 'string', default: 'unavailable' },
        'help': { type: 'boolean', short: 'h' },
        ...(mode === 'sitemap'
          ? {
              'discover': { type: 'boolean' as const },
              'max-urls': { type: 'string' as const },
              'max-sitemaps': { type: 'string' as const },
              'max-sitemap-bytes': { type: 'string' as const },
            }
          : {}),
      },
    })
    if (values.help) {
      console.log(mode === 'links'
        ? help
        : `Usage: meodp sitemap <sitemap-url> [options]

Read an XML sitemap or nested index, then check each listed page via HTTP.
  --discover            Treat the URL as a site: read robots.txt or /sitemap.xml
  --max-urls <n>         Reject discovery above n unique pages (default: 10000)
  --max-sitemaps <n>     Limit sitemap documents (default: 100)
  --max-sitemap-bytes <n> Limit each downloaded/decompressed document (default: 10485760)

${help.slice(help.indexOf('  --output'))}`)
      return 0
    }
    if (positionals.length !== 1)
      throw new Error(`Provide exactly one ${mode === 'links' ? 'JSON or YAML input file' : 'HTTP(S) URL'}. Use --help for examples.`)
    if (!['none', 'unavailable', 'review'].includes(values['fail-on']))
      throw new Error('--fail-on must be none, unavailable, or review')
    const numeric = (value: string | boolean | undefined) => typeof value === 'string' ? Number(value) : undefined
    const options: CheckOptions = {
      observer: values.observer,
      previousReport: values.history ? await readReport(values.history) : undefined,
      concurrency: numeric(values.concurrency),
      timeoutMs: numeric(values.timeout),
      retries: numeric(values.retries),
      maxRedirects: numeric(values['max-redirects']),
      onResult(result) {
        console.log(`[${result.status}] ${result.httpStatus ?? result.reason} ${result.url}`)
      },
    }
    const input = positionals[0]
    const report = mode === 'sitemap'
      ? await checkSitemap(input, {
        ...options,
        discover: values.discover === true,
        maxUrls: numeric(values['max-urls']),
        maxSitemaps: numeric(values['max-sitemaps']),
        maxSitemapBytes: numeric(values['max-sitemap-bytes']),
      })
      : await checkLinks(await readTargets(input), options)
    const paths = await writeReports(report, values.output)
    if (values.history)
      await saveReport(report, values.history)
    console.log(`${report.summary.total} URLs: ${report.summary.reachable} reachable, ${report.summary.restricted} restricted, ${report.summary.unavailable} unavailable`)
    console.log(`Interactive report: ${resolve(paths.html)}`)
    console.log(`Reports: ${resolve(paths.markdown)} and ${resolve(paths.json)}`)
    if (values['fail-on'] === 'none')
      return 0
    const findings = report.summary.unavailable > 0
      || (values['fail-on'] === 'review' && (report.summary.restricted > 0 || report.summary.redirected > 0))
    return findings ? 1 : 0
  }
  catch (error) {
    console.error(`meodp ${mode === 'links' ? 'check' : 'sitemap'}: ${error instanceof Error ? error.message : String(error)}`)
    return 2
  }
}

async function readTargets(input: string) {
  const extension = extname(input).toLowerCase()
  if (!['.json', '.yml', '.yaml'].includes(extension))
    throw new Error('Input file must use .json, .yml, or .yaml')
  const source = await readFile(input, 'utf8')
  return normalizeTargets(extension === '.json' ? JSON.parse(source) : load(source))
}

export async function runReportCli(args = process.argv.slice(3)): Promise<number> {
  try {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        'output': { type: 'string', default: 'reports/site' },
        'data-url': { type: 'string' },
        'help': { type: 'boolean', short: 'h' },
      },
    })
    if (values.help) {
      console.log(`Usage: meodp report [report.json] [--output reports/site] [--data-url ./report.json]

Export a static interactive viewer without making any site-check requests.
With an input report, write index.html and report.json. The hosted viewer loads
report.json on each visit; opening index.html as a local file uses its embedded snapshot.
Without input, export an empty viewer supporting file upload and JSON URL loading.
--data-url overrides the data source loaded by the hosted viewer (cross-origin needs CORS).
-h, --help shows this help. To collect fresh observations, use meodp check.
Exit codes: 0 = exported; 2 = invalid input or execution error.`)
      return 0
    }
    if (positionals.length > 1)
      throw new Error('Provide at most one report.json file. Use --help for examples.')
    const report = positionals[0] ? await readReport(positionals[0]) : undefined
    if (positionals[0] && !report)
      throw new Error(`Report not found: ${positionals[0]}`)
    const paths = await writeReportSite(report, values.output, values['data-url'] ? { dataUrl: values['data-url'] } : {})
    console.log(`Static report site: ${resolve(paths.index)}`)
    return 0
  }
  catch (error) {
    console.error(`meodp report: ${error instanceof Error ? error.message : String(error)}`)
    return 2
  }
}
