import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { after, before, it } from 'node:test'
import { promisify } from 'node:util'
import pkg from '../package.json'
import { checkLinks, formatReport, parseReport, readReport, saveReport, writeReports, writeReportSite } from '../src/check'

const exec = promisify(execFile)
const requests: string[] = []
let stateStatus = 503
let flakyRequests = 0
let activeRequests = 0
let peakRequests = 0
let origin: string
let directory: string
const server = createServer((request, response) => {
  const path = request.url ?? '/'
  requests.push(path)
  if (path === '/redirect') {
    response.writeHead(301, { location: '/redirect-again' }).end()
  }
  else if (path === '/redirect-again') {
    response.writeHead(302, { location: '/ok' }).end()
  }
  else if (path === '/loop') {
    response.writeHead(302, { location: '/loop' }).end()
  }
  else if (path === '/invalid-redirect') {
    response.writeHead(302, { location: 'file:///etc/passwd' }).end()
  }
  else if (path === '/timeout') {
    // The client must time out; the server intentionally sends no headers.
  }
  else if (path === '/reset') {
    request.socket.destroy()
  }
  else if (path.startsWith('/status/')) {
    response.writeHead(Number(path.split('/').at(-1))).end()
  }
  else if (path === '/state') {
    response.writeHead(stateStatus).end()
  }
  else if (path === '/flaky') {
    response.writeHead(++flakyRequests === 1 ? 503 : 200).end()
  }
  else if (path.startsWith('/slow/')) {
    activeRequests++
    peakRequests = Math.max(peakRequests, activeRequests)
    response.on('close', () => activeRequests--)
    setTimeout(() => response.writeHead(200).end(), 40)
  }
  else {
    response.writeHead(200, { 'content-type': 'text/html' })
      .end('<html><a href="/must-not-fetch">Other page</a><img src="/missing-image"><script src="/missing-script"></script></html>')
  }
})

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'meodp-tests-'))
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  assert(address && typeof address !== 'string')
  origin = `http://127.0.0.1:${address.port}`
})

after(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  await rm(directory, { recursive: true, force: true })
})

it('checks only supplied URLs, deduplicates normalized URLs, and preserves order and names', async () => {
  const report = await checkLinks([
    { url: `${origin}/ok#one`, name: 'A friend' },
    `${origin}/ok#two`,
    `${origin}/status/404`,
  ], { retries: 0 })
  assert.equal(report.summary.total, 2)
  assert.equal(report.results[0].name, 'A friend')
  assert.equal(report.results[0].status, 'reachable')
  assert.equal(report.results[1].httpStatus, 404)
  assert.equal(report.results[1].status, 'unavailable')
  assert(!requests.includes('/must-not-fetch'))
  assert(!requests.includes('/missing-image'))
  assert(!requests.includes('/missing-script'))
})

it('records the redirect chain, limits redirects, and rejects unsafe destinations', async () => {
  const report = await checkLinks([`${origin}/redirect`, `${origin}/loop`, `${origin}/invalid-redirect`], { retries: 0 })
  assert.equal(report.results[0].status, 'reachable')
  assert.equal(report.results[0].finalUrl, `${origin}/ok`)
  assert.deepEqual(report.results[0].redirects.map(item => item.status), [301, 302])
  assert.equal(report.results[1].reason, 'redirect')
  assert.match(report.results[1].detail!, /loop/)
  assert.equal(report.results[2].status, 'unavailable')
  assert.equal(report.results[2].reason, 'redirect')
  const limited = await checkLinks([`${origin}/redirect`], { maxRedirects: 0 })
  assert.equal(limited.results[0].status, 'unavailable')
  assert.match(limited.results[0].detail!, /limit/)
})

it('restricted HTTP statuses are inconclusive and are not retried', async () => {
  const report = await checkLinks([401, 403, 429, 451].map(status => `${origin}/status/${status}`))
  assert.equal(report.summary.restricted, 4)
  assert.equal(report.summary.unavailable, 0)
  assert(report.results.every(item => item.attempts === 1 && item.consecutiveFailures === 0))
})

it('honors the concurrency limit while retaining input order', async () => {
  const urls = Array.from({ length: 7 }, (_, index) => `${origin}/slow/${index}`)
  const report = await checkLinks(urls, { concurrency: 2, retries: 0 })
  assert.equal(peakRequests, 2)
  assert.deepEqual(report.results.map(item => item.url), urls)
})

it('retries a transient 503 and separates request retries from failed runs', async () => {
  const report = await checkLinks([`${origin}/flaky`], { retries: 1 })
  assert.equal(report.results[0].status, 'reachable')
  assert.equal(report.results[0].attempts, 2)
  assert.equal(report.results[0].consecutiveFailures, 0)
})

