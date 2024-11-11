import { chromium } from 'playwright'
import { MEODP } from './meodp'

/**
 * 获取浏览器实例
 * - 单例模式
 */
export async function getBrowser() {
  if (!MEODP.browser) {
    MEODP.browser = await chromium.launch({
      // 15s
      timeout: 15000,
    })
  }
  return MEODP.browser
}
