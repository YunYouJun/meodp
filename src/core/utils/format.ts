import type { Response } from 'playwright'
import { colors } from 'consola/utils'

export function formatArgs(args: any[]) {
  return args.join(' ')
}

/**
 * get formatted data from response
 */
export function getFormattedDataFromResponse(res: Response) {
  const statusCode = res?.status()
  const statusText = res?.statusText()
  const statusInfo = statusText ? `${statusCode?.toString()} ${statusText}` : statusCode?.toString()

  const req = res.request()
  const duration = req.timing().responseEnd - req.timing().requestStart
  const durationText = colors.dim(`│${colors.blue(`${duration.toString().padStart(4, ' ')}${colors.white('ms')}`)} │`)

  return {
    duration,
    durationText,

    statusCode,
    statusText,
    statusInfo,

    linkText: colors.dim(res.url()),
  }
}
