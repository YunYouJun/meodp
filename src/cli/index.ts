import process from 'node:process'
import { loadConfig, watchConfig } from 'c12'
import consola from 'consola'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { commonOptions } from './options'

consola.level = process.env.NODE_ENV === 'development' ? 5 : 3

export const cli = yargs(hideBin(process.argv))
  .scriptName('seod')
  .usage('$0 检测链接')
  .command(
    '* [root]',
    'Run SEOD to check links',
    args => commonOptions(args),
    async (argv) => {
      consola.debug('argv', argv)
      const { root = process.cwd() } = argv
      const { config, configFile } = await loadConfig({
        cwd: root,
      })
      console.debug(config, configFile)
    },
  )
  .alias('h', 'help')
  .alias('v', 'version')
  .help()

export function run() {
  cli.parse()
}
