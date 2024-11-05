import type { SEODUrlProps } from '../../types'
import { lineStart } from 'cilicili'
import consola from 'consola'
import { colors } from 'consola/utils'
import { getBrowser, SEOD } from '../env'
import { progressBarMap } from '../progress'
import { getSEODUrlItemInfo, registerPageEvents } from '../utils'
import { parseUrlMap } from '../utils/parse'
import { checkUrlNomoduleAssets } from './site'

/**
 * check one link
 */
export async function checkLink(urlItem: SEODUrlProps) {
  const browser = await getBrowser()
  const context = await browser.newContext()
  const page = await context.newPage()

  const startTime = Date.now()

  const { url } = urlItem
  const bar = progressBarMap.get(url)

  const urlMap = registerPageEvents(page, urlItem)
  const res = await page.goto(url, {
    waitUntil: 'networkidle',
  }).catch((e) => {
    consola.error(e)
  })

  const isHtml = res?.headers()['content-type'].includes('text/html')
  if (isHtml) {
    const { success, error, total } = parseUrlMap(urlMap)

    const duration = (Date.now() - startTime) / 1000
    const statusCode = res?.status() || 0
    const statusText = res?.statusText()

    SEOD.logger.log(
      lineStart,
      '  ',
      colors.green(`[${statusCode}${statusText ? ` ${statusText}` : ''}]`),
      colors.cyan(url),
      total.text,
      colors.dim(`(in ${duration}s)`),
      success.text,
      error.text,
    )

    bar?.setTotal(urlMap.size)
    bar?.update(success.count)
  }
  else {
    bar?.update(1)
  }

  await checkUrlNomoduleAssets(page)
  await page.close()
  await context.close()
}
