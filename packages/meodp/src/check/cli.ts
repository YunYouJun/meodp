import type { CheckOptions } from './types'
import { readFile } from 'node:fs/promises'
import { hostname } from 'node:os'
import { extname, resolve } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { load } from 'js-yaml'
import { loadProjectConfig } from '../config/load'
import { checkLinks } from './check'
import { normalizeTargets } from './input'
import { readReport, saveReport, writeReports, writeReportSite } from './report'
import { checkSitemap } from './sitemap'
import { waitForReport } from './verify'

const help = `Usage: meodp check <links.json|links.yml> [options]

Check only the listed HTTP(S) URLs, with no browser or recursive resource scan.
Input: an array of URL strings or objects with url and optional name.
This makes network requests. To render saved data instead, use meodp report.

  --config <file>      Load a project config (default: meodp.config.ts)
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
        'config': { type: 'string' },
        'output': { type: 'string' },
        'history': { type: 'string' },
        'observer': { type: 'string' },
        'concurrency': { type: 'string' },
        'timeout': { type: 'string' },
        'retries': { type: 'string' },
        'max-redirects': { type: 'string' },
        'fail-on': { type: 'string' },
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

${help.slice(help.indexOf('  --config'))}`)
      return 0
    }
    const project = await loadProjectConfig(values.config)
    const configured = (mode === 'links' ? project.config.check : project.config.sitemap) ?? {}
    const input = positionals[0] ?? (configured.input ? (mode === 'links' ? project.path(configured.input) : configured.input) : undefined)
    if (!input || positionals.length > 1)
      throw new Error(`Provide exactly one ${mode === 'links' ? 'JSON or YAML input file' : 'HTTP(S) URL'}. Use --help for examples.`)
    const failOn = values['fail-on'] ?? configured.failOn ?? 'unavailable'
    if (!['none', 'unavailable', 'review'].includes(failOn))
      throw new Error('--fail-on must be none, unavailable, or review')
    const numeric = (value: string | boolean | undefined) => typeof value === 'string' ? Number(value) : undefined
    const history = values.history ?? (configured.history ? project.path(configured.history) : undefined)
    let previousReport = history ? await readReport(history) : undefined
    if (!previousReport && configured.historySeed)
      previousReport = await readReport(project.path(configured.historySeed))
    const observer = values.observer ?? configured.observer
    // Explicit project policy permits a new network baseline; the core stays strict.
    if (previousReport && configured.observerMismatch === 'reset' && previousReport.observer !== (observer ?? hostname()))
      previousReport = undefined
    const options: CheckOptions = {
      observer,
      previousReport,
      concurrency: numeric(values.concurrency) ?? configured.concurrency,
      timeoutMs: numeric(values.timeout) ?? configured.timeoutMs,
      retries: numeric(values.retries) ?? configured.retries,
      maxRedirects: numeric(values['max-redirects']) ?? configured.maxRedirects,
      onResult(result) {
        console.log(`[${result.status}] ${result.httpStatus ?? result.reason} ${result.url}`)
      },
    }
    const report = mode === 'sitemap'
      ? await checkSitemap(input, {
        ...options,
        discover: values.discover === undefined ? configured.discover : values.discover === true,
        maxUrls: numeric(values['max-urls']) ?? configured.maxUrls,
        maxSitemaps: numeric(values['max-sitemaps']) ?? configured.maxSitemaps,
        maxSitemapBytes: numeric(values['max-sitemap-bytes']) ?? configured.maxSitemapBytes,
      })
      : await checkLinks(await readTargets(input), options)
    const paths = await writeReports(report, values.output ?? (configured.output ? project.path(configured.output) : 'reports/meodp'))
    if (configured.site)
      await writeReportSite(report, project.path(configured.site))
    if (history)
      await saveReport(report, history)
    console.log(`${report.summary.total} URLs: ${report.summary.reachable} reachable, ${report.summary.restricted} restricted, ${report.summary.unavailable} unavailable`)
    console.log(`Interactive report: ${resolve(paths.html)}`)
    console.log(`Reports: ${resolve(paths.markdown)} and ${resolve(paths.json)}`)
    if (failOn === 'none')
      return 0
    const findings = report.summary.unavailable > 0
      || (failOn === 'review' && (report.summary.restricted > 0 || report.summary.redirected > 0))
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
        'config': { type: 'string' },
        'verify': { type: 'boolean' },
        'output': { type: 'string' },
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
--config loads a project config; CLI arguments override config values.
--verify waits for report.verify.url to serve this report and the matching viewer.
--data-url overrides the data source loaded by the hosted viewer (cross-origin needs CORS).
-h, --help shows this help. To collect fresh observations, use meodp check.
Exit codes: 0 = exported; 2 = invalid input or execution error.`)
      return 0
    }
    if (positionals.length > 1)
      throw new Error('Provide at most one report.json file. Use --help for examples.')
    const project = await loadProjectConfig(values.config)
    const configured = project.config.report ?? {}
    const input = positionals[0] ?? (configured.input ? project.path(configured.input) : undefined)
    const report = input ? await readReport(input) : undefined
    if (input && !report)
      throw new Error(`Report not found: ${input}`)
    if (values.verify) {
      if (!report || !configured.verify)
        throw new Error('Verification requires a saved report and report.verify.url in the config.')
      await waitForReport(report, configured.verify)
      console.log('The public status page is serving the expected report.')
      return 0
    }
    const paths = await writeReportSite(report, values.output ?? (configured.output ? project.path(configured.output) : 'reports/site'), { dataUrl: values['data-url'] ?? configured.dataUrl })
    console.log(`Static report site: ${resolve(paths.index)}`)
    return 0
  }
  catch (error) {
    console.error(`meodp report: ${error instanceof Error ? error.message : String(error)}`)
    return 2
  }
}
