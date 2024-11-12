import type { MEODPConfig } from '../types'
import process from 'node:process'
import { loadConfig } from 'c12'

import consola from 'consola'
import { colors } from 'consola/utils'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { defaultMEODPConfig, runByConfig } from '../core'
import { MEODP } from '../core/global'
import { output } from '../core/output'
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
  .scriptName('meodp')
  .usage('$0 检测链接')
  .command(
    '* [root]',
    'Run MEODP to check links',
    args => commonOptions(args),
    async (argv) => {
      debug('argv', argv)
      const { root = process.cwd() } = argv
      const { config, configFile } = await loadConfig<MEODPConfig>({
        cwd: root,
        name: 'meodp',
        defaultConfig: defaultMEODPConfig,
      })
      await MEODP.init(config)

      debug('config', config)
      MEODP.logger.info(`🛠️  Config File: ${configFile}`)

      MEODP.config = config
      MEODP.configFile = configFile || ''

      MEODP.logger.start('🌐 Start checking links...')

      const startTime = Date.now()
      await runByConfig(config)
      const endTime = Date.now()
      const duration = endTime - startTime

      console.log()
      MEODP.logger.success(`All done! in ${colors.yellow(duration / 1000)}s.`)

      console.log()
      consola.start('🚀  Start exporting Markdown Report...')
      await output(argv.type as 'html' | 'md')

      // caused by multiBar?
      process.exit(0)
    },
  )
  .command(
    'export [root]',
    'Export MEODP Report',
    args => commonOptions(args).option('type', {
      alias: 't',
      describe: 'Export type',
      choices: ['html', 'md'],
      default: 'md',
    }),
    async (argv) => {
      // export
      await output(argv.type as 'html' | 'md')
    },
  )
  .alias('h', 'help')
  .alias('v', 'version')
  .showHelpOnFail(false)
  .help()

export function run() {
  cli.parse()
}
