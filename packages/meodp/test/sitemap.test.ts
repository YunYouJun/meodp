import type { Buffer } from 'node:buffer'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { after, before, beforeEach, it } from 'node:test'
import { promisify } from 'node:util'
import { gzipSync } from 'node:zlib'
import { checkSitemap, parseReport, readReport, readSitemapUrls, writeReports } from '../src/check'

const exec = promisify(execFile)
interface Fixture {
  body?: string | Buffer
  status?: number
  headers?: Record<string, string>
  hang?: boolean
  bodyHang?: boolean
  flaky?: boolean
}
const fixtures = new Map<string, Fixture>()
const requests: string[] = []
let origin: string
let directory: string
let nextId = 0
const server = createServer((request, response) => {
  const path = request.url ?? '/'
  requests.push(path)
  const fixture = fixtures.get(path)
  if (fixture?.hang)
    return
  if (fixture?.flaky && requests.filter(item => item === path).length === 1) {
    response.writeHead(503).end()
    return
  }
  response.writeHead(fixture?.status ?? (fixture ? 200 : 404), fixture?.headers ?? { 'content-type': 'application/xml' })
  if (fixture?.bodyHang) {
    response.write('<urlset>')
    return
  }
  response.end(fixture?.body)
})

function document(body: string | Buffer, options: Omit<Fixture, 'body'> = {}) {
  const path = `/maps/${nextId++}.xml`
  fixtures.set(path, { body, ...options })
  return `${origin}${path}`
}

const urlset = (...urls: string[]) => `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>${url}</loc></url>`).join('')}</urlset>`
const index = (...urls: string[]) => `<sitemapindex>${urls.map(url => `<sitemap><loc>${url}</loc></sitemap>`).join('')}</sitemapindex>`

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'meodp-sitemap-tests-'))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  origin = `http://127.0.0.1:${address.port}`
})

beforeEach(() => {
  requests.length = 0
  fixtures.clear()
  fixtures.set('/ok', { body: '<html><a href="/not-listed">Other page</a><img src="/image.png"><script src="/script.js"></script></html>', headers: { 'content-type': 'text/html' } })
  fixtures.set('/missing', { status: 404 })
  fixtures.set('/restricted', { status: 403 })
  fixtures.set('/redirect', { status: 301, headers: { location: '/ok' } })
})

after(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  await rm(directory, { recursive: true, force: true })
})

it('reads nested gzip sitemaps, deduplicates pages, and terminates cyclic indexes', async () => {
  const root = `${origin}/index.xml`
  const pages = document(gzipSync(urlset(`${origin}/ok#one`, `${origin}/ok#two`, `${origin}/missing`)))
  const nested = document(index(root, pages))
  fixtures.set('/index.xml', { body: index(nested, pages) })
  const report = await checkSitemap(root, { retries: 0 })
  assert.deepEqual(report.results.map(item => item.url), [`${origin}/ok`, `${origin}/missing`])
  assert.equal(report.summary.reachable, 1)
  assert.equal(report.summary.unavailable, 1)
  assert.equal(requests.filter(path => path === new URL(pages).pathname).length, 1)
  assert.equal(requests.filter(path => path === '/ok').length, 1)
  assert(!requests.some(path => ['/not-listed', '/image.png', '/script.js'].includes(path)))
})

it('XML parsing handles namespaces, query entities and CDATA without treating image locs as pages', async () => {
  const source = document(`<sm:urlset xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
    <sm:url><sm:loc>${origin}/ok?a=1&amp;b=2</sm:loc><image:image><image:loc>${origin}/image.png</image:loc></image:image></sm:url>
    <sm:url><sm:loc><![CDATA[${origin}/ok?c=3&d=4]]></sm:loc></sm:url>
  </sm:urlset>`)
  assert.deepEqual(await readSitemapUrls(source), [`${origin}/ok?a=1&b=2`, `${origin}/ok?c=3&d=4`])
  assert.deepEqual(requests, [new URL(source).pathname])
})

