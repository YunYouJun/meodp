export const MAX_XML_BYTES = 5 * 1024 * 1024
const MAX_ENTRIES = 50000
const SITEMAP_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9'

export type SitemapErrorCode = 'empty' | 'size' | 'xml' | 'doctype' | 'root' | 'mixed' | 'limit'

export class SitemapError extends Error {
  constructor(readonly code: SitemapErrorCode) {
    super(code)
  }
}

export interface SitemapEntry {
  value: string
  url?: string
  host?: string
  count: number
  issue?: 'missing' | 'multiple' | 'url'
}

export interface SitemapAnalysis {
  kind: 'urlset' | 'sitemapindex'
  total: number
  unique: number
  duplicates: number
  invalid: number
  entries: SitemapEntry[]
}

/** Inspect one local document. No fetching, index expansion, or link checking. */
export function parseSitemapXml(text: string): SitemapAnalysis {
  if (!text.trim())
    throw new SitemapError('empty')
  if (new TextEncoder().encode(text).byteLength > MAX_XML_BYTES)
    throw new SitemapError('size')
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    throw new SitemapError('doctype')

  const document = new DOMParser().parseFromString(text, 'application/xml')
  if (document.getElementsByTagName('parsererror').length)
    throw new SitemapError('xml')
  const root = document.documentElement
  const kind = root.localName
  if (!['urlset', 'sitemapindex'].includes(kind) || (root.namespaceURI && root.namespaceURI !== SITEMAP_NAMESPACE))
    throw new SitemapError('root')
  const children = Array.from(root.children).filter(child => child.namespaceURI === root.namespaceURI)
  const entryName = kind === 'urlset' ? 'url' : 'sitemap'
  if (children.some(child => child.localName !== entryName))
    throw new SitemapError('mixed')
  if (children.length > MAX_ENTRIES)
    throw new SitemapError('limit')

  const analysis: SitemapAnalysis = { kind: kind as SitemapAnalysis['kind'], total: children.length, unique: 0, duplicates: 0, invalid: 0, entries: [] }
  const seen = new Map<string, SitemapEntry>()
  for (const child of children) {
    // Only a direct sitemap loc is a page; image/video extension locs are ignored.
    const locations = Array.from(child.children).filter(element => element.localName === 'loc' && element.namespaceURI === root.namespaceURI)
    const value = locations[0]?.textContent?.trim() ?? ''
    const entry: SitemapEntry = { value, count: 1 }
    if (locations.length > 1) {
      entry.issue = 'multiple'
    }
    else if (!value) {
      entry.issue = 'missing'
    }
    else {
      try {
        const url = new URL(value)
        if (locations[0].children.length || !/^https?:$/.test(url.protocol) || url.username || url.password)
          throw new Error('Invalid URL')
        entry.url = url.href
        entry.host = url.host
      }
      catch {
        entry.issue = 'url'
      }
    }
    if (entry.url) {
      const previous = seen.get(entry.url)
      if (previous) {
        previous.count++
        analysis.duplicates++
        continue
      }
      seen.set(entry.url, entry)
      analysis.unique++
    }
    else {
      analysis.invalid++
    }
    analysis.entries.push(entry)
  }
  return analysis
}
