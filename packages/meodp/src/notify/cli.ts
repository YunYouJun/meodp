import type { LinkNotification, NotificationOptions } from './notification'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { readReport } from '../check/report'
import { loadProjectConfig } from '../config/load'
import { createFeishuCard, sendFeishuNotification } from './feishu'
import { createNotification } from './notification'

export async function runNotifyCli(args = process.argv.slice(3)): Promise<number> {
  try {
    const { values } = parseArgs({ args, options: {
      'config': { type: 'string' },
      'channel': { type: 'string' },
      'mode': { type: 'string' },
      'dry-run': { type: 'boolean' },
      'test': { type: 'boolean' },
      'help': { type: 'boolean', short: 'h' },
    } })
    if (values.help) {
      console.log(`Usage: meodp notify [--channel feishu|email] [--mode off|changes|weekly] [--dry-run] [--test]

Read saved reports and send configured notifications. No link scans run.
--config <file> loads meodp.config.ts by default.
--dry-run renders content without credentials or delivery; disabled channels stay disabled.
--test explicitly sends a test using an optional saved snapshot, even if its mode is off.
Exit codes: 0 = sent, previewed or skipped; 2 = configuration or delivery error.`)
      return 0
    }
    if (values.channel && !['feishu', 'email'].includes(values.channel))
      throw new Error('--channel must be feishu or email.')
    const project = await loadProjectConfig(values.config)
    const config = project.config.notify
    if (!config)
      throw new Error('Configure notify in meodp.config.ts before sending notifications.')
    const channels = values.channel ? [values.channel] : ['feishu', 'email'].filter(name => name in config)
    if (values.test && channels.length > 1)
      throw new Error('Choose --channel when testing a config with multiple notification channels.')
    if (!channels.length)
      throw new Error('Configure at least one notification channel.')
    for (const channel of channels) {
      const delivery = channel === 'feishu' ? config.feishu : config.email
      if (!delivery)
        throw new Error(`Configure notify.${channel} before using this channel.`)
      const mode = values.mode ?? delivery.mode ?? 'off'
      if (!['off', 'changes', 'weekly'].includes(mode))
        throw new Error('Notification mode must be off, changes, or weekly.')
      if (mode === 'off' && !values.test) {
        console.log(`${channel}: notifications disabled.`)
        continue
      }
      const report = await readReport(project.path(config.input))
      const previous = config.previousReport ? await readReport(project.path(config.previousReport)) : undefined
      const options: NotificationOptions = { ...config, previousReport: previous, mode: mode as NotificationOptions['mode'] }
      let message: LinkNotification | undefined
      if (values.test) {
        const snapshot = report ?? previous
        message = {
          ...(snapshot ? createNotification(snapshot, { ...options, previousReport: undefined, mode: 'weekly' }) : {}),
          subject: `[${config.title || 'MEODP'}] 通知链路验证`,
          test: true,
          text: `这是一条通知卡片测试。\n发送时间：${new Date().toISOString()}\n下方如有数据，使用的是已保存的历史快照，不代表新检测结果或公开报告已更新。`,
        }
      }
      else {
        if (!report)
          throw new Error('Missing completed report; run meodp check first.')
        message = createNotification(report, options)
      }
      if (!message) {
        console.log(`${channel}: no important changes; notification skipped.`)
        continue
      }
      if (channel === 'feishu') {
        const feishu = { reportUrl: config.reportUrl, runUrl: config.runUrl, timeZone: config.timeZone, maxItems: config.maxItems, ...config.feishu }
        if (values['dry-run'])
          console.log(JSON.stringify(createFeishuCard(message, feishu), null, 2))
        else
          await sendFeishuNotification(message, feishu)
      }
      else if (values['dry-run']) {
        console.log(`${message.subject}\n\n${message.text}`)
      }
      else {
        const { sendEmailNotification } = await import('./email')
        await sendEmailNotification(message, config.email!)
      }
      if (!values['dry-run'])
        console.log(`${channel}: notification accepted.`)
    }
    return 0
  }
  catch (error) {
    console.error(`meodp notify: ${error instanceof Error ? error.message : String(error)}`)
    return 2
  }
}