it('discovers multiple sitemaps from robots.txt and falls back only when absent or undeclared', async () => {
  const one = document(urlset(`${origin}/ok`))
  const two = document(urlset(`${origin}/restricted`, `${origin}/ok`))
  fixtures.set('/robots.txt', { body: `User-agent: *\n  Sitemap: ${one}\r\nsitemap:${two}\nSitemap: ${one} # duplicate` })
  assert.deepEqual(await readSitemapUrls(`${origin}/blog`, { discover: true, retries: 0 }), [`${origin}/ok`, `${origin}/restricted`])
  assert(!requests.includes('/sitemap.xml'))
  fixtures.set('/sitemap.xml', { body: urlset(`${origin}/ok`) })
  for (const robots of [{ status: 404 }, { status: 410 }, { body: 'User-agent: *\nDisallow:' }]) {
    fixtures.set('/robots.txt', robots)
    assert.deepEqual(await readSitemapUrls(origin, { discover: true, retries: 0 }), [`${origin}/ok`])
  }
  requests.length = 0
  fixtures.set('/robots.txt', { status: 403 })
  await assert.rejects(readSitemapUrls(origin, { discover: true, retries: 0 }), /HTTP 403/)
  assert.deepEqual(requests, ['/robots.txt'])
})

it('follows sitemap redirects and resolves relative entries against the final document URL', async () => {
  fixtures.set('/folder/final.xml', { body: urlset('../ok') })
  const source = document('', { status: 302, headers: { location: '/folder/final.xml' } })
  assert.deepEqual(await readSitemapUrls(source), [`${origin}/ok`])
  await assert.rejects(readSitemapUrls(source, { maxRedirects: 0, retries: 0 }), /redirect loop or limit/)
  const loop = document('', { status: 302, headers: { location: '/loop.xml' } })
  fixtures.set('/loop.xml', { status: 302, headers: { location: new URL(loop).pathname } })
  await assert.rejects(readSitemapUrls(loop, { retries: 0 }), /redirect loop or limit/)
})

it('rejects invalid, empty and unsupported maps before any page probes', async () => {
  const invalid = [
    '<html><body>Not a sitemap</body></html>',
    '<urlset><url></urlset>',
    '<urlset/>',
    '<urlset><url/></urlset>',
    '<urlset><url><loc></loc></url></urlset>',
    '<urlset><sitemap><loc>/other.xml</loc></sitemap></urlset>',
    '<!DOCTYPE urlset [<!ENTITY x "a">]><urlset/>',
    urlset(`${origin}/ok`, 'file:///tmp/page'),
    urlset(`${origin}/ok`, 'https://name:password@example.com/'),
  ]
  for (const xml of invalid) {
    await assert.rejects(checkSitemap(document(xml), { retries: 0 }))
  }
  assert(requests.every(path => path.startsWith('/maps/')))
})

it('rejects partially unreadable nested sitemaps instead of returning a partial successful report', async () => {
  const valid = document(urlset(`${origin}/ok`))
  const broken = document('', { status: 404 })
  const source = document(index(valid, broken))
  await assert.rejects(checkSitemap(source, { retries: 0 }), /HTTP 404/)
  assert(!requests.includes('/ok'))
})

it('enforces URL, document and decompressed byte limits before page checks', async () => {
  const pages = document(urlset(`${origin}/ok`, `${origin}/missing`))
  await assert.rejects(checkSitemap(pages, { maxUrls: 1 }), /maxUrls/)
  await assert.rejects(checkSitemap(document(index(pages)), { maxSitemaps: 1 }), /maxSitemaps/)
  await assert.rejects(checkSitemap(pages, { maxSitemapBytes: 30 }), /maxSitemapBytes/)
  const large = `<!-- ${'padding'.repeat(1000)} -->${urlset(`${origin}/ok`)}`
  await assert.rejects(checkSitemap(document(gzipSync(large)), { maxSitemapBytes: 500 }), /maxSitemapBytes/)
  assert(!requests.includes('/ok'))
})

it('validates all check options and history before discovery starts', async () => {
  const source = document(urlset(`${origin}/ok`))
  for (const options of [{ concurrency: 0 }, { retries: -1 }, { maxUrls: 0 }, { maxSitemaps: 0 }, { observer: ' ' }]) {
    await assert.rejects(checkSitemap(source, options))
  }
  await assert.rejects(checkSitemap('file:///tmp/sitemap.xml'))
  assert.equal(requests.length, 0)
  const previousReport = await checkSitemap(source, { observer: 'one', retries: 0 })
  requests.length = 0
  await assert.rejects(checkSitemap(source, { observer: 'two', previousReport }), /another observer/)
  assert.equal(requests.length, 0)
})

