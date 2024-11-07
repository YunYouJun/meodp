import type { UrlMap } from '../../types'
import { colors } from 'consola/utils'
import { LEVEL_COLORFUL_ICONS } from '../logger'

export interface UrlCategoryInfo {
  count: number
  text: string
}

/**
 * get info from urlMap
 */
export function parseUrlMap(urlMap: UrlMap) {
  const successCount = Array.from(urlMap.values()).filter(value =>
    value.response && value.response.status() && value.response.status() < 400,
  ).length

  const timeoutCount = Array.from(urlMap.values()).filter(value => !value.response && !value.ignored).length
  const timeoutTxt = timeoutCount ? colors.redBright(colors.redBright(`(🚫 ${timeoutCount} Timeout)`)) : ''

  // 失败分为两种，一种是请求超时，一种是请求成功但是状态码大于等于400
  const failedCount = Array.from(urlMap.values()).filter((value) => {
    return value.failed || (value.response && value.response?.status() > 400)
  }).length
  const ignoredCount = Array.from(urlMap.values()).filter(value => value.ignored).length

  const success: UrlCategoryInfo = {
    count: successCount,
    text: `${LEVEL_COLORFUL_ICONS.success} ${colors.green(`${successCount} OK`)}`,
  }

  const timeout: UrlCategoryInfo = {
    count: timeoutCount,
    text: timeoutTxt,
  }

  const failedTxt = `${LEVEL_COLORFUL_ICONS.error} ${failedCount} Failed`
  const failed: UrlCategoryInfo = {
    count: failedCount,
    text: `${failedCount ? colors.red(failedTxt) : colors.dim(failedTxt)}`,
  }

  const ignored: UrlCategoryInfo = {
    count: ignoredCount,
    text: colors.dim(`👻 ${ignoredCount} Ignored`),
  }

  const total = {
    count: urlMap.size,
    text: `${urlMap.size} Total Requests`,
  }

  return {
    success,
    failed,
    /**
     * Ignored links, controlled by `ignoreLinks` and `ignoreExtensions`
     */
    ignored,
    timeout,
    total,
  }
}