it('reports timeout and transport failure without failing the entire scan', async () => {
  const report = await checkLinks([`${origin}/timeout`, `${origin}/reset`, `${origin}/ok`], { timeoutMs: 80, retries: 0 })
  assert.equal(report.results[0].status, 'unavailable')
  assert.equal(report.results[0].reason, 'timeout')
  assert.equal(report.results[1].status, 'unavailable')
  assert.equal(report.results[1].reason, 'network')
  assert.equal(report.results[2].status, 'reachable')
})

it('history tracks failures and recovery within the same observer', async () => {
  const targets = [`${origin}/state`]
  const options = { observer: 'test-network', retries: 0 }
  const first = await checkLinks(targets, options)
  const second = await checkLinks(targets, { ...options, previousReport: first })
  assert.equal(second.results[0].consecutiveFailures, 2)
  assert.equal(second.results[0].firstFailureAt, first.results[0].checkedAt)
  stateStatus = 403
  const restricted = await checkLinks(targets, { ...options, previousReport: second })
  assert.equal(restricted.results[0].consecutiveFailures, 0)
  stateStatus = 503
  const failedAgain = await checkLinks(targets, { ...options, previousReport: restricted })
  assert.equal(failedAgain.results[0].consecutiveFailures, 1)
  stateStatus = 200
  const recovered = await checkLinks(targets, { ...options, previousReport: failedAgain })
  assert.equal(recovered.results[0].consecutiveFailures, 0)
  assert.equal(recovered.results[0].firstFailureAt, undefined)
  assert.equal(recovered.results[0].recovered, true)
  assert.equal(recovered.summary.recovered, 1)
  assert.equal(recovered.results[0].lastSuccessAt, recovered.results[0].checkedAt)
  await assert.rejects(checkLinks(targets, { ...options, observer: 'other-network', previousReport: first }), /another observer/)
})

it('rejects invalid input before making any network requests and supports an empty list', async () => {
  const count = requests.length
  await assert.rejects(checkLinks([`${origin}/ok`, 'not a URL']), /index 1/)
  await assert.rejects(checkLinks(['file:///etc/passwd']), /Invalid HTTP/)
  await assert.rejects(checkLinks(['https://user:password@example.com/']), /Invalid HTTP/)
  await assert.rejects(checkLinks([`${origin}/ok`], { concurrency: 0 }), /concurrency/)
  assert.equal(requests.length, count)
  assert.equal((await checkLinks([])).summary.total, 0)
})

it('writes JSON and escaped Markdown, round-trips history, and rejects corrupt history', async () => {
  const report = await checkLinks([{ url: `${origin}/ok`, name: '<script>\nA|[x]' }], { retries: 0 })
  const paths = await writeReports(report, join(directory, 'reports'))
  const json = JSON.parse(await readFile(paths.json, 'utf8'))
  assert.equal(json.results[0].name, '<script>\nA|[x]')
  const markdown = await readFile(paths.markdown, 'utf8')
  assert(markdown.includes('&lt;script&gt; A&#124;&#91;x&#93;'))
  assert.equal(markdown, formatReport(report))
  assert.match(await readFile(paths.html, 'utf8'), /友链可访问性报告/)
  const history = join(directory, 'history', 'report.json')
  assert.equal(await readReport(history), undefined)
  await saveReport(report, history)
  assert.deepEqual(await readReport(history), json)
  await writeFile(history, '{"schemaVersion":100}')
  await assert.rejects(readReport(history), /Invalid or unsupported/)
  await writeFile(history, 'invalid json')
  await assert.rejects(readReport(history), SyntaxError)
})

it('exports portable HTML and a static site without allowing embedded report data to become markup', async () => {
  const report = await checkLinks([{ url: `${origin}/ok`, name: '</script><img src=x onerror=alert(1)>' }], { retries: 0 })
  const html = formatReport(report, 'html')
  assert(!html.includes(report.results[0].name!))
  const embedded = html.match(/<script id="meodp-data" type="application\/json">([\s\S]*?)<\/script>/)![1]
  assert.deepEqual(JSON.parse(embedded).report, JSON.parse(JSON.stringify(report)))
  assert.equal(JSON.parse(embedded).dataUrl, null)
  assert(!/<script[^>]+src=/.test(html))
  const site = await writeReportSite(report, join(directory, 'site'))
  assert.deepEqual(await readReport(site.json!), parseReport(report))
  const index = await readFile(site.index, 'utf8')
  assert(index.includes('"dataUrl":"./report.json"'))
  const empty = await writeReportSite(undefined, join(directory, 'empty'), { dataUrl: 'https://example.com/report.json' })
  assert.equal(empty.json, undefined)
  assert((await readFile(empty.index, 'utf8')).includes('https://example.com/report.json'))
  await assert.rejects(writeReportSite(report, join(directory, 'unsafe'), { dataUrl: 'javascript:alert(1)' }), /dataUrl/)
})

