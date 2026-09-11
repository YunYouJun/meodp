import type { CheckReport, LinkObservation } from '../check/types'

export type NotificationKind = 'unavailable' | 'restricted' | 'failure-threshold' | 'recovered' | 'restriction-lifted'

export interface NotificationEntry {
  kind: NotificationKind
  item: LinkObservation
  reason: string
}

export interface LinkNotification {
  subject: string
  text: string
  test?: boolean
  report?: Pick<CheckReport, 'summary' | 'completedAt' | 'observer'>
  entries?: NotificationEntry[]
}

const labels = { reachable: '可访问', restricted: '访问受限', unavailable: '本次不可访问' }
const singleLine = (value: unknown) => String(value).replace(/[\r\n]+/g, ' ')

export interface NotificationOptions {
  previousReport?: CheckReport
  mode?: 'off' | 'changes' | 'weekly'
  failureThreshold?: number
  observerMismatch?: 'error' | 'reset'
  title?: string
  reportUrl?: string
  runUrl?: string
}

export function createNotification(report: CheckReport, options: NotificationOptions = {}): LinkNotification | undefined {
  const { previousReport: previous, mode = 'changes', failureThreshold = 2, observerMismatch = 'error', title = 'MEODP', reportUrl, runUrl } = options
  if (mode === 'off')
    return undefined
  if (!Number.isSafeInteger(failureThreshold) || failureThreshold < 1)
    throw new Error('failureThreshold must be a positive integer.')
  if (previous && previous.observer !== report.observer && observerMismatch !== 'reset')
    throw new Error('Previous report belongs to another observer; choose observerMismatch: reset to start a new baseline.')
  if (!['changes', 'weekly'].includes(mode))
    throw new Error('Notification mode must be off, changes, or weekly.')

  if (!['error', 'reset'].includes(observerMismatch))
    throw new Error('observerMismatch must be error or reset.')
  const oldResults = new Map((previous?.observer === report.observer ? previous.results : []).map(item => [item.url, item]))
  const changes: NotificationEntry[] = []
  for (const item of report.results) {
    const old = oldResults.get(item.url)
    let kind: NotificationKind | undefined
    if (item.status === 'unavailable' && old?.status !== 'unavailable')
      kind = 'unavailable'
    else if (item.status === 'unavailable' && item.consecutiveFailures >= failureThreshold && old && old.consecutiveFailures < failureThreshold)
      kind = 'failure-threshold'
    else if (item.status === 'restricted' && old?.status !== 'restricted')
      kind = 'restricted'
    else if (item.status === 'reachable' && old?.status === 'unavailable')
      kind = 'recovered'
    else if (item.status === 'reachable' && old?.status === 'restricted')
      kind = 'restriction-lifted'

    if (kind) {
      const reasons = { 'unavailable': '新增不可访问', 'restricted': '新增访问限制', 'failure-threshold': `连续 ${failureThreshold} 次检测失败`, 'recovered': '恢复访问', 'restriction-lifted': '访问限制解除' }
      changes.push({ item, kind, reason: reasons[kind] })
    }
  }

  if (mode === 'changes' && !changes.length)
    return undefined

  const { total, reachable, restricted, unavailable } = report.summary
  const entries: NotificationEntry[] = mode === 'changes'
    ? changes
    : report.results.filter(item => item.status !== 'reachable').map(item => ({ item, kind: item.status === 'restricted' ? 'restricted' : 'unavailable', reason: labels[item.status] }))
  const lines = [
    `检测时间：${report.completedAt}`,
    `检测环境：${singleLine(report.observer)}`,
    `共 ${total} 个站点：${reachable} 可访问，${restricted} 访问受限，${unavailable} 本次不可访问。`,
    '',
    ...entries.map(({ item, reason }) => `- ${reason}：${singleLine(item.name || item.url)}\n  ${item.url}\n  HTTP / 原因：${item.httpStatus ?? item.reason ?? '—'}；连续失败 ${item.consecutiveFailures} 次`),
  ]
  if (mode === 'weekly') {
    const recovered = changes.filter(({ kind }) => kind === 'recovered' || kind === 'restriction-lifted')
    lines.push(...recovered.map(({ item, reason }) => `- ${reason}：${singleLine(item.name || item.url)} ${item.url}`))
    entries.push(...recovered)
  }
  lines.push('', ...(reportUrl ? [`状态页：${reportUrl}`] : []), ...(runUrl ? [`本次运行与报告附件：${runUrl}`] : []), '', '访问受限不等于失效；连续失败次数是独立观测，不代表期间持续宕机。')
  return {
    subject: mode === 'weekly' ? `[${singleLine(title)}] 每周链接检测摘要` : `[${singleLine(title)}] ${changes.length} 项链接状态变化`,
    text: lines.join('\n'),
    report,
    entries,
  }
}
