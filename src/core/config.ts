import type { SEODConfig } from '../types'
import consola from 'consola'
import PQueue from 'p-queue'

import { checkSEODUrl } from './check'
import { getBrowser } from './global/env'
import { multiBar, progressBarMap } from './progress'
import { getSEODUrlItemInfo } from './utils'

export const defaultSEODConfig: SEODConfig = {
  urls: [],
  concurrency: 10,
  log: {
    type: 'raw',
    file: true,
  },
}

export function defineConfig(config: SEODConfig): SEODConfig {
  return config
}

/**
 * 根据配置运行
 */
export async function runByConfig(config: SEODConfig) {
  const { urls, debug } = config
  consola.level = debug ? 5 : 3

  const queue = new PQueue({
    concurrency: config.concurrency,
  })

  // init progress bar
  if (config.log?.type === 'progress') {
    for (const urlItem of urls) {
    // const name = `${emoji}(${colors.yellow(type)}) ${colors.cyan(url)}`

      const { type, url, emoji } = getSEODUrlItemInfo(urlItem)
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
  }

  const browser = await getBrowser()
  for (const urlItem of urls) {
    await queue.add(async () => {
      await checkSEODUrl(urlItem)
    })
  }

  await queue.onIdle()
  if (config.log?.type === 'progress') {
    multiBar.stop()
  }
  await browser.close()
  consola.debug('browser closed')
  return true
}
