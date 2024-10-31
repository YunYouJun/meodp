export interface SEODConfig {
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
   * @desc 忽略的链接
   * @default []
   * @example ignoreLinks: ['https://www.google.com']
   * 被正则匹配成功或以字符串开头的链接将被忽略
   */
  ignoreLinks?: (string | RegExp)[]
}

export function defineConfig(config: SEODConfig): SEODConfig {
  return config
}