it('retries transient discovery failures and times out stalled headers or bodies', async () => {
  const flaky = document(urlset(`${origin}/ok`), { flaky: true })
  assert.deepEqual(await readSitemapUrls(flaky, { retries: 1 }), [`${origin}/ok`])
  assert.equal(requests.filter(path => path === new URL(flaky).pathname).length, 2)
  for (const fixture of [{ hang: true }, { bodyHang: true }]) {
    const stalled = document('', fixture)
    await assert.rejects(readSitemapUrls(stalled, { timeoutMs: 40, retries: 0 }), /timeout|abort/i)
  }
})

it('uses existing redirect, history, callback and report behavior for sitemap pages', async () => {
  const source = document(urlset(`${origin}/redirect`, `${origin}/restricted`, `${origin}/missing`))
  const observed: string[] = []
  const previousReport = await checkSitemap(source, {
    observer: 'fixture',
    retries: 0,
    onResult: (result) => {
      observed.push(result.url)
    },
  })
  assert.equal(observed.length, 3)
  assert.equal(previousReport.results[0].finalUrl, `${origin}/ok`)
  assert.equal(previousReport.results[0].redirects[0].status, 301)
  assert.equal(previousReport.results[1].status, 'restricted')
  fixtures.set('/missing', { status: 200 })
  const report = await checkSitemap(source, { observer: 'fixture', retries: 0, previousReport })
  assert.equal(report.results[2].recovered, true)
  assert.equal(report.summary.recovered, 1)
  const files = await writeReports(report, join(directory, 'formats'))
  assert.deepEqual(await readReport(files.json), parseReport(report))
  assert.match(await readFile(files.html, 'utf8'), /meodp-data/)
  assert.match(await readFile(files.markdown, 'utf8'), /reachable/)
})

it('CLI writes reports, applies failure policies, and preserves existing files on discovery errors', async () => {
  const source = document(urlset(`${origin}/missing`))
  const output = join(directory, 'cli')
  const history = join(directory, 'history.json')
  const args = ['--import', 'tsx', 'bin/index.ts', 'sitemap', source, '--retries', '0', '--output', output, '--history', history]
  const exitCode = (expected: number) => (error: unknown) => {
    assert(error && typeof error === 'object' && 'code' in error)
    assert.equal(error.code, expected)
    return true
  }
  await assert.rejects(exec(process.execPath, args), exitCode(1))
  await exec(process.execPath, [...args, '--fail-on', 'none'])
  assert.equal((await readReport(history))?.results[0].consecutiveFailures, 2)
  const saved = await readFile(history, 'utf8')
  const savedReport = await readFile(join(output, 'report.json'), 'utf8')
  fixtures.set(new URL(source).pathname, { status: 404 })
  await assert.rejects(exec(process.execPath, [...args, '--fail-on', 'none']), exitCode(2))
  assert.equal(await readFile(history, 'utf8'), saved)
  assert.equal(await readFile(join(output, 'report.json'), 'utf8'), savedReport)
  fixtures.set('/sitemap.xml', { body: urlset(`${origin}/ok`) })
  await exec(process.execPath, ['--import', 'tsx', 'bin/index.ts', 'sitemap', origin, '--discover', '--output', output, '--retries', '0'])
  assert.equal((await readReport(join(output, 'report.json')))?.summary.reachable, 1)
})

it('CLI sitemap help and invalid options do not start requests', async () => {
  for (const args of [['sitemap', '-h'], ['help', 'sitemap']]) {
    const { stdout } = await exec(process.execPath, ['--import', 'tsx', 'bin/index.ts', ...args])
    assert.match(stdout, /--discover/)
  }
  await assert.rejects(exec(process.execPath, ['--import', 'tsx', 'bin/index.ts', 'sitemap', origin, '--max-urls', '0']))
  assert.equal(requests.length, 0)
})
