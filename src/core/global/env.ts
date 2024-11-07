import { chromium } from 'playwright'
import { SEOD } from './seod'

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
