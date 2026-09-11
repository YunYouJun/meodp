import type { CheckReport } from './types'
import { setTimeout } from 'node:timers/promises'
import { parseReport } from './schema'

export interface ReportVerificationOptions {
  url: string
  attempts?: number
  delayMs?: number
}

export async function waitForReport(expected: CheckReport, { url, attempts = 12, delayMs = 15000 }: ReportVerificationOptions) {
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 120 || !Number.isFinite(delayMs) || delayMs < 0 || delayMs > 300000)
    throw new Error('Invalid report verification retry options.')
  const reportUrl = new URL(url)
  if (!['https:', 'http:'].includes(reportUrl.protocol) || reportUrl.username || reportUrl.password)
    throw new Error('Report verification requires an HTTP(S) URL without credentials.')
  reportUrl.searchParams.set('observation', expected.completedAt)
  const expectedJson = JSON.stringify(parseReport(expected))
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const options = { cache: 'no-store', signal: AbortSignal.timeout(10000) } satisfies RequestInit
      const response = await fetch(reportUrl, options)
      if (response.ok && JSON.stringify(parseReport(await response.json())) === expectedJson) {
        const page = await fetch(new URL('./', url), { cache: 'no-store', signal: AbortSignal.timeout(10000) })
        if (page.ok && (await page.text()).includes('id="meodp-data"'))
          return
      }
    }
    catch {
      // A stale CDN response, pending deployment or invalid response may recover.
    }
    if (attempt + 1 < attempts)
      await setTimeout(delayMs)
  }
  throw new Error('The public status page did not serve this report in time. Check the hosting deployment; saved report files remain available.')
}
