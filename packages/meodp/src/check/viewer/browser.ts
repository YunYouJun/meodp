import type { CheckReport, LinkObservation } from '../types'
import { parseReport } from '../schema'

type Filter = 'all' | 'unavailable' | 'restricted' | 'reachable' | 'redirected' | 'recovered'
const labels = { reachable: '可访问', restricted: '访问受限', unavailable: '暂不可达', redirected: '有跳转', recovered: '已恢复', all: '全部' }
const reasons = { http: 'HTTP', dns: 'DNS', tls: 'TLS', timeout: '超时', network: '网络错误', redirect: '跳转异常' }
const pageSize = 20
const maxBytes = 10 * 1024 * 1024
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const dialog = element<HTMLDialogElement>('import-dialog')
const search = element<HTMLInputElement>('search')
const sort = element<HTMLSelectElement>('sort')
const rows = element<HTMLTableSectionElement>('rows')
const urlInput = element<HTMLInputElement>('data-url')
const fileInput = element<HTMLInputElement>('file')
let report: CheckReport | undefined
let filter: Filter = 'all'
let page = 0
let loadRevision = 0

function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) {
  const result = document.createElement(tag)
  if (text !== undefined)
    result.textContent = text
  if (className)
    result.className = className
  return result
}

function date(value?: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'
}

