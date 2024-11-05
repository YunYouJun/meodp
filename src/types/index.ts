export * from './event'

/**
 * - site: 站点主页链接，将会检查对应的 sitemap
 * - url: 单个页面链接
 * - sitemap: sitemap.xml 链接，将会检查对应的 sitemap 中的链接
 */
export type SEODUrlType = 'site' | 'link' | 'sitemap'

export interface SEODUrlProps {
  /**
   * @desc emoji
   */
  emoji?: string
  /**
   * @desc 日志名称
   */
  name?: string
  /**
   * - site: 站点主页链接，将会检查对应的 sitemap
   * - url: 单个页面链接
   * - sitemap: sitemap.xml 链接，将会检查对应的 sitemap 中的链接
   * @default 'url'
   */
  type: SEODUrlType
  /**
   * url 为 html 时，将会检查页面上的所有资源
   */
  url: string
  /**
   * @desc 站点 Headers
   */
  headers?: Record<string, string> & {
    /**
     * https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Authorization
     * 自定义 authorization 头
     */
    Authorization?: string
  }
}

export type SEODUrlItem = string | SEODUrlProps

export interface SEODConfig {
  /**
   * @desc 是否清理缓存日志
   * @default false
   */
  clean?: boolean
  /**
   * @desc 是否开启 debug 模式
   * @default false
   */
  debug?: boolean
  /**
   * urls
   * 可以是多种类型 @ref SiteUrlConfig
   */
  urls: SEODUrlItem[]

  /**
   * 日志形式
   */
  log?: {
    /**
     * @default 'raw'
     * @desc 日志类型
     * - progress: 进度条
     * - raw: 原始输出
     */
    type: 'progress' | 'raw'
    /**
     * @desc 是否输出到文件
     * @default true
     */
    file?: boolean
  }

  /**
   * @desc 是否检查页面上的资源，包括图片、CSS、JS等
   * @default false
   */
  checkAssets?: boolean
  /**
   * @desc 是否检查外链
   * @default true
   */
  checkExternalLinks?: boolean
  /**
   * @todo
   * @desc 忽略的链接
   * @default []
   * @example ignoreLinks: ['https://www.google.com']
   * 被正则匹配成功或以字符串开头的链接将被忽略
   */
  ignoreLinks?: (string | RegExp)[]

  /**
   * @todo
   * A List of accepted status codes for valid links
   * @default [200, 204, 301, 302, 304]
   */
  acceptedStatusCodes?: number[]
  /**
   * @todo
   * An extra function to determine if an url is valid
   * @default (link: string) => true
   */
  isValidUrl?: (link: string) => boolean

  /**
   * @todo
   * @desc 是否检查 mail 链接
   * @ref https://github.com/reacherhq/check-if-email-exists
   * @default false
   */
  includeMail?: boolean

  /**
   * @todo
   * 重试次数
   * @default 1
   */
  retryTimes?: number

  /**
   * @todo
   * 最大并发数
   * @default 5
   */
  concurrency?: number
}
