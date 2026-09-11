import type { CheckReport } from './types'
import type { ReportSiteOptions } from './viewer/html'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { formatReport } from './report'
import { parseReport } from './schema'
import { createReportHtml } from './viewer/html'

export type ReporterName = 'json' | 'markdown' | 'html'

export type HtmlReporterOptions = ReportSiteOptions & (
  | { outputFolder?: string, outputFile?: never }
  | { outputFile: string, outputFolder?: never }
)

export type ReporterDescription
  = ReporterName
  | readonly ['json' | 'markdown', { outputFile?: string }?]
  | readonly ['html', HtmlReporterOptions?]

/** A name, a list of names, or a list of [name, options] tuples. */
export type ReporterConfig = ReporterName | readonly ReporterDescription[]

export interface ReporterOutput {
  reporter: ReporterName
  files: string[]
}

export interface ReporterOptions extends ReportSiteOptions {
  /** Default directory for reporters without explicit output paths. */
  outputDir?: string
  /** Resolve relative output paths from this directory (default: working directory). */
  cwd?: string
}

interface PlannedReporter {
  reporter: ReporterName
  file: string
  json?: string
  dataUrl?: string
}

/** Validate and resolve every output before scanning or writing any files. */
export function planReporters(config: ReporterConfig, options: ReporterOptions = {}): PlannedReporter[] {
  const entries = typeof config === 'string' ? [config] : config
  if (!Array.isArray(entries))
    throw new TypeError('reporter must be a name or an array of names / [name, options] tuples.')
  const cwd = options.cwd ?? process.cwd()
  const output = resolve(cwd, options.outputDir ?? 'reports/meodp')
  const path = (value: unknown) => {
    if (typeof value !== 'string' || !value.trim() || value.includes('\0'))
      throw new TypeError('Reporter output paths must be nonempty strings.')
    return resolve(cwd, value)
  }
  const planned = entries.map((entry): PlannedReporter => {
    if (typeof entry !== 'string' && (!Array.isArray(entry) || entry.length < 1 || entry.length > 2))
      throw new TypeError('Each reporter must be a name or [name, options] tuple.')
    const [name, settings = {}] = typeof entry === 'string' ? [entry] : entry
    if (!['json', 'markdown', 'html'].includes(name))
      throw new TypeError(`Unknown reporter ${JSON.stringify(name)}; use json, markdown, or html.`)
    if (!settings || typeof settings !== 'object' || Array.isArray(settings))
      throw new TypeError('Reporter options must be an object.')
    const allowed = name === 'html' ? ['outputFile', 'outputFolder', 'dataUrl'] : ['outputFile']
    for (const key of Object.keys(settings)) {
      if (!allowed.includes(key))
        throw new TypeError(`Unknown ${name} reporter option: ${key}`)
    }
    const file = 'outputFile' in settings && settings.outputFile !== undefined ? path(settings.outputFile) : undefined
    if (name !== 'html')
      return { reporter: name, file: file ?? join(output, name === 'json' ? 'report.json' : 'report.md') }
    const folder = 'outputFolder' in settings && settings.outputFolder !== undefined ? path(settings.outputFolder) : undefined
    if (file && folder)
      throw new TypeError('HTML reporter accepts either outputFile or outputFolder, not both.')
    const dataUrl = ('dataUrl' in settings ? settings.dataUrl : undefined) ?? options.dataUrl
    if (dataUrl !== undefined && typeof dataUrl !== 'string')
      throw new TypeError('HTML reporter dataUrl must be a string.')
    if (dataUrl !== undefined)
      createReportHtml(undefined, { dataUrl })
    return { reporter: name, file: file ?? join(folder ?? output, 'index.html'), json: file ? undefined : join(folder ?? output, 'report.json'), dataUrl }
  })
  // JSON + HTML may intentionally share the same report.json. Other collisions lose data.
  const outputs = new Map<string, string>()
  for (const item of planned) {
    for (const [file, kind] of [[item.file, item.reporter], [item.json, 'json']] as const) {
      if (!file)
        continue
      const existing = outputs.get(file)
      if (existing && (existing !== 'json' || kind !== 'json'))
        throw new TypeError(`Reporter outputs collide at ${file}`)
      outputs.set(file, kind)
    }
  }
  for (const file of outputs.keys()) {
    let parent = dirname(file)
    while (parent !== dirname(parent)) {
      if (outputs.has(parent))
        throw new TypeError(`Reporter output is also used as a directory: ${parent}`)
      parent = dirname(parent)
    }
  }
  return planned
}

/** Run built-in reporters on saved data; no network requests or browser launch. */
export async function writeReporters(report: CheckReport | undefined, reporter: ReporterConfig, options: ReporterOptions = {}): Promise<ReporterOutput[]> {
  const plan = planReporters(reporter, options)
  if (report)
    report = parseReport(report)
  if (!report && plan.some(item => item.reporter !== 'html'))
    throw new TypeError('JSON and Markdown reporters require an input report.')
  const writes = new Map<string, string>()
  const outputs = plan.map((item) => {
    const files = [item.file]
    if (item.reporter === 'html') {
      writes.set(item.file, createReportHtml(report, { dataUrl: item.dataUrl ?? (report && item.json ? './report.json' : undefined) }))
      if (report && item.json) {
        writes.set(item.json, formatReport(report, 'json'))
        files.push(item.json)
      }
    }
    else {
      writes.set(item.file, formatReport(report!, item.reporter))
    }
    return { reporter: item.reporter, files }
  })
  for (const [file, content] of writes) {
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, content)
  }
  return outputs
}
