import path from 'node:path'
import { COLORFUL_SYMBOLS } from 'cilicili'
import consola from 'consola'
import stripAnsi from 'strip-ansi'
import { SEOD } from '../global'
import { formatArgs } from '../utils'
import { LocalLog } from './local'

export function createSEODLogger() {
  return {
    _log: (...args: any[]) => {
      const allLogPath = path.resolve(SEOD.logFolder, 'all.log')
      // 移除 ansi color
      LocalLog.log(allLogPath, stripAnsi(args.join(' ')))
    },
    log: (...args: any[]) => {
      const content = formatArgs(args)
      consola.log(content)
      SEOD.logger._log(content)
    },
    start: (...args: any[]) => {
      const content = formatArgs(args)
      consola.start(content)
      // SEOD.wLogger.info(levelIcons.start, content)
      SEOD.logger._log(COLORFUL_SYMBOLS.start, content)
    },
    success: (...args: any[]) => {
      const content = formatArgs(args)
      consola.success(content)
      // SEOD.wLogger.info(levelIcons.success, content)
      SEOD.logger._log(COLORFUL_SYMBOLS.success, content)
    },
    info: (...args: any[]) => {
      const content = formatArgs(args)
      consola.info(content)
      // SEOD.wLogger.info(content)
      SEOD.logger._log(COLORFUL_SYMBOLS.info, content)
    },
    warn: (...args: any[]) => {
      const content = formatArgs(args)
      consola.warn(content)
      // SEOD.wLogger.warn(content)
      SEOD.logger._log(COLORFUL_SYMBOLS.warn, content)
    },
    error: (...args: any[]) => {
      const content = formatArgs(args)
      // consola.error(content)
      consola.log(COLORFUL_SYMBOLS.error, content)
      // SEOD.wLogger.error(content)
      SEOD.logger._log(COLORFUL_SYMBOLS.error, content)
    },
  }
}