it('rejects corrupt or unsafe loaded reports before rendering or using history', async () => {
  const report = await checkLinks([`${origin}/ok`], { retries: 0 })
  assert.throws(() => parseReport({ ...report, summary: { ...report.summary, total: 999 } }), /summary.total/)
  assert.throws(() => parseReport({ ...report, completedAt: 'not a date' }), /completedAt/)
  assert.throws(() => parseReport({ ...report, results: [{ ...report.results[0], url: 'javascript:alert(1)' }] }), /URL/)
  assert.throws(() => parseReport({ ...report, results: [{ ...report.results[0], redirects: null }] }), /redirects/)
  assert.throws(() => parseReport({ ...report, results: [{ ...report.results[0], durationMs: -1 }] }), /durationMs/)
})

it('report command exports existing data and an empty viewer without checking URLs', async () => {
  const report = await checkLinks([`${origin}/ok`], { retries: 0 })
  const input = join(directory, 'report-input.json')
  const output = join(directory, 'cli-site')
  await saveReport(report, input)
  const before = requests.length
  await exec(process.execPath, ['--import', 'tsx', 'bin/index.ts', 'report', input, '--output', output])
  assert.equal(requests.length, before)
  assert.deepEqual(await readReport(join(output, 'report.json')), parseReport(report))
  assert.match(await readFile(join(output, 'index.html'), 'utf8'), /meodp-data/)
  await exec(process.execPath, ['--import', 'tsx', 'bin/index.ts', 'report', '--output', join(directory, 'cli-empty')])
  await assert.rejects(exec(process.execPath, ['--import', 'tsx', 'bin/index.ts', 'report', 'missing.json']), (error: unknown) => {
    assert(error && typeof error === 'object' && 'code' in error)
    assert.equal(error.code, 2)
    return true
  })
})

it('command line accepts friends YAML, reports findings, retains history, and distinguishes exit policies', async () => {
  const input = join(directory, 'friends.yml')
  const output = join(directory, 'cli-report')
  const history = join(directory, 'cli-history.json')
  await writeFile(input, `- url: ${origin}/status/404\n  name: Example\n  email: private@example.com\n  avatar: ${origin}/avatar\n`)
  const args = ['--import', 'tsx', 'bin/index.ts', 'check', input, '--output', output, '--history', history, '--observer', 'cli-test', '--retries', '0']
  await assert.rejects(exec(process.execPath, args), (error: unknown) => {
    assert(error && typeof error === 'object' && 'code' in error)
    assert.equal(error.code, 1)
    return true
  })
  await exec(process.execPath, [...args, '--fail-on', 'none'])
  const report = await readReport(history)
  assert.equal(report?.results[0].consecutiveFailures, 2)
  const contents = await readFile(join(output, 'report.json'), 'utf8')
  assert(!contents.includes('private@example.com'))
  assert(!requests.includes('/avatar'))
  await assert.rejects(exec(process.execPath, [...args, '--concurrency', '0']), (error: unknown) => {
    assert(error && typeof error === 'object' && 'code' in error)
    assert.equal(error.code, 2)
    return true
  })
})

it('CLI discovery shows commands and version without starting a scan', async () => {
  const count = requests.length
  for (const args of [[], ['--help'], ['-h'], ['help']]) {
    const { stdout, stderr } = await exec(process.execPath, ['--import', 'tsx', 'bin/index.ts', ...args])
    assert.match(stdout, /Usage: meodp <command>/)
    assert.match(stdout, /check <links.json\|links.yml>/)
    assert.match(stdout, /report \[report.json\]/)
    assert.equal(stderr, '')
  }
  for (const option of ['--version', '-v']) {
    const { stdout } = await exec(process.execPath, ['--import', 'tsx', 'bin/index.ts', option])
    assert.equal(stdout.trim(), pkg.version)
  }
  assert.equal(requests.length, count)
})

it('command-specific help separates fresh checks, saved reports, and legacy scanning', async () => {
  for (const command of ['check', 'report', 'scan', 'export']) {
    for (const args of [[command, '-h'], ['help', command]]) {
      const { stdout } = await exec(process.execPath, ['--import', 'tsx', 'bin/index.ts', ...args])
      assert.match(stdout, new RegExp(`Usage: meodp ${command} `))
      if (command === 'check')
        assert.match(stdout, /makes network requests/)
      if (command === 'report')
        assert.match(stdout, /without making any site-check requests/)
    }
  }
})

it('unknown commands and former implicit root paths fail instead of falling through to scanning', async () => {
  const count = requests.length
  for (const args of [['chek'], ['reports'], ['.'], ['--bogus'], ['help', 'missing'], ['--version', 'extra']]) {
    await assert.rejects(exec(process.execPath, ['--import', 'tsx', 'bin/index.ts', ...args]), (error: unknown) => {
      assert(error && typeof error === 'object' && 'code' in error && 'stderr' in error)
      assert.equal(error.code, 2)
      assert.match(String(error.stderr), /meodp:/)
      assert.doesNotMatch(String(error.stderr), /Playwright|Cannot find/)
      return true
    })
  }
  assert.equal(requests.length, count)
})
