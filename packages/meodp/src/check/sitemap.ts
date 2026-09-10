import type { SitemapOptions } from './types'
import { Buffer } from 'node:buffer'
import { setTimeout } from 'node:timers/promises'
import { promisify } from 'node:util'
import { gunzip } from 'node:zlib'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { checkLinks } from './check'
import { normalizeUrl } from './input'
import { integerOption, normalizeCheckOptions } from './options'

const unzip = promisify(gunzip)

class DocumentError extends Error {
  constructor(message: string, readonly retryable = false) {
    super(message)
  }
}

function discoveryOptions(options: SitemapOptions) {
  const normalized = normalizeCheckOptions(options)
  if (options.discover !== undefined && typeof options.discover !== 'boolean')
    throw new TypeError('discover must be a boolean')
  return {
    ...normalized,
    maxUrls: integerOption(options.maxUrls, 10000, 'maxUrls', 1, 50000),
    maxSitemaps: integerOption(options.maxSitemaps, 100, 'maxSitemaps', 1, 10000),
    maxSitemapBytes: integerOption(options.maxSitemapBytes, 10 * 1024 * 1024, 'maxSitemapBytes', 1, 100 * 1024 * 1024),
  }
}

/** Discovery fails as a whole: an incomplete URL list must not look like a complete scan. */
async function readDocument(source: string, options: ReturnType<typeof discoveryOptions>, allowMissing = false) {
  for (let attempt = 0; ; attempt++) {
    try {
      let url = source
      const visited = new Set<string>()
      for (;;) {
        visited.add(url)
        const response = await fetch(url, {
          redirect: 'manual',
          signal: AbortSignal.timeout(options.timeoutMs),
        })
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          await response.body?.cancel()
          const location = response.headers.get('location')
          let next: string
          try {
            if (!location)
              throw new Error('Missing location')
            next = normalizeUrl(new URL(location, url).href)
          }
          catch {
            throw new DocumentError(`Invalid sitemap/robots redirect from ${url}`)
          }
          if (visited.has(next) || visited.size > options.maxRedirects)
            throw new DocumentError(`Sitemap/robots redirect loop or limit exceeded: ${url}`)
          url = next
          continue
        }
        if (!response.ok) {
          await response.body?.cancel()
          if (allowMissing && [404, 410].includes(response.status))
            return undefined
          throw new DocumentError(`Unable to read ${url}: HTTP ${response.status}`, response.status >= 500)
        }
        const chunks: Uint8Array[] = []
        let size = 0
        if (response.body) {
          const reader = response.body.getReader()
          try {
            for (;;) {
              const { done, value } = await reader.read()
              if (done)
                break
              size += value.byteLength
              if (size > options.maxSitemapBytes)
                throw new DocumentError(`Discovery document exceeds maxSitemapBytes: ${url}`)
              chunks.push(value)
            }
          }
          finally {
            await reader.cancel().catch(() => {})
            reader.releaseLock()
          }
        }
        let body = Buffer.concat(chunks)
        if (body[0] === 0x1F && body[1] === 0x8B) {
          try {
            body = await unzip(body, { maxOutputLength: options.maxSitemapBytes })
          }
          catch {
            throw new DocumentError(`Invalid gzip or decompressed document exceeds maxSitemapBytes: ${url}`)
          }
        }
        return { url, text: body.toString('utf8') }
      }
    }
    catch (error) {
      if (attempt >= options.retries || (error instanceof DocumentError && !error.retryable))
        throw new Error(`Sitemap discovery failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
      await setTimeout(500 * 2 ** attempt)
    }
  }
}

function parseLocations(text: string, source: string) {
  // Use the XML library for namespaces, entity decoding, CDATA, and validation.
  // External/custom entities are outside the sitemap format we accept.
  if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true)
    throw new Error(`Invalid sitemap XML: ${source}`)
  const parser = new XMLParser({
    ignoreAttributes: true,
    removeNSPrefix: true,
    parseTagValue: false,
    isArray: name => name === 'url' || name === 'sitemap',
  })
  const document = parser.parse(text)
  const roots = Object.keys(document).filter(key => !key.startsWith('?'))
  if (roots.length !== 1 || !['urlset', 'sitemapindex'].includes(roots[0]))
    throw new Error(`Expected a sitemap urlset or sitemapindex: ${source}`)
  const isIndex = roots[0] === 'sitemapindex'
  const root = document[roots[0]]
  if (root?.[isIndex ? 'url' : 'sitemap'])
    throw new Error(`Mixed sitemap index and page entries: ${source}`)
  const entries: unknown[] = root?.[isIndex ? 'sitemap' : 'url'] ?? []
  const urls = entries.map((entry) => {
    if (!entry || typeof entry !== 'object' || !('loc' in entry) || typeof entry.loc !== 'string' || !entry.loc.trim())
      throw new Error(`Missing or invalid sitemap loc: ${source}`)
    try {
      return normalizeUrl(new URL(entry.loc.trim(), source).href)
    }
    catch {
      throw new Error(`Invalid HTTP(S) URL in sitemap: ${source}`)
    }
  })
  return { isIndex, urls }
}

/** Read and validate a complete, deduplicated page list without requesting the pages. */
export async function readSitemapUrls(source: string, options: SitemapOptions = {}): Promise<string[]> {
  const input = normalizeUrl(source.trim())
  const config = discoveryOptions(options)
  let pending = [input]
  if (options.discover) {
    const robots = await readDocument(new URL('/robots.txt', input).href, config, true)
    const declared = robots?.text.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\s*sitemap\s*:\s*(\S+)/i)
      return match ? [normalizeUrl(new URL(match[1], robots.url).href)] : []
    }) ?? []
    pending = declared.length ? declared : [new URL('/sitemap.xml', input).href]
  }
  const queued = new Set(pending)
  pending = [...queued]
  const visited = new Set<string>()
  const pages = new Set<string>()
  let documentCount = 0
  for (let cursor = 0; cursor < pending.length; cursor++) {
    const url = pending[cursor]
    if (visited.has(url))
      continue
    if (++documentCount > config.maxSitemaps)
      throw new Error('Sitemap discovery exceeds maxSitemaps; no pages were checked')
    visited.add(url)
    const document = await readDocument(url, config)
    if (!document)
      throw new Error(`Unable to read sitemap: ${url}`)
    visited.add(document.url)
    const { isIndex, urls } = parseLocations(document.text, document.url)
    for (const location of urls) {
      if (isIndex) {
        if (!queued.has(location) && !visited.has(location)) {
          queued.add(location)
          pending.push(location)
        }
      }
      else {
        pages.add(location)
        if (pages.size > config.maxUrls)
          throw new Error('Sitemap discovery exceeds maxUrls; no pages were checked')
      }
    }
  }
  if (!pages.size)
    throw new Error('Sitemap discovery found no page URLs; no pages were checked')
  return [...pages]
}

/** Check sitemap-listed pages using the same linkinator adapter, history, and report schema as checkLinks. */
export async function checkSitemap(source: string, options: SitemapOptions = {}) {
  const startedAt = new Date().toISOString()
  const urls = await readSitemapUrls(source, options)
  const report = await checkLinks(urls, options)
  return { ...report, startedAt }
}
