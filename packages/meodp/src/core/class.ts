import type { MEODPUrlItem, MEODPUrlProps } from '../types'
import { emojiMap } from './utils'

export class MEODPUrl {
  urlItem: MEODPUrlProps

  constructor(options: MEODPUrlItem) {
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
