import type { CheckReport, LinkObservation } from './types'
import type { ReportSiteOptions } from './viewer/html'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { parseReport } from './schema'
import { createReportHtml } from './viewer/html'

function escapeCell(value: string | number) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '&#124;').replaceAll('[', '&#91;').replaceAll(']', '&#93;').replaceAll('`', '&#96;').replace(/[\r\n]+/g, ' ')
}

function urlLink(url: string) {
  const destination = url.replace(/[<>|\s]/g, character => encodeURIComponent(character))
  return `[${escapeCell(url)}](<${destination}>)`
}

function table(results: LinkObservation[]) {
  return [
    '| Name | URL | Status | HTTP | Detail / final URL | Failed runs | Last success |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...results.map(result => `| ${escapeCell(result.name ?? '')} | ${urlLink(result.url)} | ${result.status} | ${result.httpStatus ?? '—'} | ${escapeCell(result.detail ?? (result.finalUrl !== result.url ? result.finalUrl : ''))} | ${result.consecutiveFailures} | ${result.lastSuccessAt ?? '—'} |`),
  ].join('\n')
}

export function formatReport(report: CheckReport, format: 'json' | 'markdown' | 'html' = 'markdown'): string {
  if (format === 'html')
    return createReportHtml(report)
  if (format === 'json')
    return `${JSON.stringify(report, null, 2)}\n`
  const { summary } = report
  const review = report.results.filter(item => item.status !== 'reachable' || item.redirects.length > 0)
  return [
    '# Link availability report',
    '',
    `Observer: ${escapeCell(report.observer)} · Completed: ${report.completedAt}`,
    '',
    `Total: **${summary.total}** · Reachable: **${summary.reachable}** · Restricted: **${summary.restricted}** · Unavailable: **${summary.unavailable}** · Redirected: **${summary.redirected}** · Recovered: **${summary.recovered}**`,
    '',
    '> Results describe HTTP access from this observer at the recorded time. Restricted access is inconclusive. Failed runs are separate observations, not proof of continuous downtime. A successful response does not verify page content.',
    '',
    '## Needs review',
    '',
    review.length ? table(review) : 'No links need review.',
    '',
    '## All results',
    '',
    table(report.results),
    '',
  ].join('\n')
}

export async function writeReports(report: CheckReport, directory: string): Promise<{ json: string, markdown: string, html: string }> {
  await mkdir(directory, { recursive: true })
  const paths = { json: join(directory, 'report.json'), markdown: join(directory, 'report.md'), html: join(directory, 'report.html') }
  await writeFile(paths.json, formatReport(report, 'json'))
  await writeFile(paths.markdown, formatReport(report, 'markdown'))
  await writeFile(paths.html, formatReport(report, 'html'))
  return paths
}

/** Export a portable static site. Hosting refreshes the sidecar; file:// uses the embedded snapshot. */
export async function writeReportSite(report: CheckReport | undefined, directory: string, options: ReportSiteOptions = {}): Promise<{ index: string, json?: string }> {
  const html = createReportHtml(report, { dataUrl: report ? './report.json' : undefined, ...options })
  await mkdir(directory, { recursive: true })
  const index = join(directory, 'index.html')
  const json = report ? join(directory, 'report.json') : undefined
  if (json)
    await writeFile(json, formatReport(report!, 'json'))
  await writeFile(index, html)
  return { index, json }
}

/** A missing file starts history; malformed or incompatible history is an error. */
export async function readReport(path: string): Promise<CheckReport | undefined> {
  let data: unknown
  try {
    data = JSON.parse(await readFile(path, 'utf8'))
  }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
      return undefined
    throw error
  }
  return parseReport(data)
}

/** Write history only after a completed run; replace it atomically. */
export async function saveReport(report: CheckReport, path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  await writeFile(temporary, formatReport(report, 'json'))
  await rename(temporary, path)
}
