import type { MEODPUrlItem, MEODPUrlProps } from '../../types'
import path from 'node:path'
import process from 'node:process'
import consola from 'consola'
import { formatDate } from 'date-fns'

import fs from 'fs-extra'
import stripAnsi from 'strip-ansi'

export function logUrlItemInfo(urlItem: MEODPUrlItem) {
  consola.info('urlItem', urlItem)
}

export interface LocalLogOptions {
  cwd?: string
  nameRule?: 'timestamp' | 'url'
}

/**
 * @desc 本地日志 instance
 */
export class LocalLog {
  /**
   * 日志根目录
   */
  static rootLogFolder: string
  /**
   * rootLogFolder + yyyy-MM-dd-HH-mm-ss
   */
  static logFolder: string
  /**
   * rootLogFolder + site
   */
  static siteLogFolder: string
  /**
   * link.log
   */
  static linkLogFile: string

  /**
   * 日志命名规则
   * - timestamp: yyyy-MM-dd-HH-mm-ss 每次都会建立一个以时间戳命名的文件夹
   * - url: url 在同一个文件夹下
   */
  static nameRule: 'timestamp' | 'url'

  static options: LocalLogOptions

  constructor(options: LocalLogOptions = {}) {
    LocalLog.options = options
    LocalLog.nameRule = options.nameRule || 'url'
    LocalLog.init(options)
  }

  /**
   * @desc init ensure dir
   */
  static async init(options?: LocalLogOptions) {
    const cwd = options?.cwd || process.cwd()
    LocalLog.rootLogFolder = path.resolve(cwd, 'logs/meodp')
    fs.ensureDirSync(this.rootLogFolder)

    if (LocalLog.nameRule === 'timestamp') {
      const now = formatDate(new Date(), 'yyyy-MM-dd-HH-mm-ss')
      this.logFolder = path.resolve(this.rootLogFolder, now)
    }
    else {
      this.logFolder = path.resolve(this.rootLogFolder)
    }
    fs.ensureDirSync(this.logFolder)
    this.siteLogFolder = path.resolve(this.logFolder, 'site')
    // do not need this, use link.log
    // this.linkLogFolder = path.resolve(this.logFolder, 'link')
    fs.ensureDirSync(this.siteLogFolder)
    // fs.ensureDirSync(this.linkLogFolder)
    this.linkLogFile = path.resolve(this.logFolder, 'link.log')
  }

  /**
   * @desc clean log
   */
  static async clean() {
    await fs.remove(this.rootLogFolder)
  }

  static async log(filePath: string, ...args: any[]) {
    const now = formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss')
    const content = stripAnsi(`${[now, ...args].join(' ')}\n`)
    await fs.appendFile(filePath, content)
  }

  /**
   * @desc append log
   */
  static async SiteLog(urlItem: MEODPUrlProps, ...args: any[]) {
    const logName = (urlItem.name || urlItem.url)
      .replace('https://', '')
      .replace('http://', '')
      .replace(/\//g, '-')
    const logPath = path.resolve(this.logFolder, urlItem.type, `${logName}.log`)
    await LocalLog.log(logPath, ...args)
  }

  /**
   * console link log
   */
  static async linkLog(...args: any[]) {
    await LocalLog.log(this.linkLogFile, ...args)
  }

  static async logByType(urlItem: MEODPUrlProps, ...args: any[]) {
    switch (urlItem.type) {
      case 'site':
        this.SiteLog(urlItem, ...args)
        break
      case 'link':
        this.linkLog(...args)
        break
      default:
        break
    }
  }

  /**
   * @desc create log
   */
  static createLog(urlItem: MEODPUrlProps) {
    return (...args: any[]) => {
      LocalLog.logByType(urlItem, ...args)
    }
  }
}

// init
export const localLog = new LocalLog()
