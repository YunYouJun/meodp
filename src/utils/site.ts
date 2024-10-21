import type { Page } from 'playwright'
import consola from 'consola'
import { colors } from 'consola/utils'
import { getBrowser } from '../env'
import { checkPageAssets, registerPageEvents } from './assets'

/**
 * 只检查内部链接
 */
// const onlyCheckInternalLink = true
const siteUrls = new Set<string>()

/**
 * 获取站点外链
 */
export async function getSiteLinks(page: Page) {
  const links = await page.$$eval('a', (elements) => {
    return elements
      .map(element => element.getAttribute('href'))
      .filter(Boolean)
  })

  /**
   * 过滤 query
   */
  const filterQuery = true
  const onlyCheckInternalLink = true

  const filterLinks = links.map((link) => {
    if (!link) {
      return false
    }

    if (onlyCheckInternalLink) {
      if (link.startsWith('/')) {
        if (filterQuery) {
          // remove query (env: node) searchParams
          const url = new URL(link, page.url())
          url.search = ''
          return url.toString()
        }
        return link
      }
    }
    return false
  }).filter(Boolean)

  return filterLinks as string[]
}

/**
 * check site url
 * @param url
 */
export async function checkSiteUrl(url: string) {
  const browser = await getBrowser()
  const page = await browser.newPage()

  registerPageEvents(page)
  consola.start('Checking site internal url', colors.cyan(url))
  await page.goto(url, {
    waitUntil: 'networkidle',
  }).catch((e) => {
    consola.error(e)
  })
  consola.success('All request loaded.')
  console.log()

  const links = await getSiteLinks(page)
  for (const link of links) {
    if (!siteUrls.has(link)) {
      siteUrls.add(link)
      const url = new URL(link, page.url()).href
      await checkSiteUrl(url)
    }
  }
  await page.close()
}

/**
 * 检查站点可访问性
 * - 死链
 * - 所有内嵌资源
 */
export async function checkSite(url: string) {
  const browser = await getBrowser()
  const page = await browser.newPage()

  if (!url.endsWith('/')) {
    url += '/'
  }
  siteUrls.add(url)

  registerPageEvents(page)
  consola.start('Checking site home url:', colors.cyan(url))
  const startTime = Date.now()
  await page.goto(url, {
    waitUntil: 'networkidle',
  })
  consola.success('All request loaded.')
  console.log()

  const links = await getSiteLinks(page)
  await page.close()

  for (const link of links) {
    if (!siteUrls.has(link)) {
      siteUrls.add(link)
      const url = new URL(link, page.url()).href
      await checkSiteUrl(url)
    }
  }

  const endTime = Date.now()
  consola.info('Site checked in', colors.cyan(`${(endTime - startTime) / 1000}s`))

  await browser.close()
  consola.success('All site checked.')

  // console siteUrls
  consola.info('siteUrls:', siteUrls)
}
