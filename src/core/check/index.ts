import type { MEODPUrlItem } from '../../types'
import { colors } from 'consola/utils'
import { MEODP } from '../global'
import { progressBarMap } from '../progress'
import { getMEODPUrlItemInfo } from '../utils'
import { checkLink } from './link'
import { checkSite } from './site'
// import { checkSiteMap } from './sitemap'

export * from './link'
export * from './site'
export * from './sitemap'

/**
 * @desc 检查 MEODP 链接
 */
export async function checkMEODPUrl(meodpUrl: MEODPUrlItem) {
  if (typeof meodpUrl === 'string') {
    meodpUrl = {
      type: 'link',
      url: meodpUrl,
    }
  }

  const { type, url, emoji } = getMEODPUrlItemInfo(meodpUrl)
  MEODP.logger.log()
  MEODP.logger.start(`${emoji} ${colors.yellow(`[${type}]`)} ${colors.cyan(url)}`)
  // meodpUrl

  const startTime = Date.now()

  if (typeof meodpUrl === 'object') {
    switch (meodpUrl.type) {
      case 'site':
        await checkSite(meodpUrl)
        break
      case 'link':
        await checkLink(meodpUrl)
        break
      case 'sitemap':
        // await checkSiteMap(meodpUrl)
        break
      default:
        break
    }
  }

  const duration = Date.now() - startTime

  const bar = progressBarMap.get(meodpUrl.url)
  bar?.stop()

  MEODP.logger.success(`🕷️  ${colors.greenBright('[DONE]')} ${colors.gray('in')} ${duration / 1000}s.`)
}
