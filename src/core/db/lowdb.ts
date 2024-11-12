import type { MEODPConfig } from '../../types'
import path from 'node:path'
import process from 'node:process'
import { JSONFilePreset } from 'lowdb/node'
import { defaultMEODPConfig } from '../config'

/**
 * 站点中的链接
 */
export interface MEODPSiteLinkItem {
  url: string
  title?: string
  statusCode: number
  statusText?: string
  checkStatus: 'pending' | 'passed' | 'failed' | 'goto' | 'ignored' | 'timeout'
  /**
   * success requests
   */
  success: number
  /**
   * failed requests
   */
  failed: number
  timeout: number
  /**
   * ignored requests
   */
  ignored: number
  /**
   * duration in ms
   */
  duration: number
  /**
   * total requests
   */
  total: number
  requests: MEODPRequestItem[]
}

export interface MEODPRequestItem {
  /**
   * @desc 是否失败
   */
  failed?: boolean
  /**
   * @desc 是否被忽略
   */
  ignored?: boolean
  url?: string
  statusCode?: number
  statusText?: string
}

export interface MEODPSiteItem {
  /**
   * @desc 站点名称
   */
  name?: string
  /**
   * url 内容为 html 时，将会检查页面上的所有资源
   */
  url: string
  /**
   * @desc 站点标题
   */
  title?: string
  /**
   * site links 站点其他链接
   */
  links: MEODPSiteLinkItem[]
  /**
   * 本次总体检查状态
   */
  checkStatus: 'passed' | 'failed' | 'pending'
  /**
   * all ignored urls
   */
  ignored: string[]
}

export interface DBData {
  config: MEODPConfig
  sites: Record<string, MEODPSiteItem>
}

const defaultData: DBData = {
  config: defaultMEODPConfig,
  sites: {},
}

/**
 * create json db
 */
export async function createLowDB(rootDir = process.cwd()) {
  const dbJsonPath = path.resolve(rootDir, 'logs/meodp/db.json')
  const db = await JSONFilePreset<DBData>(dbJsonPath, defaultData)
  return db
}
