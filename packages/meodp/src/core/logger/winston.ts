import path from 'node:path'
import winston from 'winston'

// for jiti import https://github.com/winstonjs/winston/issues/2430
// import transports from 'winston/lib/winston/transports'
import { MEODP } from '../global'

// dev

/**
 * - winston
 */
export function createWinstonLogger() {
  const allLogPath = path.resolve(MEODP.logFolder, 'all.log')
  const errorLogPath = path.resolve(MEODP.logFolder, 'error.log')

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

  // if (!MEODP.config.log?.file) {
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
    new winston.transports.File({
      filename: errorLogPath,
      level: 'error',
    }),
    new winston.transports.File({
      filename: allLogPath,
      // level: 'info',
    }),
  ]

  // if (MEODP.config.log?.type === 'raw') {
  //   customTransports.unshift(
  //     new winston.transports.Console({}),
  //   )
  // }

  return winston.createLogger({
    level: 'info',
    format: winston.format.combine(...customFormats),
    defaultMeta: { service: 'MEODP' },
    transports: customTransports,
    exitOnError: false,
  })
}
