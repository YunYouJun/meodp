import type { Page, Response } from 'playwright'
import type { MEODPUrlProps } from '../../types'
import type { MEODPRequestItem, MEODPSiteLinkItem } from '../db'
import { COLORFUL_SYMBOLS } from 'cilicili'
import consola from 'consola'
import { colors } from 'consola/utils'
import PQueue from 'p-queue'
import { PQueueMap, siteUrlMap } from '../cache'
import { MEODP } from '../global'
import { getBrowser } from '../global/env'
import { LocalLog } from '../logger'
import { progressBarMap } from '../progress'
import { getFormattedDataFromResponse } from '../utils'
import { registerPageEvents } from '../utils/assets'
import { isLink } from '../utils/link'
import { parseUrlMap } from '../utils/parse'

/**
 * 获取站点外链
 */
export async function getSiteLinks(page: Page, options: CheckSiteUrlOptions) {
  const links = await page.$$eval('a', (elements) => {
    return elements
      .map(element => element.getAttribute('href') as string)
      .filter(Boolean)
  })

  /**
   * 过滤 query
   */
  const filterQuery = true

  const filterLinks = links.map((link) => {
    if (!isLink(link)) {
      return false
    }

    const isExternalLink = MEODP.isExternalLink(link, options.urlItem)
    if (!isExternalLink) {
      if (filterQuery) {
        // remove query (env: node) searchParams
        const url = new URL(link, page.url())
        url.search = ''
        return url.toString()
      }
      return link
    }
    else {
      return link
    }
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
      .filter(element => element.getAttribute('nomodule') && element.getAttribute('src'))
      .map(el => el.getAttribute('src'))
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

      const newPage = await context.newPage()
      const response = await newPage.goto(nomoduleUrl)

      if (!response) {
        return
      }
      const {
        statusCode,
        statusInfo,
        linkText,
      } = getFormattedDataFromResponse(response)

      const req = response.request()
      const duration = req.timing().responseEnd - req.timing().requestStart
      // paddingSpace
      const durationTxt = colors.dim(`│${colors.blue(`${duration.toString().padStart(4, ' ')}${colors.white('ms')}`)} │`)

      if (statusCode >= 400) {
        MEODP.logger.inner(' ', COLORFUL_SYMBOLS.error, colors.red(statusInfo), durationTxt, linkText)
      }
      else {
        MEODP.logger.inner(' ', COLORFUL_SYMBOLS.success, colors.green(statusInfo), durationTxt, linkText)
      }
      await newPage.close()

      return statusCode ? (statusCode < 400) : false
    })()
  })
  const results = await Promise.all(loadPromises)
  return results.every(result => result)
}

export interface CheckSiteUrlOptions {
  urlItem: MEODPUrlProps
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

  const isExternalLink = MEODP.isExternalLink(url, options.urlItem)
  const log = LocalLog.createLog(options.urlItem)

  const siteData = MEODP.db.data.sites[options.urlItem.url]!
  const siteLinkItem: MEODPSiteLinkItem = {
    url,
    statusCode: 0,
    checkStatus: 'pending',
    success: 0,
    failed: 0,
    ignored: 0,
    timeout: 0,
    duration: 0,
    total: 0,
    requests: [],
  }

  if (MEODP.isIgnoredLink(url)) {
    // skipped
    siteUrlMap.set(url, {
      statusCode: 0,
      checkStatus: 'ignored',
    })

    MEODP.logger.inner(`${colors.dim(`[Ignored] ${colors.underline(url)}`)}`)

    siteData.ignored.push(url)
    await MEODP.db.write()
    return
  }

  // 不检查外链资源 && 是外链
  if (!MEODP.config.checkExternalLinks && isExternalLink) {
    let res: Response | null = null
    try {
      res = await page.goto(url, {
        waitUntil: 'load',
      })
    }
    catch (e) {
      siteLinkItem.timeout = 1

      MEODP.logger.error(e)
    }

    if (!res)
      return

    const {
      statusCode,
      statusInfoText,
      duration,
      durationText,
    } = getFormattedDataFromResponse(res)
    const checkStatus = statusCode < 400 ? 'passed' : 'failed'

    siteUrlMap.set(url, {
      response: res,
      statusCode,
      checkStatus,
    })
    MEODP.logger.inner(statusInfoText, colors.cyan(url), durationText)

    if (statusCode >= 400) {
      // log to error.log
      MEODP.wLogger.error(`  ${statusInfoText} ${url} ${durationText}`)
    }

    siteLinkItem.statusCode = statusCode
    siteLinkItem.checkStatus = checkStatus
    siteLinkItem.duration = duration
    siteLinkItem.total = 1
    siteLinkItem.success = checkStatus === 'passed' ? 1 : 0
    siteLinkItem.failed = checkStatus === 'failed' ? 1 : 0
    siteLinkItem.requests = []
    siteData.links.push(siteLinkItem)
    await MEODP.db.write()
    return
  }

