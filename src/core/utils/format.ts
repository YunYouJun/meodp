import type { Response } from 'playwright'
import { COLORFUL_SYMBOLS } from 'cilicili'
import { type ColorFunction, colors } from 'consola/utils'

export function formatArgs(args: any[]) {
  return args.join(' ')
}

type LoadTimeType = 'fast' | 'medium' | 'slow'
const TIME_COLOR: Record<LoadTimeType, ColorFunction> = {
  fast: colors.green,
  medium: colors.yellow,
  slow: colors.red,
}

export function getFormattedDuration(duration: number) {
  const durationText = `${(Math.round(duration) / 1000).toString()}s`
  let type: LoadTimeType
  if (duration < 500) {
    type = 'fast'
  }
  else if (duration < 3000) {
    type = 'medium'
  }
  else {
    type = 'slow'
  }
  return TIME_COLOR[type](durationText)
}

/**
 * get formatted data from response
 */
export function getFormattedDataFromResponse(res: Response) {
  const statusCode = res?.status()
  const statusText = res?.statusText()
  const statusInfo = statusText ? `${statusCode?.toString()} ${statusText}` : statusCode?.toString()
  const statusInfoText = statusCode >= 400 ? colors.red(`[${statusInfo}]`) : colors.green(`[${statusInfo}]`)

  const req = res.request()
  const duration = req.timing().responseEnd - req.timing().requestStart
  const durationText = `${COLORFUL_SYMBOLS.line} ${getFormattedDuration(duration)} ${COLORFUL_SYMBOLS.line}`

  return {
    duration,
    durationText,

    statusCode,
    statusText,
    statusInfo,
    statusInfoText,

    linkText: colors.dim(res.url()),
  }
}
