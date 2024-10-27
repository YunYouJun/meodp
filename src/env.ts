import { type Browser, chromium } from 'playwright'

// eslint-disable-next-line import/no-mutable-exports
export let browser: Browser

/**
 * 获取浏览器实例
 * - 单例模式
 */
export async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      // 15s
      timeout: 15000,
    })
  }
  return browser
}
