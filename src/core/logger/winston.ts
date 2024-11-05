import path from 'node:path'
import winston from 'winston'

// for jiti import https://github.com/winstonjs/winston/issues/2430
import transports from 'winston/lib/winston/transports'

import { SEOD } from '../env'

// dev

export const levelIcons = {
  start: '◐',
  success: '✔',
  info: 'ℹ',
  warn: '⚠',
  error: '✖',
}

/**
 * - winston
 */
export function createWinstonLogger() {
  const allLogPath = path.resolve(SEOD.logFolder, 'all.log')
  const errorLogPath = path.resolve(SEOD.logFolder, 'error.log')

  const customFormats: winston.Logform.Format[] = [
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    // winston.format.colorize(),
    // winston.format.errors({ stack: true }),
    // winston.format.json(),
    // winston.format.simple(),
    // winston.format.uncolorize(),
  ]

  // if (!SEOD.config.log?.file) {
  //   customFormats.push(
  //     winston.format.colorize(),
  //   )
  // }

  customFormats.push(
    winston.format.printf(({ level, message, timestamp, service }) => {
      const content = [
        timestamp,
        `[${service}]`,
        level.toUpperCase(),
        message,
      ]
      return content.join(' ')
    }),
  )

  const customTransports: winston.transport | winston.transport[] = [
    new transports.File({
      filename: errorLogPath,
      level: 'error',
    }),
    new transports.File({
      filename: allLogPath,
      // level: 'info',
    }),
  ]

  if (SEOD.config.log?.type === 'raw') {
    customTransports.unshift(
      new winston.transports.Console({}),
    )
  }

  return winston.createLogger({
    level: 'info',
    format: winston.format.combine(...customFormats),
    defaultMeta: { service: 'SEOD' },
    transports: customTransports,
    exitOnError: false,
  })
}
