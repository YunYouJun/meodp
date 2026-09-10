import type { LinkResult } from 'linkinator'
import type { CheckOptions, CheckReport, FailureReason, LinkObservation, LinkTarget } from './types'
import { setTimeout } from 'node:timers/promises'
import { LinkChecker } from 'linkinator'
import { normalizeTargets, normalizeUrl } from './input'
import { normalizeCheckOptions } from './options'

function failureDetail(result: LinkResult): { reason: FailureReason, detail: string } {
  const error = result.failureDetails?.find(item => item instanceof Error)
  const parts: string[] = []
  let current: unknown = error
  for (let depth = 0; current && typeof current === 'object' && depth < 5; depth++) {
    for (const key of ['name', 'code', 'message'] as const) {
      const value: unknown = Reflect.get(current, key)
      if (typeof value === 'string')
        parts.push(value)
    }
    current = 'cause' in current ? current.cause : undefined
  }
  const detail = parts.join(': ') || `HTTP ${result.status ?? 0}`
  if (/ENOTFOUND|EAI_AGAIN|EAI_FAIL/.test(detail))
    return { reason: 'dns', detail }
  if (/CERT|TLS|SSL/i.test(detail))
    return { reason: 'tls', detail }
  if (/timeout|timed out|ETIMEDOUT|UND_ERR_.*TIMEOUT/i.test(detail))
    return { reason: 'timeout', detail }
  return { reason: result.status ? 'http' : 'network', detail }
}

type ProbeResult = Pick<LinkObservation, 'status' | 'finalUrl' | 'httpStatus' | 'redirects' | 'reason' | 'detail'>

async function probe(url: string, timeoutMs: number, maxRedirects: number): Promise<ProbeResult> {
  const redirects: LinkObservation['redirects'] = []
  const visited = new Set<string>()
  let current = url
  for (;;) {
    visited.add(current)
    // linkinator normally inspects links found in the page, even with recurse:false.
    // Manual redirects let us allow only this exact URL, then inspect the next hop.
    const checker = new LinkChecker()
    const { links } = await checker.check({
      path: current,
      recurse: false,
      concurrency: 1,
      timeout: timeoutMs,
      retry: false,
      retryErrors: false,
      redirects: 'error',
      linksToSkip: async candidate => candidate !== current,
    })
    const result = links.find(item => item.url === current && !item.parent)
    if (!result)
      throw new Error('The HTTP checker returned no result for the requested URL')
    const httpStatus = result.status || undefined
    const base = { finalUrl: current, httpStatus, redirects }
    if (httpStatus && [301, 302, 303, 307, 308].includes(httpStatus)) {
      const response = result.failureDetails?.find(item => 'headers' in item)
      const location = response && 'headers' in response ? response.headers.location : undefined
      let next: string
      try {
        if (!location)
          throw new Error('Missing redirect location')
        next = normalizeUrl(new URL(location, current).href)
      }
      catch {
        return { ...base, status: 'unavailable', reason: 'redirect', detail: 'Missing or invalid HTTP(S) redirect destination' }
      }
      redirects.push({ url: current, status: httpStatus, location: next })
      if (visited.has(next) || redirects.length > maxRedirects) {
        return {
          ...base,
          status: 'unavailable',
          reason: 'redirect',
          detail: visited.has(next) ? 'Redirect loop' : 'Redirect limit exceeded',
        }
      }
      current = next
      continue
    }
    if (httpStatus && httpStatus >= 200 && httpStatus < 300)
      return { ...base, status: 'reachable' }
    if (httpStatus && [401, 403, 429, 451, 999].includes(httpStatus))
      return { ...base, status: 'restricted', reason: 'http', detail: `HTTP ${httpStatus}: access requires review` }
    return { ...base, status: 'unavailable', ...failureDetail(result) }
  }
}

/** Check only the supplied URLs. HTTP failures become observations; invalid input rejects. */
export async function checkLinks(input: readonly (string | LinkTarget)[], options: CheckOptions = {}): Promise<CheckReport> {
  const targets = normalizeTargets(input)
  const { concurrency, timeoutMs, retries, maxRedirects, observer } = normalizeCheckOptions(options)
  const startedAt = new Date().toISOString()
  const previous = new Map(options.previousReport?.results.map(item => [item.url, item]))
  const results: LinkObservation[] = []
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, async () => {
    while (cursor < targets.length) {
      const index = cursor++
      const target = targets[index]
      const start = Date.now()
      let attempts = 0
      let observation: ProbeResult
      do {
        if (attempts > 0)
          await setTimeout(500 * 2 ** (attempts - 1))
        attempts++
        observation = await probe(target.url, timeoutMs, maxRedirects)
      } while (
        attempts <= retries
        && observation.status === 'unavailable'
        && observation.reason !== 'redirect'
        && (!observation.httpStatus || observation.httpStatus >= 500)
      )
      const checkedAt = new Date().toISOString()
      const old = previous.get(target.url)
      const failed = observation.status === 'unavailable'
      const result: LinkObservation = {
        ...target,
        ...observation,
        checkedAt,
        durationMs: Date.now() - start,
        attempts,
        consecutiveFailures: failed ? (old?.status === 'unavailable' ? old.consecutiveFailures : 0) + 1 : 0,
        firstFailureAt: failed ? (old?.status === 'unavailable' ? old.firstFailureAt ?? checkedAt : checkedAt) : undefined,
        lastSuccessAt: observation.status === 'reachable' ? checkedAt : old?.lastSuccessAt,
        changed: Boolean(old && (old.status !== observation.status || old.finalUrl !== observation.finalUrl)),
        recovered: observation.status === 'reachable' && old?.status === 'unavailable',
      }
      results[index] = result
      await options.onResult?.(result)
    }
  }))
  const summary: CheckReport['summary'] = { total: results.length, reachable: 0, restricted: 0, unavailable: 0, redirected: 0, recovered: 0 }
  for (const result of results) {
    summary[result.status]++
    summary.redirected += Number(result.redirects.length > 0)
    summary.recovered += Number(result.recovered)
  }
  return { schemaVersion: 1, observer, startedAt, completedAt: new Date().toISOString(), summary, results }
}
