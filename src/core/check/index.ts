import type { SEODConfig, SEODUrlItem } from '../../types'
import consola from 'consola'
import { colors } from 'consola/utils'
import { multiBar, progressBarMap } from '../progress'
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

  const bar = progressBarMap.get(seodUrl.url)
  bar?.stop()
}
