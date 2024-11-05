import type { SEODUrlItem, SEODUrlProps } from '../types'
import { emojiMap } from './utils'

export class SEODUrl {
  urlItem: SEODUrlProps

  constructor(options: SEODUrlItem) {
    if (typeof options === 'string') {
      this.urlItem = {
        type: 'link',
        url: options,
      }
    }
    else {
      this.urlItem = options
    }
    this.urlItem.emoji = this.urlItem.emoji || emojiMap[this.urlItem.type] || '🔗'
  }
}
