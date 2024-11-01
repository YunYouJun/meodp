import type { SEODUrlItem } from '../../types'
import path from 'node:path'
import process from 'node:process'
import consola from 'consola'
import { formatDate } from 'date-fns'

import fs from 'fs-extra'

export function logUrlItemInfo(urlItem: SEODUrlItem) {
  consola.info('urlItem', urlItem)
}

/**
 * @desc 本地日志
 */
export class LocalLog {
  rootLogFolder: string
  /**
   * rootLogFolder + yyyy-MM-dd HH:mm:ss
   */
  logFolder: string

  constructor(options: {
    cwd: string
  }) {
    const cwd = options.cwd || process.cwd()
    this.rootLogFolder = path.resolve(cwd, 'logs/seod')
    fs.ensureDirSync(this.rootLogFolder)

    const now = formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss')
    this.logFolder = path.resolve(this.rootLogFolder, now)
    fs.emptyDirSync(this.logFolder)
  }

  /**
   * @desc append log
   */
  async log(logName: string, content: string) {
    const logPath = path.resolve(this.logFolder, `${logName}.log`)
    await fs.appendFile(logPath, content)
  }
}
