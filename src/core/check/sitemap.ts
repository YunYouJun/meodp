import type { MEODPUrlProps } from '../../types'
import { siteUrlMap } from '../cache'
import { getBrowser } from '../global/env'

/**
 * 检查站点地图
 */
export async function checkSiteMap(urlItem: MEODPUrlProps) {
  const { url } = urlItem

  const robotsUrl = new URL('/robots.txt', url).href
  const browser = await getBrowser()
  const page = await browser.newPage()

  await page.goto(robotsUrl)
  const text = await page.textContent('pre')
  const sitemap = text?.match(/Sitemap: (.*)/)?.[1]

  let sitemapUrl = new URL(sitemap || '/sitemap.xml', url).href
  if (sitemap) {
    sitemapUrl = sitemap.startsWith('http') ? sitemap : new URL(sitemap, url).href
  }

  await page.goto(sitemapUrl)
  const links = await page.$$eval('loc', (elements) => {
    return elements.map(element => element.textContent)
  })

  // 不忽略 sitemap 中的 query
  for (const link of links) {
    if (link && !siteUrlMap.has(link)) {
      siteUrlMap.set(link, {
        statusCode: 0,
        checkStatus: 'pending',
      })
      // const url = new URL(link).href
      // await checkSiteUrl(url, {
      //   site: url,
      // })
    }
  }
}