  const urlMap = registerPageEvents(page, options.urlItem)
  try {
    const res = await page.goto(url, {
      waitUntil: 'networkidle',
    })
    const statusCode = res?.status() || 0
    const statusText = res?.statusText()
    const req = res?.request()
    const duration = Math.round((req?.timing()?.responseEnd || 0) - (req?.timing()?.requestStart || 0))
    siteUrlMap.set(url, {
      response: res,
      statusCode,
      checkStatus: 'goto',
    })

    // parse it after page.goto finished
    const { success, failed, total, ignored, timeout } = parseUrlMap(urlMap)
    siteLinkItem.title = await page.title()
    siteLinkItem.statusCode = statusCode
    siteLinkItem.statusText = statusText
    siteLinkItem.checkStatus = 'goto'
    siteLinkItem.duration = duration
    siteLinkItem.total = total.count
    siteLinkItem.success = success.count
    siteLinkItem.failed = failed.count
    siteLinkItem.timeout = timeout.count
    siteLinkItem.ignored = ignored.count
    siteLinkItem.requests = Array.from(urlMap.values())
      .map((value) => {
        const res = value.response
        return {
          failed: value.failed,
          ignored: value.ignored,
          url: res?.url(),
          statusCode: res?.status(),
          statusText: res?.statusText(),
        } satisfies MEODPRequestItem
      })

    // @TODO log by item
    const logInfo = [
      COLORFUL_SYMBOLS.line,
      '  ',
      colors.green(`[${statusCode}${statusText ? ` ${statusText}` : ''}]`),
      colors.cyan(url),
      colors.dim(`(in ${duration}ms)`),
      total.text,
      success.text,
      failed.text,
      timeout.text,
      ignored.text,
    ]
    MEODP.logger.log(...logInfo)
    log(...logInfo)
    log()

    // 存在错误时，输出到 error.log
    if (failed.count > 0) {
      MEODP.wLogger.error(logInfo.join(' '))
    }

    if (MEODP.config.log?.type === 'progress') {
      bar?.update(success.count, {
        value: colors.green(success.count),
        error_count: failed.count ? colors.red(failed.count) : 0,
      })
    }
  }
  catch (e) {
    MEODP.logger.error(e)
  }

  // @TODO retry

  for (const [url, info] of urlMap) {
    if (!info.response && !info.ignored) {
      MEODP.logger.log(COLORFUL_SYMBOLS.line, '    ', COLORFUL_SYMBOLS.error, colors.red('Timeout:'), colors.underline(url))
      MEODP.wLogger.error(`  Timeout: ${url}`)
      siteLinkItem.checkStatus = 'timeout'
    }
  }

  let noModuleAssetsPassed = true
  if (options.checkNoModule) {
    noModuleAssetsPassed = await checkUrlNomoduleAssets(page)
  }

  // 所有资源加载成功，设置为通过
  const siteUrlItem = siteUrlMap.get(url)
  if (siteUrlItem) {
    const isAllRequestsPassed = siteLinkItem.requests
      .filter(value => !value.ignored)
      .every(value => value.statusCode && value.statusCode < 400)
    if (isAllRequestsPassed && noModuleAssetsPassed) {
      siteUrlItem.checkStatus = 'passed'
      // const successCount = Array.from(siteUrlMap.values()).filter(value => value.checkStatus === 'passed').length
      // bar?.update(successCount)
    }
    else {
      siteUrlItem.checkStatus = 'failed'
    }

    siteLinkItem.checkStatus = siteUrlItem.checkStatus
  }

  siteData.links.push(siteLinkItem)
  await MEODP.db.write()

  // 外链就不继续检查外链的页面链接了
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

  return siteLinkItem
}

/**
 * 检查站点可访问性
 * - 死链
 * - 所有内嵌资源
 */
export async function checkSite(props: MEODPUrlProps) {
  const { url } = props

  // init queue
  const queue = new PQueue({
    concurrency: MEODP.config.concurrency,
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

  await MEODP.db.update((data) => {
    data.sites[homeUrl] = {
      name: props.name,
      url: homeUrl,
      checkStatus: 'pending',
      links: [],
      ignored: [],
    }
  })

  bar?.setTotal(siteUrlMap.size)
  const siteLinkItem = await checkSiteUrl(homeUrl, {
    urlItem: props,
    checkNoModule: true,
  })
  await MEODP.db.update((data) => {
    const siteItem = data.sites[homeUrl]
    siteItem.title = siteLinkItem?.title
    siteItem.checkStatus = siteItem.links.every(link => link.checkStatus === 'passed') ? 'passed' : 'failed'
  })

  await queue.onIdle()
  await page.close()
  await context.close()
}
