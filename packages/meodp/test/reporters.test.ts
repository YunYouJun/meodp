import type { TestContext } from 'node:test'
import type { ReporterConfig } from '../src/check'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { readReport, saveReport, writeReporters } from '../src/check'
import { snapshot, tsxImport } from './notify-helpers'

const exec = promisify(execFile)
const entry = fileURLToPath(new URL('../bin/index.ts', import.meta.url))

async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'meodp-reporters-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const run = (args: string[], cwd = directory) => exec(process.execPath, ['--import', tsxImport, entry, ...args], { cwd, env: { PATH: process.env.PATH } })
  return { directory, run }
}

const embedded = (html: string) => JSON.parse(html.match(/<script id="meodp-data" type="application\/json">(.*?)<\/script>/s)![1])

function executionError(error: unknown) {
  assert.ok(error && typeof error === 'object' && 'code' in error)
  assert.equal(error.code, 2)
  return true
}

test('public reporters combine named formats, custom files and a portable HTML folder', async (t) => {
  const { directory } = await fixture(t)
  const outputs = await writeReporters(snapshot, [
    'json',
    'markdown',
    'html',
    ['html', { outputFile: 'offline/report.html' }],
  ], { cwd: directory, outputDir: 'export' })
  assert.deepEqual(await readdir(join(directory, 'export')), ['index.html', 'report.json', 'report.md'])
  assert.deepEqual(await readReport(join(directory, 'export/report.json')), snapshot)
  assert.match(await readFile(join(directory, 'export/report.md'), 'utf8'), /Link availability report/)
  assert.equal(embedded(await readFile(join(directory, 'export/index.html'), 'utf8')).dataUrl, './report.json')
  assert.equal(embedded(await readFile(join(directory, 'offline/report.html'), 'utf8')).dataUrl, null)
  assert.deepEqual(outputs.map(item => item.reporter), ['json', 'markdown', 'html', 'html'])
  const custom = await writeReporters(snapshot, [
    ['json', { outputFile: 'data/current.json' }],
    ['markdown', { outputFile: 'notes/summary.md' }],
    ['html', { outputFolder: 'public/status', dataUrl: '../../data/current.json' }],
  ], { cwd: directory })
  assert.ok(custom.flatMap(item => item.files).every(path => path.startsWith(directory)))
  assert.equal(embedded(await readFile(join(directory, 'public/status/index.html'), 'utf8')).dataUrl, '../../data/current.json')
})

test('invalid reporter selections and overlapping paths fail before writing any files', async (t) => {
  const { directory } = await fixture(t)
  await writeFile(join(directory, 'keep.txt'), 'unchanged')
  const invalid: unknown[] = [
    'csv',
    null,
    {},
    [null],
    [['json', {}, {}]],
    [['json', null]],
    [['json', { outputFolder: 'bad' }]],
    [['html', { outputFile: 'a', outputFolder: 'b' }]],
    [['json', { outputFile: '' }]],
    [['html', { dataUrl: 'javascript:alert(1)' }]],
    [['html', { dataUrl: 42 }]],
    [['json', { outputFile: 'same' }], ['markdown', { outputFile: './same' }]],
    [['markdown', { outputFile: 'site/report.json' }], ['html', { outputFolder: 'site' }]],
    [['json', { outputFile: 'parent' }], ['html', { outputFolder: 'parent' }]],
  ]
  for (const reporter of invalid)
    await assert.rejects(writeReporters(snapshot, reporter as ReporterConfig, { cwd: directory }))
  await assert.rejects(writeReporters({ ...snapshot, schemaVersion: 2 } as unknown as typeof snapshot, 'json', { cwd: directory }))
  assert.deepEqual(await readdir(directory), ['keep.txt'])
  assert.equal(await readFile(join(directory, 'keep.txt'), 'utf8'), 'unchanged')
})

test('HTML supports an empty template while data reporters require a saved report', async (t) => {
  const { directory, run } = await fixture(t)
  await assert.rejects(run(['report', '--reporter', 'html,json']), executionError)
  assert.deepEqual(await readdir(directory), [])
  await run(['report', '--reporter', 'html', '--output', 'template', '--data-url', './latest.json'])
  assert.deepEqual(await readdir(join(directory, 'template')), ['index.html'])
  assert.deepEqual(embedded(await readFile(join(directory, 'template/index.html'), 'utf8')), { report: null, dataUrl: './latest.json' })
  assert.deepEqual(await writeReporters(snapshot, [], { cwd: directory, outputDir: 'disabled' }), [])
  await assert.rejects(readdir(join(directory, 'disabled')), { code: 'ENOENT' })
})

