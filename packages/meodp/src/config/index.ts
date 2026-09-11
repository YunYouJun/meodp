import type { SitemapOptions } from '../check/types'
import type { ReportVerificationOptions } from '../check/verify'
import type { EmailOptions } from '../notify/email'
import type { FeishuOptions } from '../notify/feishu'
import type { NotificationOptions } from '../notify/notification'

export interface ScanConfig extends Omit<SitemapOptions, 'previousReport' | 'onResult'> {
  input?: string
  output?: string
  history?: string
  /** Seed missing history from a committed snapshot. */
  historySeed?: string
  observerMismatch?: 'error' | 'reset'
  site?: string
  failOn?: 'unavailable' | 'review' | 'none'
}

export interface NotificationConfig extends Omit<NotificationOptions, 'previousReport' | 'mode'> {
  input: string
  previousReport?: string
  timeZone?: string
  maxItems?: number
  feishu?: FeishuOptions & { mode?: NotificationOptions['mode'] }
  email?: EmailOptions & { mode?: NotificationOptions['mode'] }
}

export interface MeodpConfig {
  check?: ScanConfig
  sitemap?: ScanConfig
  report?: {
    input?: string
    output?: string
    dataUrl?: string
    verify?: ReportVerificationOptions
  }
  notify?: NotificationConfig
}

/** Lightweight configuration entry; importing it does not load browser or mail clients. */
export function defineConfig<const T extends MeodpConfig>(config: T): T {
  return config
}
