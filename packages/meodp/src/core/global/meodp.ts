import type { Low } from 'lowdb'
import type { Browser } from 'playwright'
import type { MEODPConfig, MEODPUrlProps } from '../../types'
import type { DBData } from '../db'
import path from 'node:path'
import process from 'node:process'
import consola from 'consola'
import { createLowDB } from '../db'
import { createMEODPLogger, createWinstonLogger, LocalLog } from '../logger'

export class MEODP {
  /**
   * global config
   */
  public static config: MEODPConfig
  public static configFile: string
  /**
   * browser instance by playwright
   */
  public static browser: Browser
  /**
   * log folder
   * logs/meodp/
   */
  public static logFolder: string
  public static logger = createMEODPLogger()

  public static wLogger: ReturnType<typeof createWinstonLogger>

  public static db: Low<DBData>

  constructor(config: MEODPConfig) {
    MEODP.config = config
  }

  public static async init(config: MEODPConfig) {
    MEODP.config = config

    if (config.clean) {
      console.log()
      consola.start('Cleaning history log...')
      await LocalLog.clean()
      consola.success('Clean history log.')
      console.log()
    }
    await LocalLog.init()
    MEODP.logFolder = LocalLog.logFolder || path.resolve(process.cwd(), 'logs/meodp')
    MEODP.wLogger = createWinstonLogger()

    // init db
    const db = await createLowDB()
    MEODP.db = db
    await db.update(data => data.config = MEODP.config)
  }

  /**
   * filter link by ignoreLinks
   */
  public static isIgnoredLink(link: string) {
    const isIgnoredLinks = MEODP.config.ignoreLinks?.some((ignoreLink) => {
      if (ignoreLink instanceof RegExp) {
        return ignoreLink.test(link)
      }
      else if (link.startsWith(ignoreLink)) {
        return true
      }
      return false
    })
    const isIgnoredExtensions = MEODP.config.ignoreExtensions?.some(ext => link.endsWith(ext))
    return isIgnoredLinks || isIgnoredExtensions
  }

  /**
   * @desc 是否为外链
   */
  public static isExternalLink(url: string, urlItem: MEODPUrlProps) {
    return url.startsWith('http') && !url.startsWith(urlItem.url)
  }

  /**
   * @desc 通用日志
   * - 本地日志
   * - winston 日志
   */
  public static log(urlItem: MEODPUrlProps, ...args: any[]) {
    MEODP.logger.info(args)
    LocalLog.logByType(urlItem, args.join(' '))
  }
}
