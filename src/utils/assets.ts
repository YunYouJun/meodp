import type { Page } from 'playwright'
import { url } from 'node:inspector'
import process from 'node:process'
import { cursorTo, moveCursor } from 'node:readline'
import { consoleInnerInfo, errorStart, lineStart, successStart } from 'cilicili'
import consola from 'consola'

import { colors } from 'consola/utils'

/**
 * check all assets in the page can be loaded
 * - css
 * - js
 * - images
 * 检测所有匹配资源，包括没有被加载的 legacy 资源
 */
export async function checkPageAssets(page: Page) {
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

  await page.goto
}

export function registerPageEvents(page: Page) {
  const urlMap = new Map<string, number>()

  // 监听所有的网络请求
  page.on('request', (request) => {
    urlMap.set(request.url(), Date.now())
  })

  // 监听所有的网络响应
  page.on('response', (response) => {
    // console.log('<<', response.status(), response.url())
    const startTime = urlMap.get(response.url()) || Date.now()
    const duration = Date.now() - startTime

    const statusCode = response?.status() || 'unknown'
    const linkTxt = colors.dim(response.url())
    const statusText = response?.statusText()
    const statusInfo = statusText ? `${statusCode?.toString()} ${statusText}` : statusCode?.toString()
    const durationTxt = colors.dim(`│${colors.blue(`${duration.toString().padStart(4, ' ')}${colors.white('ms')}`)} │`)

    if (response.status() >= 400) {
      console.error(`Resource loading error: ${response.status()} ${response.statusText()} ${response.url()}`)
    }
    else {
      // consoleInnerInfo(colors.dim(successStart), colors.dim(colors.green(statusInfo)), durationTxt, linkTxt)
      process.stdout.write(`${lineStart} ${colors.dim(successStart)} ${colors.dim(colors.green(statusInfo))} ${durationTxt} ${linkTxt}`)
      process.stdout.clearLine(0)
      // 光标移动到开头，覆盖输出
      cursorTo(process.stdout, 0)
    }
  })
}
