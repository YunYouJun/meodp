import type { SEODConfig } from '../types'
import { type Browser, chromium } from 'playwright'

/**
 * 获取浏览器实例
 * - 单例模式
 */
export async function getBrowser() {
  if (!SEOD.browser) {
    SEOD.browser = await chromium.launch({
      // 15s
      timeout: 15000,
    })
  }
  return SEOD.browser
}

export class SEOD {
  /**
   * global config
   */
  public static config: SEODConfig
  public static configFile: string
  /**
   * browser instance by playwright
   */
  public static browser: Browser

  constructor(config: SEODConfig) {
    SEOD.config = config
  }
}
