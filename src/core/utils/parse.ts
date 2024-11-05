import type { UrlMap } from '../../types'
import { colors } from 'consola/utils'

/**
 * get info from urlMap
 */
export function parseUrlMap(urlMap: UrlMap) {
  const successCount = Array.from(urlMap.values()).filter(value =>
    value.response && value.response.status() && value.response.status() < 400,
  ).length
  const errorCount = urlMap.size - successCount
  const timeoutCount = Array.from(urlMap.values()).filter(value => !value.response).length
  const timeoutTxt = timeoutCount ? colors.redBright(colors.redBright(`(🚫 ${timeoutCount} Timeout)`)) : ''

  const success = {
    count: successCount,
    text: `✅ ${colors.green(`${successCount} OK`)}`,
  }

  const timeout = {
    count: timeoutCount,
    text: timeoutTxt,
  }

  const error = {
    count: errorCount,
    text: `❌ ${colors.red(`${errorCount} Errors`)} ${timeoutTxt}`,
  }

  // const duration = (Date.now() - startTime) / 1000

  const total = {
    count: urlMap.size,
    text: `${urlMap.size} Total Requests`,
  }

  return {
    success,
    error,
    timeout,
    total,
  }
}
