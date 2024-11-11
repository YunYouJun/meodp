import type { Page } from 'playwright'
import type { MEODPUrlProps, PageUrlEvent } from '../../types'

import { MEODP } from '../global'
import { LocalLog } from '../logger'

import { progressBarMap } from '../progress'
import { getFormattedDataFromResponse } from './format'

// request
export function registerPageEvents(page: Page, urlItem: MEODPUrlProps) {
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
    if (MEODP.isIgnoredLink(requestUrl)) {
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

    const {
      durationText,
      statusInfo,
      linkText,
    } = getFormattedDataFromResponse(response)

    const info = `  [${statusInfo}] ${durationText} ${linkText}`
    if (response.status() >= 400) {
      MEODP.logger.error(info)
    }
    else {
      MEODP.logger.info(info)
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
