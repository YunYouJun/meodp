import type { Page } from 'playwright'
import { consoleInnerInfo, errorStart, lineStart, successStart } from 'cilicili'
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
 * <script nomodule=""></script> 不会被加载
 * 手动匹配检测
 */
export async function checkUrlNomoduleAssets(page: Page) {
  const legacyScripts = await page.$$eval('script', (elements) => {
    return elements
      .map(element => element.getAttribute('nomodule'))
      .filter(Boolean)
  })

  // 并发检测
  const loadPromises = legacyScripts.map((nomoduleUrl) => {
    return (async () => {
      if (!nomoduleUrl) {
        return
      }
      const link = nomoduleUrl
      const startTime = Date.now()
      const response = await page.goto(link)
      const statusCode = response?.status() || 'unknown'
      const linkTxt = colors.dim(link)
      const statusText = response?.statusText()
      const statusInfo = statusText ? `${statusCode?.toString()} ${statusText}` : statusCode?.toString()

      const duration = Date.now() - startTime
      // paddingSpace
      const durationTxt = colors.dim(`│${colors.blue(`${duration.toString().padStart(4, ' ')}${colors.white('ms')}`)} │`)

      if (statusCode !== 200) {
        consoleInnerInfo(colors.dim(errorStart), colors.dim(colors.red(statusInfo)), durationTxt, linkTxt)
      }
      else {
        consoleInnerInfo(colors.dim(successStart), colors.dim(colors.green(statusInfo)), durationTxt, linkTxt)
      }
      await page.close()
    })()
  })
  await Promise.all(loadPromises)
}

/**
 * check site url
 * @param url
 */
export async function checkSiteUrl(url: string) {
  const browser = await getBrowser()
  const page = await browser.newPage()

  const startTime = Date.now()
  const urlMap = registerPageEvents(page)
  consola.start('Checking site internal url:', colors.cyan(url))
  await page.goto(url, {
    waitUntil: 'networkidle',
  }).catch((e) => {
    consola.error(e)
  })
  console.log()

  const successCount = Array.from(urlMap.values()).filter(value => value.status && value.status < 400).length
  const errorCount = urlMap.size - successCount
  const timeoutCount = Array.from(urlMap.values()).filter(value => !value.responseTime).length

  const duration = (Date.now() - startTime) / 1000
  const timeoutTxt = timeoutCount ? colors.redBright(colors.redBright(`(🚫 ${timeoutCount} Timeout)`)) : ''
  console.log()
  consola.log(
    `🔍 ${urlMap.size} Total ${colors.dim(`(in ${duration}s)`)}.`,
    `✅ ${colors.green(`${successCount} OK`)}`,
    `❌ ${colors.red(`${errorCount} Errors`)} ${timeoutTxt}`,
  )

  urlMap.forEach((value, key) => {
    if (!value.responseTime) {
      console.error(lineStart, `Resource loading timeout: ${colors.dim(key)}`)
    }
  })

  await checkUrlNomoduleAssets(page)

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
 * 检查站点地图
 */
export async function checkSiteMap(url: string) {
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
    if (link && !siteUrls.has(link)) {
      siteUrls.add(link)
      const url = new URL(link).href
      await checkSiteUrl(url)
    }
  }
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
