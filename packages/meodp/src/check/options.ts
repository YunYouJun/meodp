import type { CheckOptions } from './types'
import { hostname } from 'node:os'

export function integerOption(value: number | undefined, fallback: number, name: string, minimum: number, maximum: number) {
  const result = value ?? fallback
  if (!Number.isInteger(result) || result < minimum || result > maximum)
    throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}`)
  return result
}

export function normalizeCheckOptions(options: CheckOptions) {
  const concurrency = integerOption(options.concurrency, 5, 'concurrency', 1, 100)
  const timeoutMs = integerOption(options.timeoutMs, 10000, 'timeoutMs', 1, 300000)
  const retries = integerOption(options.retries, 1, 'retries', 0, 5)
  const maxRedirects = integerOption(options.maxRedirects, 5, 'maxRedirects', 0, 20)
  const observer = options.observer ?? hostname()
  if (!observer.trim())
    throw new TypeError('observer must not be empty')
  if (options.previousReport && options.previousReport.observer !== observer)
    throw new Error('Previous report belongs to another observer; use a separate history file')
  return { concurrency, timeoutMs, retries, maxRedirects, observer }
}
