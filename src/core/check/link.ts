import type { SEODConfig, SEODUrlProps } from '../../types'
import { lineStart } from 'cilicili'
import consola from 'consola'
import { colors } from 'consola/utils'
import { getBrowser } from '../env'
import { progressBarMap } from '../progress'
import { registerPageEvents } from '../utils'
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
    const successCount = Array.from(urlMap.values()).filter(value => value.status && value.status < 400).length
    const errorCount = urlMap.size - successCount
    const timeoutCount = Array.from(urlMap.values()).filter(value => !value.responseTime).length

    const duration = (Date.now() - startTime) / 1000
    const timeoutTxt = timeoutCount ? colors.redBright(colors.redBright(`(🚫 ${timeoutCount} Timeout)`)) : ''
    consola.debug(
      `🔍 ${urlMap.size} Total ${colors.dim(`(in ${duration}s)`)}.`,
      `✅ ${colors.green(`${successCount} OK`)}`,
      `❌ ${colors.red(`${errorCount} Errors`)} ${timeoutTxt}`,
    )

    bar?.setTotal(urlMap.size)
    bar?.update(successCount)
  }
  else {
    bar?.update(1)
  }

  for (const [url, info] of urlMap) {
    if (!info.responseTime) {
      // retry
      try {
        const res = await page.goto(url, {
          waitUntil: 'networkidle',
        })
        const status = res?.status() || 0
        if (status >= 400) {
          console.error(lineStart, `Resource loading error: ${colors.underline(url)}`)
        }
      }
      catch (e) {
        consola.error(e)
        console.error(lineStart, `Resource loading timeout: ${colors.underline(url)}`)
      }
    }
  }
  await checkUrlNomoduleAssets(page)
  await page.close()
  await context.close()
}
