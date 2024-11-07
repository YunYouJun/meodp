import type { Request, Response } from 'playwright'

export interface PageUrlEvent {
  /**
   * @desc 是否被忽略
   */
  ignored?: boolean
  request: Request
  response?: Response
  /**
   * @desc 是否失败
   */
  failed?: boolean
}

export type UrlMap = Map<string, PageUrlEvent>
