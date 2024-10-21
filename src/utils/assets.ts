import type { Page } from 'playwright'
import { consoleInnerInfo, errorStart, successStart } from 'cilicili'
import consola from 'consola'
import { colors } from 'consola/utils'

/**
 * check all assets in the page can be loaded
 * - css
 * - js
 * - images
 */
export async function checkPageAssets(page: Page) {
  const cssAndJsLinks = await page.$$eval('link[rel=stylesheet], script', elements =>
    elements.map(element => element.getAttribute('src') || element.getAttribute('href')))

  const pageUrl = page.url()
  consola.start('Checking assets in page:', colors.cyan(pageUrl))

  for (let link of cssAndJsLinks) {
    // response
    if (!link)
      continue

    if (link.startsWith('//')) {
      link = `https:${link}`
    }
    else if (link.startsWith('/')) {
      link = new URL(link, pageUrl).href
    }
    const startTime = Date.now()
    const response = await page.goto(link)
    const statusCode = response?.status() || 'unknown'
    const linkTxt = colors.dim(link)
    const statusText = response?.statusText()
    const statusInfo = statusText ? `${statusCode?.toString()} ${statusText}` : statusCode?.toString()

    const duration = Date.now() - startTime
    // const durationTxt = colors.dim(colors.magenta(`[${duration}ms]`))
    // paddingSpace
    const durationTxt = colors.dim(`│${colors.blue(`${duration.toString().padStart(4, ' ')}${colors.white('ms')}`)} │`)

    if (statusCode !== 200) {
      consoleInnerInfo(colors.dim(errorStart), colors.dim(colors.red(statusInfo)), durationTxt, linkTxt)
    }
    else {
      consoleInnerInfo(colors.dim(successStart), colors.dim(colors.green(statusInfo)), durationTxt, linkTxt)
    }
  }
  consola.success(colors.green('All assets checked.'))
}
