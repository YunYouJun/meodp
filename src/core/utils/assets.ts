import type { Page } from 'playwright'
import type { PageUrlEvent, SEODUrlProps } from '../../types'

import consola from 'consola'
import { colors } from 'consola/utils'
import { SEOD } from '../global'
import { LocalLog } from '../logger'

import { progressBarMap } from '../progress'

/**
 * @deprecated use playwright goto instead
 * check all assets in the page can be loaded
 * - css
 * - js
 * - images
 * 检测所有匹配资源，包括没有被加载的 legacy 资源
 */
export async function checkPageAssets(_page: Page) {
  // const cssAndJsLinks = await page.$$eval('link[rel=stylesheet], script', (elements) => {
  //   return elements
  //     .map(element => element.getAttribute('src') || element.getAttribute('href'))
  //     .filter(Boolean)
  // })

  // const pageUrl = page.url()
  // consola.start('Checking assets in page:', colors.cyan(pageUrl))
  // // 并行
  // const loadPromisesArr: any[] = []
  // cssAndJsLinks.forEach((link) => {
  //   loadPromisesArr.push(
  //     (async () => {
  //       console.log('link:', link)
  //       // response
  //       if (!link)
  //         return

  //       if (link.startsWith('//')) {
  //         link = `https:${link}`
  //       }
  //       else if (link.startsWith('/')) {
  //         link = new URL(link, pageUrl).href
  //       }
  //       const startTime = Date.now()
  //       const response = await page.goto(link)
  //       const statusCode = response?.status() || 'unknown'
  //       const linkTxt = colors.dim(link)
  //       const statusText = response?.statusText()
  //       const statusInfo = statusText ? `${statusCode?.toString()} ${statusText}` : statusCode?.toString()

  //       const duration = Date.now() - startTime
  //       // const durationTxt = colors.dim(colors.magenta(`[${duration}ms]`))
  //       // paddingSpace
  //       const durationTxt = colors.dim(`│${colors.blue(`${duration.toString().padStart(4, ' ')}${colors.white('ms')}`)} │`)

  //       if (statusCode !== 200) {
  //         consoleInnerInfo(colors.dim(errorStart), colors.dim(colors.red(statusInfo)), durationTxt, linkTxt)
  //       }
  //       else {
  //         consoleInnerInfo(colors.dim(successStart), colors.dim(colors.green(statusInfo)), durationTxt, linkTxt)
  //       }
  //       return 'done'
  //     })(),
  //   )
  // })
  // console.log('loadPromises:', loadPromisesArr)
  // await Promise.all(loadPromisesArr)

  consola.success(colors.green('All assets checked.'))
}

// request
export function registerPageEvents(page: Page, urlItem: SEODUrlProps) {
  const urlMap = new Map<string, PageUrlEvent>()

  const log = LocalLog.createLog(urlItem)

  // 响应数量
  let respondNum = 0

  // const b = new SingleBar({}, Presets.shades_classic)
  // const curBar = new SingleBar({
  //   format: '   🔗 {bar} {percentage}% | {value}/{total} | {duration_formatted} | {filename}',
  //   // barCompleteChar: '\u2588',
  //   // barIncompleteChar: '\u2591',
  //   hideCursor: true,
  //   clearOnComplete: false,
  // }, Presets.rect)
  const curBar = progressBarMap.get('CURRENT')

  // 监听所有的网络请求
  page.on('request', (request) => {
    if (urlMap.size === 0) {
      curBar?.start(1, 0)
    }

    const requestUrl = request.url()
    if (SEOD.isIgnoredLink(requestUrl)) {
      urlMap.set(requestUrl, {
        ignored: true,
        request,
      })

      return
    }

    if (requestUrl && !urlMap.has(requestUrl)) {
      urlMap.set(requestUrl, {
        request,
      })
    }

    curBar?.setTotal(urlMap.size)
  })

  // 监听所有的网络响应
  page.on('response', (response) => {
    const request = response.request()
    const item = urlMap.get(response.url())

    if (!item || item.ignored) {
      return
    }

    urlMap.set(response.url(), {
      request,
      response,
    })

    const urlInfo = urlMap.get(response.url())
    if (!urlInfo)
      return
    if (urlInfo.response)
      return

    respondNum += 1
    // const duration = urlInfo.responseTime - urlInfo.requestTime
    const duration = request.timing().responseEnd - request.timing().requestStart

    const statusCode = response?.status()
    const linkTxt = colors.dim(response.url())
    const statusText = response?.statusText()
    const statusInfo = statusText ? `${statusCode?.toString()} ${statusText}` : statusCode?.toString()
    const durationTxt = colors.dim(`│${colors.blue(`${duration.toString().padStart(4, ' ')}${colors.white('ms')}`)} │`)

    const info = `  [${statusInfo}] ${durationTxt} ${linkTxt}`
    if (response.status() >= 400) {
      SEOD.logger.error(info)
    }
    else {
      SEOD.logger.info(info)
    }
    log(urlItem.type === 'link' ? info.trim() : info)

    curBar?.update(respondNum, {
      site: urlItem.url,
      url: response.url(),
    })
  })

  page.on('requestfailed', (request) => {
    const url = request.url()
    const urlInfo = urlMap.get(url)
    if (!urlInfo?.ignored) {
      urlMap.set(url, {
        request,
        failed: true,
      })
    }
  })

  return urlMap
}
