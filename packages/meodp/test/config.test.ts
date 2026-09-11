import type { TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { readReport, saveReport } from '../src/check/report'
import { defineConfig } from '../src/config/index'
import { createNotification } from '../src/notify/notification'
import { report, snapshot, tsxImport } from './notify-helpers'

const exec = promisify(execFile)
const entry = fileURLToPath(new URL('../bin/index.ts', import.meta.url))

async function fixture(t: TestContext, source: string) {
  const directory = await mkdtemp(join(tmpdir(), 'meodp-config-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await writeFile(join(directory, 'meodp.config.ts'), source)
  const run = (args: string[], cwd = directory) => exec(process.execPath, ['--import', tsxImport, entry, ...args], { cwd, env: { PATH: process.env.PATH } })
  return { directory, run }
}

function executionError(error: unknown) {
  assert.ok(error && typeof error === 'object' && 'code' in error)
  assert.equal(error.code, 2)
  return true
}

test('config supports TS imports, config-relative files, CLI overrides, and empty viewers without a config', async (t) => {
  const { directory, run } = await fixture(t, `import { output } from './settings.ts'; export default { check: { input: 'links.json', output, retries: 0, failOn: 'none' }, report: { input: 'saved/report.json', output: 'site' } }`)
  await writeFile(join(directory, 'settings.ts'), `export const output: string = 'saved'`)
  await writeFile(join(directory, 'links.json'), '[]')
  await run(['check'])
  assert.equal((await readReport(join(directory, 'saved/report.json')))?.summary.total, 0)
  await run(['report'])
  assert.match(await readFile(join(directory, 'site/index.html'), 'utf8'), /meodp-data/)
  const other = join(directory, 'other')
  await mkdir(other)
  await run(['check', '--config', '../meodp.config.ts', '--output', 'override'], other)
  assert.equal((await readReport(join(other, 'override/report.json')))?.summary.total, 0)
  await run(['report', '--output', 'empty'], other)
  assert.match(await readFile(join(other, 'empty/index.html'), 'utf8'), /meodp-data/)
})

test('history seeds matching observers, resets only when requested and writes a static report site', async (t) => {
  let requests = 0
  const server = createServer((_request, response) => {
    requests++
    response.writeHead(404).end()
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const url = `http://127.0.0.1:${address.port}/`
  const { directory, run } = await fixture(t, `export default { check: { input: 'links.json', output: 'out', history: 'history.json', historySeed: 'seed.json', observer: 'github-actions-ubuntu', observerMismatch: 'reset', site: 'viewer', retries: 0, failOn: 'none' } }`)
  await writeFile(join(directory, 'links.json'), JSON.stringify([url]))
  const seed = report('unavailable', 2)
  seed.results[0].url = seed.results[0].finalUrl = url
  await saveReport(seed, join(directory, 'seed.json'))
  await run(['check'])
  assert.equal((await readReport(join(directory, 'history.json')))?.results[0].consecutiveFailures, 3)
  assert.match(await readFile(join(directory, 'viewer/index.html'), 'utf8'), /meodp-data/)
  await run(['check', '--observer', 'other-network'])
  assert.equal((await readReport(join(directory, 'history.json')))?.results[0].consecutiveFailures, 1)
  assert.equal(requests, 2)
  await writeFile(join(directory, 'meodp.config.ts'), `export default { check: { input: 'links.json', history: 'history.json', observer: 'strict-network', retries: 0 } }`)
  await assert.rejects(run(['check']), executionError)
  assert.equal(requests, 2)
  await writeFile(join(directory, 'history.json'), '{broken')
  await assert.rejects(run(['check']), executionError)
  assert.equal(requests, 2)
})

test('help does not execute config and explicit missing or invalid configuration fails', async (t) => {
  const { directory, run } = await fixture(t, `throw new Error('CONFIG_EXECUTED')`)
  for (const args of [[], ['-h'], ['-v'], ['check', '-h'], ['report', '-h'], ['notify', '-h'], ['help', 'notify']]) {
    const result = await run(args)
    assert.doesNotMatch(result.stderr, /CONFIG_EXECUTED/)
  }
  await assert.rejects(run(['check']), executionError)
  await assert.rejects(run(['report', '--config', join(directory, 'missing.ts')]), executionError)
  await assert.rejects(run(['notify', '--unknown']), executionError)
})

test('notifications default off before reading reports; dry runs exclude credentials and receiver IDs', async (t) => {
  const { directory, run } = await fixture(t, `export default { notify: { input: 'current.json', previousReport: 'previous.json', title: 'Example', timeZone: 'Asia/Shanghai', feishu: { transport: 'app', appId: 'hidden-app', appSecret: 'hidden-secret', receiveId: 'hidden-recipient' }, email: {} } }`)
  assert.match((await run(['notify'])).stdout, /disabled/)
  await saveReport(snapshot, join(directory, 'previous.json'))
  const testCard = JSON.parse((await run(['notify', '--channel', 'feishu', '--test', '--dry-run'])).stdout)
  assert.equal(testCard.header.template, 'blue')
  assert.match(JSON.stringify(testCard), /历史快照/)
  assert.doesNotMatch(JSON.stringify(testCard), /hidden-/)
  await saveReport(snapshot, join(directory, 'current.json'))
  assert.match((await run(['notify', '--channel', 'feishu', '--mode', 'changes', '--dry-run'])).stdout, /skipped/)
  const weekly = (await run(['notify', '--mode', 'weekly', '--dry-run'])).stdout
  assert.match(weekly, /每周链接检测摘要/)
  assert.doesNotMatch(weekly, /hidden-/)
  await assert.rejects(run(['notify', '--channel', 'invalid']), executionError)
  await assert.rejects(run(['notify', '--mode', 'invalid', '--dry-run']), executionError)
})

test('report verification is available through config without rendering or scanning links', async (t) => {
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', request.url?.startsWith('/report.json') ? 'application/json' : 'text/html')
    response.end(request.url?.startsWith('/report.json') ? JSON.stringify(snapshot) : '<script id="meodp-data"></script>')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const { directory, run } = await fixture(t, `export default { report: { input: 'report.json', verify: { url: 'http://127.0.0.1:${address.port}/report.json', attempts: 1, delayMs: 0 } } }`)
  await saveReport(snapshot, join(directory, 'report.json'))
  assert.match((await run(['report', '--verify'])).stdout, /serving the expected report/)
})

test('notification policy exposes event kinds, configurable thresholds and explicit observer behavior', () => {
  const config = defineConfig({ check: { input: 'links.yml' }, notify: { input: 'report.json', feishu: { mode: 'changes', transport: 'app' } } })
  assert.equal(config.notify.feishu.mode, 'changes')
  assert.throws(() => createNotification(report('unavailable'), { previousReport: report('reachable', 0, 'other') }), /another observer/)
  const restricted = createNotification(report('reachable'), { previousReport: report('restricted') })
  assert.equal(restricted?.entries?.[0].kind, 'restriction-lifted')
  const recovered = createNotification(report('reachable'), { previousReport: report('unavailable', 3) })
  assert.equal(recovered?.entries?.[0].kind, 'recovered')
  const failure = createNotification(report('unavailable', 3), { previousReport: report('unavailable', 2), failureThreshold: 3 })
  assert.equal(failure?.entries?.[0].kind, 'failure-threshold')
  assert.equal(createNotification(report('unavailable', 4), { previousReport: report('unavailable', 3), failureThreshold: 3 }), undefined)
  assert.throws(() => createNotification(snapshot, { failureThreshold: 0 }), /positive integer/)
})
