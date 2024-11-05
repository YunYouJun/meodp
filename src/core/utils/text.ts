import type { SEODUrlItem } from '../../types'

export const emojiMap = {
  site: '🏠',
  link: '🔗',
  sitemap: '📄',
}

/**
 * get SEODUrlItem info
 */
export function getSEODUrlItemInfo(urlItem: SEODUrlItem) {
  const type = typeof urlItem === 'string' ? 'link' : urlItem.type
  const url = typeof urlItem === 'string' ? urlItem : urlItem.url
  const emoji = emojiMap[type] || '🔗'

  return {
    type,
    url,
    emoji,
  }
}
