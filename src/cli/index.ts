import type { SEODConfig } from '../types'
import process from 'node:process'
import { loadConfig } from 'c12'

import consola from 'consola'
import { colors } from 'consola/utils'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { runByConfig, SEOD } from '../core'
import { commonOptions } from './options'

// export const __DEV__ = process.env.NODE_ENV === 'development'
export const __DEV__ = false
consola.level = __DEV__ ? 5 : 3

/**
 * @inner
 */
export function debug(name: string, ...args: any[]) {
  consola.debug(colors.dim(name), ...args)
}

export const cli = yargs(hideBin(process.argv))
  .scriptName('seod')
  .usage('$0 检测链接')
  .command(
    '* [root]',
    'Run SEOD to check links',
    args => commonOptions(args),
    async (argv) => {
      debug('argv', argv)
      const { root = process.cwd() } = argv
      const { config, configFile } = await loadConfig<SEODConfig>({
        cwd: root,
        name: 'seod',
      })
      debug('config', config)
      debug('configFile', configFile)

      SEOD.config = config
      SEOD.configFile = configFile || ''

      consola.start('Start checking links...')

      const startTime = Date.now()
      await runByConfig(config)
      const endTime = Date.now()
      const duration = endTime - startTime
      console.log()
      consola.success('Done!', `耗时 ${colors.yellow(duration / 1000)}s`)

      // caused by multiBar?
      process.exit(0)
    },
  )
  .alias('h', 'help')
  .alias('v', 'version')
  .showHelpOnFail(false)
  .help()

export function run() {
  cli.parse()
}
