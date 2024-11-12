import type PQueue from 'p-queue'
import type { Response } from 'playwright'

// global cache
/**
 * 只检查内部链接
 */
export const siteUrlMap = new Map<string, {
  response?: Response | null
  /**
   * 状态码
   */
  statusCode: number
  /**
   * 检查状态
   */
  checkStatus: 'pending' | 'passed' | 'failed' | 'goto' | 'ignored'
}>()

/**
 * site p-queue
 */
export const PQueueMap = new Map<string, PQueue<any>>()
