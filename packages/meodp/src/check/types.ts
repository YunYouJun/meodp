export interface LinkTarget {
  url: string
  name?: string
}

export type Availability = 'reachable' | 'restricted' | 'unavailable'
export type FailureReason = 'http' | 'dns' | 'tls' | 'timeout' | 'network' | 'redirect'

export interface LinkObservation extends LinkTarget {
  status: Availability
  checkedAt: string
  durationMs: number
  attempts: number
  finalUrl: string
  httpStatus?: number
  redirects: { url: string, status: number, location: string }[]
  reason?: FailureReason
  detail?: string
  consecutiveFailures: number
  firstFailureAt?: string
  lastSuccessAt?: string
  changed: boolean
  recovered: boolean
}

export interface CheckReport {
  schemaVersion: 1
  observer: string
  startedAt: string
  completedAt: string
  summary: Record<Availability, number> & { total: number, redirected: number, recovered: number }
  results: LinkObservation[]
}

export interface CheckOptions {
  /** Maximum simultaneous site checks. Default: 5. */
  concurrency?: number
  /** Timeout for each HTTP request, including its body. Default: 10000 ms. */
  timeoutMs?: number
  /** Retries for transport errors and 5xx responses. Default: 1; 429 is not retried. */
  retries?: number
  /** Maximum followed redirects per attempt. Default: 5. */
  maxRedirects?: number
  /** Identifies the network/environment. Must match previousReport.observer. */
  observer?: string
  previousReport?: CheckReport
  onResult?: (result: LinkObservation) => void | Promise<void>
}

export interface SitemapOptions extends CheckOptions {
  /** Treat the input as a site URL: read robots.txt, falling back to /sitemap.xml. */
  discover?: boolean
  /** Reject before page checks if discovery exceeds this many unique pages. Default: 10000. */
  maxUrls?: number
  /** Maximum number of unique sitemap documents to read. Default: 100. */
  maxSitemaps?: number
  /** Maximum downloaded and decompressed size per discovery document. Default: 10 MiB. */
  maxSitemapBytes?: number
}
