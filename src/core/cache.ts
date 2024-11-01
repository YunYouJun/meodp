import type PQueue from 'p-queue'

// global cache
/**
 * 只检查内部链接
 */
export const siteUrlMap = new Map<string, {
  /**
   * 状态码
   */
  statusCode: number
  /**
   * 检查状态
   */
  checkStatus: 'pending' | 'passed' | 'failed' | 'goto'
}>()

/**
 * site p-queue
 */
export const PQueueMap = new Map<string, PQueue<any>>()
