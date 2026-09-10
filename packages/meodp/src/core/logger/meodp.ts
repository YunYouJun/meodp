import path from 'node:path'
import { COLORFUL_SYMBOLS } from 'cilicili'
import consola from 'consola'
import stripAnsi from 'strip-ansi'
import { MEODP } from '../global'
import { formatArgs } from '../utils'
import { LocalLog } from './local'

export function createMEODPLogger() {
  return {
    _log: (...args: any[]) => {
      const allLogPath = path.resolve(MEODP.logFolder, 'all.log')
      // 移除 ansi color
      LocalLog.log(allLogPath, stripAnsi(args.join(' ')))
    },
    log: (...args: any[]) => {
      const content = formatArgs(args)
      consola.log(content)
      MEODP.logger._log(content)
    },
    inner: (...args: any[]) => {
      const content = formatArgs(args)
      consola.log(COLORFUL_SYMBOLS.line, '  ', content)
      // MEODP.wLogger.info(content)
      MEODP.logger._log(COLORFUL_SYMBOLS.line, '  ', content)
    },
    start: (...args: any[]) => {
      const content = formatArgs(args)
      consola.start(content)
      // MEODP.wLogger.info(levelIcons.start, content)
      MEODP.logger._log(COLORFUL_SYMBOLS.start, content)
    },
    success: (...args: any[]) => {
      const content = formatArgs(args)
      consola.success(content)
      // MEODP.wLogger.info(levelIcons.success, content)
      MEODP.logger._log(COLORFUL_SYMBOLS.success, content)
    },
    info: (...args: any[]) => {
      const content = formatArgs(args)
      consola.info(content)
      // MEODP.wLogger.info(content)
      MEODP.logger._log(COLORFUL_SYMBOLS.info, content)
    },
    warn: (...args: any[]) => {
      const content = formatArgs(args)
      consola.warn(content)
      // MEODP.wLogger.warn(content)
      MEODP.logger._log(COLORFUL_SYMBOLS.warn, content)
    },
    error: (...args: any[]) => {
      const content = formatArgs(args)
      // consola.error(content)
      consola.log(COLORFUL_SYMBOLS.error, content)
      // MEODP.wLogger.error(content)
      MEODP.logger._log(COLORFUL_SYMBOLS.error, content)
      MEODP.wLogger.error(content)
    },
  }
}