function duration(value: number) {
  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(1)} s`
}

function message(text = '', error = false) {
  const target = element('message')
  target.textContent = text
  target.hidden = !text
  target.className = error ? 'error-message' : 'info-message'
}

function link(url: string, text = url) {
  const anchor = node('a', text)
  anchor.href = url
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  return anchor
}

function renderOverview() {
  const summary = report?.summary
  const metrics = element('metrics')
  metrics.replaceChildren()
  for (const key of ['all', 'reachable', 'restricted', 'unavailable'] as const) {
    const item = node('div', undefined, `metric ${key}`)
    item.append(node('span', key === 'all' ? '全部站点' : labels[key]), node('strong', String(summary ? summary[key === 'all' ? 'total' : key] : '—')))
    metrics.append(item)
  }
  const distribution = element('distribution')
  distribution.replaceChildren()
  if (summary?.total) {
    for (const key of ['reachable', 'restricted', 'unavailable'] as const) {
      const segment = node('span', undefined, key)
      segment.style.width = `${summary[key] / summary.total * 100}%`
      distribution.append(segment)
    }
  }
  element('metadata').textContent = report ? `${date(report.completedAt)} · ${report.observer}` : '加载检测数据，查看站点可访问性。'
  element<HTMLButtonElement>('download').disabled = !report
}

function renderFilters() {
  const filters = element('filters')
  filters.replaceChildren()
  const keys: Filter[] = ['all', 'unavailable', 'restricted', 'reachable', 'redirected']
  if (report?.summary.recovered)
    keys.push('recovered')
  for (const key of keys) {
    const count = report?.summary[key === 'all' ? 'total' : key] ?? 0
    const button = node('button', undefined, filter === key ? 'selected' : '')
    button.type = 'button'
    button.dataset.filter = key
    button.setAttribute('aria-pressed', String(filter === key))
    button.append(node('span', labels[key]), node('span', String(count), 'filter-count'))
    button.addEventListener('click', () => {
      filter = key
      page = 0
      renderFilters()
      renderResults()
      element<HTMLButtonElement>('filters').querySelector<HTMLButtonElement>(`[data-filter="${key}"]`)?.focus()
    })
    filters.append(button)
  }
}

function details(item: LinkObservation) {
  const body = node('div', undefined, 'detail-body')
  body.append(node('h3', '检测详情'))
  const facts = node('dl', undefined, 'facts')
  const entries = [
    ['连续失败', `${item.consecutiveFailures} 次`],
    ['请求尝试', `${item.attempts} 次`],
    ['最后成功', date(item.lastSuccessAt)],
    ['首次连续失败', date(item.firstFailureAt)],
    ['检测时间', date(item.checkedAt)],
    ['耗时', duration(item.durationMs)],
    ['HTTP / 原因', String(item.httpStatus ?? (item.reason ? reasons[item.reason] : '—'))],
    ['状态变化', item.recovered ? '本次恢复访问' : item.changed ? '状态或最终 URL 已变化' : '无变化'],
  ]
  for (const [name, value] of entries) {
    const pair = node('div')
    pair.append(node('dt', name), node('dd', value))
    facts.append(pair)
  }
  body.append(facts)
  if (item.detail) {
    body.append(node('h4', '错误信息'), node('pre', item.detail))
  }
  body.append(node('h4', '最终 URL'), link(item.finalUrl))
  if (item.redirects.length) {
    body.append(node('h4', '跳转链'))
    const chain = node('ol', undefined, 'redirect-chain')
    for (const hop of item.redirects) {
      const row = node('li')
      // Location may contain an invalid redirect; show it as text, never a link.
      row.append(node('strong', String(hop.status)), node('span', `${hop.url} → ${hop.location}`))
      chain.append(row)
    }
    body.append(chain)
  }
  return body
}

function resultRow(item: LinkObservation, index: number) {
  const row = node('tr', undefined, 'result-row')
  const site = node('td', undefined, 'site')
  site.append(link(item.url, item.name || new URL(item.url).hostname), node('span', item.url, 'site-url'))
  const status = node('td')
  status.append(node('span', labels[item.status], `status ${item.status}`))
  if (item.redirects.length)
    status.append(node('span', `${item.redirects.length} 次跳转`, 'row-note'))
  if (item.recovered)
    status.append(node('span', '本次恢复', 'row-note'))
  const detailCell = node('td', undefined, 'detail-toggle')
  const toggle = node('button', '›')
  toggle.type = 'button'
  toggle.setAttribute('aria-label', `查看 ${item.name || item.url} 的检测详情`)
  toggle.setAttribute('aria-expanded', 'false')
  toggle.setAttribute('aria-controls', `detail-${index}`)
  const detailRow = node('tr', undefined, 'detail-row')
  detailRow.hidden = true
  detailRow.id = `detail-${index}`
  const expanded = node('td')
  expanded.colSpan = 5
  detailRow.append(expanded)
  toggle.addEventListener('click', () => {
    detailRow.hidden = !detailRow.hidden
    toggle.setAttribute('aria-expanded', String(!detailRow.hidden))
    row.classList.toggle('expanded', !detailRow.hidden)
    if (!detailRow.hidden && !expanded.childNodes.length)
      expanded.append(details(item))
  })
  detailCell.append(toggle)
  row.append(site, status, node('td', String(item.httpStatus ?? (item.reason ? reasons[item.reason] : '—')), 'technical'), node('td', duration(item.durationMs), 'technical'), detailCell)
  return [row, detailRow]
}

function renderResults() {
  const query = search.value.trim().toLocaleLowerCase()
  const matches = (report?.results ?? []).filter((item) => {
    const statusMatches = filter === 'all' || (filter === 'redirected' ? item.redirects.length > 0 : filter === 'recovered' ? item.recovered : item.status === filter)
    return statusMatches && `${item.name ?? ''} ${item.url} ${item.finalUrl}`.toLocaleLowerCase().includes(query)
  })
  const severity = { unavailable: 0, restricted: 1, reachable: 2 }
  if (sort.value === 'severity')
    matches.sort((a, b) => severity[a.status] - severity[b.status])
  if (sort.value === 'duration')
    matches.sort((a, b) => b.durationMs - a.durationMs)
  if (sort.value === 'failures')
    matches.sort((a, b) => b.consecutiveFailures - a.consecutiveFailures)
  if (sort.value === 'name')
    matches.sort((a, b) => (a.name || a.url).localeCompare(b.name || b.url, 'zh-CN'))
  page = Math.max(0, Math.min(page, Math.ceil(matches.length / pageSize) - 1))
  const start = page * pageSize
  rows.replaceChildren(...matches.slice(start, start + pageSize).flatMap((item, index) => resultRow(item, start + index)))
  element('table').hidden = !matches.length
  const empty = element('empty')
  empty.hidden = matches.length > 0
  if (report)
    empty.replaceChildren(node('strong', report.results.length ? '没有匹配的站点' : '这份报告中没有站点'), node('span', report.results.length ? '试试其他关键词或状态筛选。' : '加载其他报告以查看检测结果。'))
  element('result-count').textContent = `显示 ${matches.length ? start + 1 : 0}–${Math.min(start + pageSize, matches.length)}，共 ${matches.length} 个站点`
  element<HTMLButtonElement>('previous').disabled = page === 0
  element<HTMLButtonElement>('next').disabled = start + pageSize >= matches.length
}

function accept(data: unknown) {
  const next = parseReport(data)
  if (next.results.length > 50000)
    throw new Error('报告超过 50,000 个站点，请拆分后加载。')
  report = next
  filter = 'all'
  page = 0
  search.value = ''
  sort.value = 'original'
  renderOverview()
  renderFilters()
  renderResults()
}

function failure(error: unknown) {
  message(`加载失败：${error instanceof Error ? error.message : String(error)}。${report ? '已保留当前报告。' : ''}`, true)
}

async function loadFile(file: File) {
  const revision = ++loadRevision
  dialog.close()
  try {
    if (file.size > maxBytes)
      throw new Error('JSON 文件不能超过 10 MiB')
    const text = await file.text()
    if (revision !== loadRevision)
      return
    accept(JSON.parse(text))
    message(`已加载 ${file.name}`)
  }
  catch (error) {
    if (revision === loadRevision)
      failure(error)
  }
  fileInput.value = ''
}

async function loadUrl(source: string, automatic = false) {
  const revision = ++loadRevision
  dialog.close()
  if (!automatic || !report)
    message('正在加载报告数据…')
  try {
    const url = new URL(source, window.location.href)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw new Error('请使用不含账号密码的 HTTP(S) 数据 URL；本地报告可选择文件加载')
    const response = await fetch(url, { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(15000), referrerPolicy: 'no-referrer' })
    if (!response.ok)
      throw new Error(`HTTP ${response.status}`)
    if (!response.body)
      throw new Error('数据为空')
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new Error('JSON 文件不能超过 10 MiB')
      }
      chunks.push(value)
    }
    const text = await new Blob(chunks).text()
    if (revision !== loadRevision)
      return
    accept(JSON.parse(text))
    urlInput.value = source
    message(automatic ? '' : '已加载最新报告数据。')
  }
  catch (error) {
    if (revision === loadRevision)
      failure(error)
  }
}

element('open-import').addEventListener('click', () => dialog.showModal())
element('empty-import').addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', () => {
  if (fileInput.files?.[0])
    void loadFile(fileInput.files[0])
})
element('url-form').addEventListener('submit', (event) => {
  event.preventDefault()
  void loadUrl(urlInput.value.trim())
})
search.addEventListener('input', () => {
  page = 0
  renderResults()
})
sort.addEventListener('change', () => {
  page = 0
  renderResults()
})
element('previous').addEventListener('click', () => {
  page--
  renderResults()
})
element('next').addEventListener('click', () => {
  page++
  renderResults()
})
element('download').addEventListener('click', () => {
  if (!report)
    return
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
  const anchor = node('a')
  anchor.href = url
  anchor.download = 'report.json'
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
})
document.addEventListener('dragover', (event) => {
  event.preventDefault()
})
document.addEventListener('drop', (event) => {
  event.preventDefault()
  const file = event.dataTransfer?.files[0]
  if (file)
    void loadFile(file)
})

renderOverview()
renderFilters()
renderResults()
try {
  const initial = JSON.parse(element('meodp-data').textContent || '{}')
  if (initial.report)
    accept(initial.report)
  if (typeof initial.dataUrl === 'string') {
    urlInput.value = initial.dataUrl
    // file:// snapshots work offline without noisy requests for a sidecar file.
    if (window.location.protocol !== 'file:')
      void loadUrl(initial.dataUrl, true)
  }
}
catch (error) { failure(error) }
