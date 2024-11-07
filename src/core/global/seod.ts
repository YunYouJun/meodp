import type { Browser } from 'playwright'
import type { SEODConfig, SEODUrlProps } from '../../types'
import path from 'node:path'
import process from 'node:process'
import { errorStart } from 'cilicili'
import consola from 'consola'
import stripAnsi from 'strip-ansi'
import { createWinstonLogger, levelIcons, LocalLog } from '../logger'
import { formatArgs } from '../utils'

export class SEOD {
  /**
   * global config
   */
  public static config: SEODConfig
  public static configFile: string
  /**
   * browser instance by playwright
   */
  public static browser: Browser
  /**
   * log folder
   * logs/seod/
   */
  public static logFolder: string
  public static logger: {
    _log: (...args: any[]) => void
    start: (...args: any[]) => void
    success: (...args: any[]) => void
    info: (...args: any[]) => void
    warn: (...args: any[]) => void
    error: (...args: any[]) => void
    log: (...args: any[]) => void
  }

  public static wLogger: ReturnType<typeof createWinstonLogger>

  constructor(config: SEODConfig) {
    SEOD.config = config
  }

  public static async init(config: SEODConfig) {
    SEOD.config = config

    if (config.clean) {
      console.log()
      consola.start('Cleaning history log...')
      await LocalLog.clean()
      consola.success('Clean history log.')
      console.log()
    }
    await LocalLog.init()
    SEOD.logFolder = LocalLog.logFolder || path.resolve(process.cwd(), 'logs/seod')
    SEOD.wLogger = createWinstonLogger()

    SEOD.logger = {
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
        SEOD.logger._log(levelIcons.start, content)
      },
      success: (...args: any[]) => {
        const content = formatArgs(args)
        consola.success(content)
        // SEOD.wLogger.info(levelIcons.success, content)
        SEOD.logger._log(levelIcons.success, content)
      },
      info: (...args: any[]) => {
        const content = formatArgs(args)
        consola.info(content)
        // SEOD.wLogger.info(content)
        SEOD.logger._log(levelIcons.info, content)
      },
      warn: (...args: any[]) => {
        const content = formatArgs(args)
        consola.warn(content)
        // SEOD.wLogger.warn(content)
        SEOD.logger._log(levelIcons.warn, content)
      },
      error: (...args: any[]) => {
        const content = formatArgs(args)
        // consola.error(content)
        consola.log(errorStart, content)
        // SEOD.wLogger.error(content)
        SEOD.logger._log(levelIcons.error, content)
      },
    }
  }

  /**
   * filter link by ignoreLinks
   */
  public static isIgnoredLink(link: string) {
    const isIgnoredLinks = SEOD.config.ignoreLinks?.some((ignoreLink) => {
      if (ignoreLink instanceof RegExp) {
        return ignoreLink.test(link)
      }
      else if (link.startsWith(ignoreLink)) {
        return true
      }
      return false
    })
    const isIgnoredExtensions = SEOD.config.ignoreExtensions?.some(ext => link.endsWith(ext))
    return isIgnoredLinks || isIgnoredExtensions
  }

  /**
   * @desc 是否为外链
   */
  public static isExternalLink(url: string, urlItem: SEODUrlProps) {
    return url.startsWith('http') && !url.startsWith(urlItem.url)
  }

  /**
   * @desc 通用日志
   * - 本地日志
   * - winston 日志
   */
  public static log(urlItem: SEODUrlProps, ...args: any[]) {
    SEOD.logger.info(args)
    LocalLog.logByType(urlItem, args.join(' '))
  }
}
