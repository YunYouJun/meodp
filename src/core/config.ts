import type { SEODConfig } from '../types'
import cliProgress from 'cli-progress'
import consola from 'consola'
import { colors } from 'consola/utils'
import PQueue from 'p-queue'

import { checkSEODUrl } from './check'
import { getBrowser } from './env'
import { multiBar, progressBarMap } from './progress'

export const defaultSEODConfig: SEODConfig = {
  urls: [
    'https://www.example.com',
  ],
  concurrency: 5,
}

export function defineConfig(config: SEODConfig): SEODConfig {
  return Object.assign({}, defaultSEODConfig, config)
}

/**
 * 根据配置运行
 */
export async function runByConfig(config: SEODConfig) {
  const { urls } = config

  const queue = new PQueue({
    concurrency: config.concurrency,
  })

  const emojiMap = {
    site: '🏠',
    link: '🔗',
    sitemap: '📄',
  }

  // init progress bar
  for (const urlItem of urls) {
    const type = typeof urlItem === 'string' ? 'link' : urlItem.type
    const url = typeof urlItem === 'string' ? urlItem : urlItem.url
    const emoji = emojiMap[type] || '🔗'
    // const name = `${emoji}(${colors.yellow(type)}) ${colors.cyan(url)}`
    const bar = multiBar.create(1, 0, {
      emoji,
      url,
      type,
      error_count: 0,
    })
    progressBarMap.set(url, bar)
  }
  const curBar = multiBar.create(1, 0, {
    name: 'CURRENT',
  })
  progressBarMap.set('CURRENT', curBar)

  const browser = await getBrowser()
  for (const urlItem of urls) {
    await queue.add(async () => {
      await checkSEODUrl(urlItem)
    })
  }

  await queue.onIdle()
  multiBar.stop()
  await browser.close()
  consola.debug('browser closed')
  return true
}
