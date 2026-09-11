import type { LinkNotification } from './notification'

export interface EmailOptions {
  host?: string
  port?: number
  user?: string
  password?: string
  from?: string
  to?: string
}

export function smtpOptions(options: EmailOptions) {
  for (const key of ['host', 'user', 'password', 'from', 'to'] as const) {
    if (!options[key]?.trim())
      throw new Error(`Missing email.${key}; configure SMTP before enabling email.`)
  }
  const port = options.port ?? 465
  if (![465, 587].includes(port))
    throw new Error('Email port must be 465 (TLS) or 587 (STARTTLS).')
  return {
    host: options.host,
    port,
    secure: port === 465,
    requireTLS: true,
    auth: { user: options.user, pass: options.password },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    disableFileAccess: true,
    disableUrlAccess: true,
  }
}

export async function sendEmailNotification(message: LinkNotification, options: EmailOptions) {
  const connection = smtpOptions(options)
  const { default: nodemailer } = await import('nodemailer')
  const transport = nodemailer.createTransport(connection)
  try {
    const result = await transport.sendMail({ subject: message.subject, text: message.text, from: options.from, to: options.to })
    if (result.rejected.length)
      throw new Error('SMTP rejected one or more recipients.')
  }
  finally {
    transport.close()
  }
}
