import type { CheckReport, LinkTarget } from 'meodp/check'
import type { LinkNotification } from 'meodp/notify'
import type { EmailOptions } from 'meodp/notify/email'
import type { FeishuOptions } from 'meodp/notify/feishu'
import { checkLinks } from 'meodp/check'
import { defineConfig } from 'meodp/config'
import { createNotification } from 'meodp/notify'
import { smtpOptions } from 'meodp/notify/email'
import { createFeishuCard } from 'meodp/notify/feishu'

const targets: LinkTarget[] = []
const report: Promise<CheckReport> = checkLinks(targets, { retries: 0 })
const config = defineConfig({ check: { input: 'links.json', reporter: 'json' } })
const reporter: 'json' = config.check.reporter
const email: EmailOptions = { port: 465 }
const feishu: FeishuOptions = { maxItems: 3 }

async function notificationTypes() {
  const notification: LinkNotification | undefined = createNotification(await report)
  if (notification)
    createFeishuCard(notification, feishu)
  smtpOptions(email)
}

// Ensure declarations still reject invalid options instead of resolving to any.
// @ts-expect-error Unsupported reporter.
defineConfig({ check: { reporter: 'invalid' } })
// @ts-expect-error Retry count must be numeric.
checkLinks(targets, { retries: '0' })

void [reporter, notificationTypes]
