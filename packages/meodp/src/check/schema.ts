import type { CheckReport, LinkObservation } from './types'

/** Shared by the Node reader and the static viewer; report files are untrusted input. */
export function parseReport(data: unknown): CheckReport {
  const invalid = (field: string): never => {
    throw new TypeError(`Invalid or unsupported report: ${field}`)
  }
  const record = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return invalid('expected an object')
    return value as Record<string, unknown>
  }
  const string = (value: unknown, field: string): string => typeof value === 'string' ? value : invalid(field)
  const integer = (value: unknown, field: string, minimum = 0): number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum ? value : invalid(field)
  const bool = (value: unknown, field: string): boolean => typeof value === 'boolean' ? value : invalid(field)
  const date = (value: unknown, field: string): string => {
    const text = string(value, field)
    return Number.isFinite(Date.parse(text)) ? text : invalid(field)
  }
  const url = (value: unknown): string => {
    const text = string(value, 'URL')
    try {
      const parsed = new URL(text)
      if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password)
        return invalid('URL must use HTTP(S) without credentials')
    }
    catch { return invalid('URL') }
    return text
  }
  const root = record(data)
  if (root.schemaVersion !== 1 || !Array.isArray(root.results))
    return invalid('schemaVersion or results')
  const results = root.results.map((value): LinkObservation => {
    const item = record(value)
    if (!['reachable', 'restricted', 'unavailable'].includes(String(item.status)) || !Array.isArray(item.redirects))
      return invalid('status or redirects')
    const observation: LinkObservation = {
      url: url(item.url),
      finalUrl: url(item.finalUrl),
      status: item.status as LinkObservation['status'],
      checkedAt: date(item.checkedAt, 'checkedAt'),
      durationMs: typeof item.durationMs === 'number' && Number.isFinite(item.durationMs) && item.durationMs >= 0 ? item.durationMs : invalid('durationMs'),
      attempts: integer(item.attempts, 'attempts', 1),
      consecutiveFailures: integer(item.consecutiveFailures, 'consecutiveFailures'),
      changed: bool(item.changed, 'changed'),
      recovered: bool(item.recovered, 'recovered'),
      redirects: item.redirects.map((value) => {
        const hop = record(value)
        return { url: url(hop.url), status: integer(hop.status, 'redirect status', 100), location: string(hop.location, 'redirect location') }
      }),
    }
    if (item.name !== undefined)
      observation.name = string(item.name, 'name')
    if (item.httpStatus !== undefined)
      observation.httpStatus = integer(item.httpStatus, 'httpStatus', 100)
    if (item.reason !== undefined) {
      if (!['http', 'dns', 'tls', 'timeout', 'network', 'redirect'].includes(String(item.reason)))
        return invalid('reason')
      observation.reason = item.reason as LinkObservation['reason']
    }
    if (item.detail !== undefined)
      observation.detail = string(item.detail, 'detail')
    if (item.firstFailureAt !== undefined)
      observation.firstFailureAt = date(item.firstFailureAt, 'firstFailureAt')
    if (item.lastSuccessAt !== undefined)
      observation.lastSuccessAt = date(item.lastSuccessAt, 'lastSuccessAt')
    return observation
  })
  const summary = { total: results.length, reachable: 0, restricted: 0, unavailable: 0, redirected: 0, recovered: 0 }
  for (const item of results) {
    summary[item.status]++
    summary.redirected += Number(item.redirects.length > 0)
    summary.recovered += Number(item.recovered)
  }
  const supplied = record(root.summary)
  for (const [key, count] of Object.entries(summary)) {
    if (supplied[key] !== count)
      return invalid(`summary.${key} does not match results`)
  }
  return {
    schemaVersion: 1,
    observer: string(root.observer, 'observer'),
    startedAt: date(root.startedAt, 'startedAt'),
    completedAt: date(root.completedAt, 'completedAt'),
    summary,
    results,
  }
}
