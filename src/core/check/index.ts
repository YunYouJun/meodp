import type { SEODUrlItem } from '../../types'
import { colors } from 'consola/utils'
import { SEOD } from '../env'
import { progressBarMap } from '../progress'
import { getSEODUrlItemInfo } from '../utils'
import { checkLink } from './link'
import { checkSite } from './site'
// import { checkSiteMap } from './sitemap'

export * from './link'
export * from './site'
export * from './sitemap'

/**
 * @desc 检查 SEOD 链接
 */
export async function checkSEODUrl(seodUrl: SEODUrlItem) {
  if (typeof seodUrl === 'string') {
    seodUrl = {
      type: 'link',
      url: seodUrl,
    }
  }

  const { type, url, emoji } = getSEODUrlItemInfo(seodUrl)
  SEOD.logger.log()
  SEOD.logger.start(`${emoji} ${colors.yellow(`[${type}]`)} ${colors.cyan(url)}`)
  // seodUrl

  const startTime = Date.now()

  if (typeof seodUrl === 'object') {
    switch (seodUrl.type) {
      case 'site':
        await checkSite(seodUrl)
        break
      case 'link':
        await checkLink(seodUrl)
        break
      case 'sitemap':
        // await checkSiteMap(seodUrl)
        break
      default:
        break
    }
  }

  const duration = Date.now() - startTime

  const bar = progressBarMap.get(seodUrl.url)
  bar?.stop()

  SEOD.logger.success(`Done in ${duration / 1000}s.`)
}
