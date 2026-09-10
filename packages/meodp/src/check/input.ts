import type { LinkTarget } from './types'

export function normalizeUrl(value: string): string {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Expected an HTTP(S) URL without embedded credentials')
  url.hash = ''
  return url.href
}

export function normalizeTargets(input: unknown): LinkTarget[] {
  if (!Array.isArray(input))
    throw new TypeError('Input must be an array of URLs or objects with a url field')

  const seen = new Set<string>()
  return input.map((item: unknown, index) => {
    const value = typeof item === 'string' ? { url: item } : item
    if (!value || typeof value !== 'object' || !('url' in value) || typeof value.url !== 'string')
      throw new TypeError(`Invalid link at index ${index}: expected a url string`)
    let url: string
    try {
      url = normalizeUrl(value.url.trim())
    }
    catch {
      throw new TypeError(`Invalid HTTP(S) URL at index ${index}`)
    }
    if ('name' in value && value.name !== undefined && typeof value.name !== 'string')
      throw new TypeError(`Invalid name at index ${index}: expected a string`)
    return { url, ...('name' in value && typeof value.name === 'string' ? { name: value.name } : {}) }
  }).filter((item) => {
    if (seen.has(item.url))
      return false
    seen.add(item.url)
    return true
  })
}
