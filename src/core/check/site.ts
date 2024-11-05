import type { Page } from 'playwright'
import type { SEODUrlProps } from '../../types'
import { consoleInnerInfo, errorStart, lineStart, successStart } from 'cilicili'
import consola from 'consola'
import { colors } from 'consola/utils'
import PQueue from 'p-queue'
import { PQueueMap, siteUrlMap } from '../cache'
import { getBrowser, SEOD } from '../env'
import { LocalLog } from '../logger'
import { progressBarMap } from '../progress'
import { registerPageEvents } from '../utils/assets'
import { parseUrlMap } from '../utils/parse'

/**
 * 获取站点外链
 */
export async function getSiteLinks(page: Page, options: CheckSiteUrlOptions) {
  const links = await page.$$eval('a', (elements) => {
    return elements
      .map(element => element.getAttribute('href'))
      .filter(Boolean)
  })

  /**
   * 过滤 query
   */
  const filterQuery = true

  const filterLinks = links.map((link) => {
    if (!link) {
      return false
    }

    const isExternalLink = link.startsWith('http') && !link.startsWith(options.urlItem.url)
    if (!isExternalLink) {
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
    else {
      return link
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
  }).catch((e) => {
    consola.error(e)
  }) || []

  if (!legacyScripts.length)
    return true

  const browser = await getBrowser()
  const context = await browser.newContext()

  // 并发检测
  const loadPromises = legacyScripts.map((nomoduleUrl) => {
    return (async () => {
      if (!nomoduleUrl) {
        return
      }

      const link = nomoduleUrl
      const startTime = Date.now()
      const newPage = await context.newPage()
      const response = await newPage.goto(link)

      const statusCode = response?.status() || 0
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
      await newPage.close()

      return statusCode ? (statusCode < 400) : false
    })()
  })
  const results = await Promise.all(loadPromises)
  return results.every(result => result)
}

export interface CheckSiteUrlOptions {
  urlItem: SEODUrlProps
  /**
   * 检查 nomodule 资源
   */
  checkNoModule?: boolean
}

/**
 * check url in site
 * @param url
 */
export async function checkSiteUrl(url: string, options: CheckSiteUrlOptions) {
  const browser = await getBrowser()
  const page = await browser.newPage()

  const bar = progressBarMap.get(options.urlItem.url)
  const startTime = Date.now()

  const isExternalLink = url.startsWith('http') && !url.startsWith(options.urlItem.url)

  const log = LocalLog.createLog(options.urlItem)

  const urlMap = registerPageEvents(page, options.urlItem)
  const res = await page.goto(url, {
    waitUntil: 'networkidle',
  }).catch((e) => {
    consola.error(e)
  })
  const statusCode = res?.status() || 0
  siteUrlMap.set(url, {
    statusCode,
    checkStatus: 'goto',
  })

  const { success, error, total } = parseUrlMap(urlMap)

  const duration = (Date.now() - startTime) / 1000
  const statusText = res?.statusText()
  SEOD.logger.log(
    lineStart,
    '  ',
    colors.green(`[${statusCode}${statusText ? ` ${statusText}` : ''}]`),
    colors.cyan(url),
    colors.dim(`(in ${duration}s)`),
    total.text,
    success.text,
    error.text,
  )
  log(
    `[${statusCode}${statusText ? ` ${statusText}` : ''}] ${url}`,
    `🔍 ${urlMap.size} Total Requests (in ${duration}s).`,
    success.text,
    error.text,
  )
  log()

  if (SEOD.config.log?.type === 'progress') {
    bar?.update(success.count, {
      value: colors.green(success.count),
      error_count: error.count ? colors.red(error.count) : 0,
    })
  }
  else {
    // logger.info()
  }

  // @TODO retry

  for (const [url, info] of urlMap) {
    if (!info.response) {
      SEOD.logger.error(lineStart, `Resource loading timeout: ${colors.underline(url)}`)
    }
  }

  let noModuleAssetsPassed = true
  if (options.checkNoModule) {
    noModuleAssetsPassed = await checkUrlNomoduleAssets(page)
  }

  // 所有资源加载成功，设置为通过
  const urlMapValues = Array.from(urlMap.values())
  if (urlMapValues.every(value => value.response?.status() && value.response?.status() < 400) && noModuleAssetsPassed) {
    siteUrlMap.set(url, {
      statusCode,
      checkStatus: 'passed',
    })
    const successCount = Array.from(siteUrlMap.values()).filter(value => value.checkStatus === 'passed').length
    bar?.update(successCount)
  }
  else {
    siteUrlMap.set(url, {
      statusCode,
      checkStatus: 'failed',
    })
  }

  // check site, do not check link in external link
  if (!isExternalLink) {
    const queue = PQueueMap.get(url)
    if (queue) {
      const links = await getSiteLinks(page, options)
      for (const link of links) {
        if (!siteUrlMap.has(link)) {
          siteUrlMap.set(link, {
            statusCode: 0,
            checkStatus: 'pending',
          })
          bar?.setTotal(siteUrlMap.size)
          const url = new URL(link, page.url()).href

          await queue.add(async () => {
            await checkSiteUrl(url, options)
          })
        }
      }
    }
  }
  await page.close()
}

/**
 * 检查站点可访问性
 * - 死链
 * - 所有内嵌资源
 */
export async function checkSite(props: SEODUrlProps) {
  const { url } = props

  // init queue
  const queue = new PQueue({
    concurrency: SEOD.config.concurrency,
  })
  PQueueMap.set(url, queue)
  const bar = progressBarMap.get(url)

  const browser = await getBrowser()
  const context = await browser.newContext()
  const page = await context.newPage()

  const homeUrl = url
  siteUrlMap.set(homeUrl, {
    statusCode: 0,
    checkStatus: 'pending',
  })

  bar?.setTotal(siteUrlMap.size)
  await checkSiteUrl(homeUrl, {
    urlItem: props,
    checkNoModule: true,
  })

  await queue.onIdle()
  await page.close()
  await context.close()
}
