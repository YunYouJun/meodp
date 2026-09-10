import type { CheckReport } from '../src/check/types'
import { Buffer } from 'node:buffer'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from '@playwright/test'
import { writeReportSite } from '../src/check/report'

const date = '2026-09-10T00:00:00.000Z'
const report: CheckReport = {
  schemaVersion: 1,
  observer: 'browser-test',
  startedAt: date,
  completedAt: date,
  summary: { total: 2, reachable: 1, unavailable: 1, restricted: 0, redirected: 0, recovered: 0 },
  results: [
    { name: 'Healthy', url: 'https://example.com/', finalUrl: 'https://example.com/', status: 'reachable', httpStatus: 200, checkedAt: date, durationMs: 10, attempts: 1, redirects: [], consecutiveFailures: 0, changed: false, recovered: false },
    { name: 'Missing', url: 'https://example.com/missing', finalUrl: 'https://example.com/missing', status: 'unavailable', httpStatus: 404, reason: 'http', checkedAt: date, durationMs: 20, attempts: 1, redirects: [], consecutiveFailures: 1, changed: false, recovered: false },
  ],
}
let directory: string

test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'meodp-browser-'))
  await writeReportSite(report, directory)
})

test.afterAll(async () => {
  await rm(directory, { recursive: true, force: true })
})

test('offline report filters, searches, expands details, and downloads original data', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(pathToFileURL(join(directory, 'index.html')).href)
  await expect(page).toHaveTitle(/meodp/)
  await expect(page.locator('#metadata')).toContainText('browser-test')
  await expect(page.locator('#rows .site')).toHaveCount(2)
  await page.locator('[data-filter="unavailable"]').click()
  await expect(page.locator('#rows .site')).toHaveCount(1)
  await expect(page.locator('#rows')).toContainText('Missing')
  await page.locator('.detail-toggle button').click()
  await expect(page.locator('.detail-body')).toContainText('404')
  await page.locator('[data-filter="all"]').click()
  await page.getByRole('searchbox').fill('Healthy')
  await expect(page.locator('#rows .site')).toHaveCount(1)
  await expect(page.locator('#rows')).toContainText('Healthy')
  const downloadPromise = page.waitForEvent('download')
  await page.locator('#download').click()
  const download = await downloadPromise
  expect(JSON.parse(await readFile((await download.path())!, 'utf8'))).toEqual(report)
  expect(errors).toEqual([])
})

test('invalid JSON import preserves the currently displayed report', async ({ page }) => {
  await page.goto(pathToFileURL(join(directory, 'index.html')).href)
  await page.locator('#open-import').click()
  await page.locator('#file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":99}') })
  await expect(page.locator('#message')).toContainText('加载失败')
  await expect(page.locator('#message')).toContainText('已保留当前报告')
  await expect(page.locator('#rows .site')).toHaveCount(2)
})