test('TS config shares reporters across commands; command and CLI selections override whole tuples', async (t) => {
  const { directory, run } = await fixture(t)
  await saveReport(snapshot, join(directory, 'input.json'))
  await writeFile(join(directory, 'links.json'), '[]')
  await writeFile(join(directory, 'meodp.config.ts'), `export default {
    reporter: [['markdown', { outputFile: 'shared/result.md' }]],
    check: { input: 'links.json', failOn: 'none' },
    report: { input: 'input.json', output: 'default', reporter: [
      ['json', { outputFile: 'custom/data.json' }],
      ['html', { outputFolder: 'custom/site', dataUrl: './original.json' }]
    ] }
  }`)
  await run(['check'])
  assert.match(await readFile(join(directory, 'shared/result.md'), 'utf8'), /Total: \*\*0/)
  const other = join(directory, 'other')
  await mkdir(other)
  await run(['report', '--config', '../meodp.config.ts', '--data-url', './override.json'], other)
  assert.deepEqual(await readReport(join(directory, 'custom/data.json')), snapshot)
  assert.equal(embedded(await readFile(join(directory, 'custom/site/index.html'), 'utf8')).dataUrl, './override.json')
  // Repeated and comma-separated flags replace the tuple paths, relative to invocation cwd.
  await run(['report', '--config', '../meodp.config.ts', '--reporter=json,markdown', '--reporter=markdown', '--output', 'selected'], other)
  assert.deepEqual(await readdir(join(other, 'selected')), ['report.json', 'report.md'])
  await run(['report', '--config', '../meodp.config.ts', '--reporter=html', '--output', 'viewer'], other)
  assert.deepEqual(await readdir(join(other, 'viewer')), ['index.html', 'report.json'])
  await assert.rejects(run(['report', '--reporter', 'json,']), executionError)
  await assert.rejects(run(['report', '--format', 'json']), executionError)
})

test('scan reporter validation runs before HTTP requests; selections preserve history and exit policy', async (t) => {
  let requests = 0
  let origin: string
  const server = createServer((request, response) => {
    requests++
    if (request.url === '/sitemap.xml') {
      response.setHeader('Content-Type', 'application/xml')
      response.end(`<?xml version="1.0"?><urlset><url><loc>${origin}/missing</loc></url></urlset>`)
    }
    else {
      response.writeHead(404).end()
    }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  origin = `http://127.0.0.1:${address.port}`
  const { directory, run } = await fixture(t)
  await writeFile(join(directory, 'links.json'), JSON.stringify([`${origin}/missing`]))
  await writeFile(join(directory, 'meodp.config.ts'), `export default {
    reporter: 'markdown',
    check: { input: 'links.json', output: 'checks', history: 'history.json', observer: 'test', retries: 0 },
    sitemap: { input: '${origin}/sitemap.xml', output: 'pages', retries: 0, failOn: 'none' }
  }`)
  for (const command of ['check', 'sitemap'])
    await assert.rejects(run([command, '--reporter', 'unknown']), executionError)
  assert.equal(requests, 0)
  await assert.rejects(run(['check']), (error: unknown) => {
    assert.ok(error && typeof error === 'object' && 'code' in error)
    assert.equal(error.code, 1)
    return true
  })
  assert.deepEqual(await readdir(join(directory, 'checks')), ['report.md'])
  assert.equal((await readReport(join(directory, 'history.json')))?.results[0].consecutiveFailures, 1)
  await run(['sitemap'])
  assert.deepEqual(await readdir(join(directory, 'pages')), ['report.md'])
  assert.equal(requests, 3)
  await writeFile(join(directory, 'meodp.config.ts'), `export default { reporter: [['json', { outputFile: 'x' }], ['markdown', { outputFile: 'x' }]], check: { input: 'links.json' } }`)
  await assert.rejects(run(['check']), executionError)
  assert.equal(requests, 3)
})

test('report rejects non-JSON outputs that overwrite its input before writing other artifacts', async (t) => {
  const { directory, run } = await fixture(t)
  await saveReport(snapshot, join(directory, 'input.json'))
  await writeFile(join(directory, 'meodp.config.ts'), `export default { report: {
    input: 'input.json', reporter: [['json', { outputFile: 'other.json' }], ['markdown', { outputFile: './input.json' }]]
  } }`)
  await assert.rejects(run(['report']), executionError)
  assert.deepEqual(await readReport(join(directory, 'input.json')), snapshot)
  assert.equal(await readReport(join(directory, 'other.json')), undefined)
  // Re-emitting the same JSON is supported by both the default HTML folder and JSON reporter.
  await writeFile(join(directory, 'meodp.config.ts'), `export default { report: { input: 'input.json', reporter: [['json', { outputFile: 'input.json' }]] } }`)
  await run(['report'])
  assert.deepEqual(await readReport(join(directory, 'input.json')), snapshot)
})

test('scan protects its input and JSON history and checks legacy site collisions before HTTP', async (t) => {
  let requests = 0
  const server = createServer((_request, response) => {
    requests++
    response.writeHead(200).end()
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const { directory, run } = await fixture(t)
  const links = JSON.stringify([`http://127.0.0.1:${address.port}/`])
  await writeFile(join(directory, 'links.json'), links)
  await saveReport(snapshot, join(directory, 'history.json'))
  for (const config of [
    `reporter: [['json', { outputFile: 'links.json' }]]`,
    `reporter: [], history: './links.json'`,
    `reporter: [['markdown', { outputFile: 'history.json' }]], history: 'history.json'`,
    `reporter: [['html', { outputFile: 'site/report.json' }]], site: 'site'`,
  ]) {
    await writeFile(join(directory, 'meodp.config.ts'), `export default { check: { input: 'links.json', failOn: 'none', observerMismatch: 'reset', ${config} } }`)
    await assert.rejects(run(['check']), executionError)
    assert.equal(requests, 0)
    assert.equal(await readFile(join(directory, 'links.json'), 'utf8'), links)
    assert.deepEqual(await readReport(join(directory, 'history.json')), snapshot)
  }
})
