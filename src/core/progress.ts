import cliProgress from 'cli-progress'
// @ts-expect-error options
// eslint-disable-next-line import/no-named-default
import { default as Options } from 'cli-progress/lib/options.js'
// @ts-expect-error formatBar
// eslint-disable-next-line import/no-named-default
import { default as _defaultFormatBar } from 'cli-progress/lib/format-bar.js'
// @ts-expect-error formatTime
// eslint-disable-next-line import/no-named-default
import { default as _defaultFormatTime } from 'cli-progress/lib/format-time.js'
import consola from 'consola'
import { colors } from 'consola/utils'

const formatter: cliProgress.GenericFormatter = (options, params, payload) => {
  const { value, total } = params
  // bar grows dynamically by current progress - no whitespaces are added
  // const bar = options.barCompleteString.substr(0, Math.round(params.progress * options.barsize))

  const formatTime = options.formatTime || _defaultFormatTime
  const formatBar = options.formatBar || _defaultFormatBar
  const bar = formatBar(params.progress, options)

  // bar stopped and stopTime set ?
  const stopTime = params.stopTime || Date.now()
  // calculate elapsed time
  const elapsedTime = Math.round((stopTime - params.startTime) / 1000)
  const duration_formatted = formatTime(elapsedTime, options, 1)
  consola.debug(duration_formatted)

  if (!payload.type) {
    options = Object.assign({}, options, cliProgress.Presets.rect)
    Options.assignDerivedOptions(options)
    const bar = formatBar(params.progress, options)
    const { site } = payload
    const url = (payload.url || '')
    return `${bar} ${value}/${total} | ${colors.yellow(site || 'MEODP Item')} | ${colors.cyan(url || 'URL')}`
  }
  else {
    const { error_count, emoji, url, type } = payload
    const errorInfo = error_count ? `❌${error_count} ` : ''
    return `${bar} ✅${colors.green(value)}/${total} ${errorInfo}| ${duration_formatted} | ${emoji} ${colors.yellow(type)} | ${colors.cyan(url)}`
  }
}

export const multiBar = new cliProgress.MultiBar({
  hideCursor: true,
  // format: '{bar} {percentage}% | ✅{value}/{total} ❌{error_count} | {duration_formatted} | {name}',
  format: formatter,
  barsize: 20,
  autopadding: true,
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',

  // important! redraw everything to avoid "empty" completed bars
  forceRedraw: true,
}, cliProgress.Presets.rect)

/**
 * Progress bar map
 * created by multiBar.create
 */
export const progressBarMap = new Map<string, cliProgress.SingleBar>()
