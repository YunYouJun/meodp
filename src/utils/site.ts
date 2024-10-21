import { getBrowser } from '../env'
import { checkPageAssets } from './assets'

/**
 * 检查站点可访问性
 * - 死链
 * - 所有内嵌资源
 */
export async function checkSite(url: string) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  await page.goto(url)

  await checkPageAssets(page)
}
