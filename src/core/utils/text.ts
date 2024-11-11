import type { MEODPUrlItem } from '../../types'

export const emojiMap = {
  site: '🏠',
  link: '🔗',
  sitemap: '📄',
}

/**
 * get MEODPUrlItem info
 */
export function getMEODPUrlItemInfo(urlItem: MEODPUrlItem) {
  const type = typeof urlItem === 'string' ? 'link' : urlItem.type
  const url = typeof urlItem === 'string' ? urlItem : urlItem.url
  const emoji = emojiMap[type] || '🔗'

  return {
    type,
    url,
    emoji,
  }
}
