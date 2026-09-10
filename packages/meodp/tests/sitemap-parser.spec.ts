import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const urlset = (...urls: string[]) => `<urlset>${urls.map(url => `<url><loc>${url}</loc></url>`).join('')}</urlset>`

test.beforeEach(async ({ page }) => {
  await page.goto('/zh/tools/sitemap')
  await expect(page).toHaveTitle(/Sitemap 解析器/)
})

test('imports local XML, ignores extension URLs, and exports filtered unique URLs without fetching them', async ({ page }) => {
  const requests: string[] = []
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('https://example.com/**', async (route) => {
    requests.push(route.request().url())
    await route.abort()
  })
  const xml = `<sm:urlset xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
    <sm:url><sm:loc>https://example.com/blog?a=1&amp;b=2</sm:loc><image:image><image:loc>https://example.com/image.png</image:loc></image:image></sm:url>
    <sm:url><sm:loc><![CDATA[https://example.com/blog?a=1&b=2]]></sm:loc></sm:url>
    <sm:url><sm:loc>https://example.org/</sm:loc></sm:url>
    <sm:url><sm:loc>/relative</sm:loc></sm:url>
    <sm:url/>
  </sm:urlset>`
  await page.locator('#sitemap-file').setInputFiles({ name: 'sitemap.xml', mimeType: 'application/xml', buffer: Buffer.from(xml) })
  await expect(page.locator('.stats dd')).toHaveText(['5', '2', '1', '2'])
  await expect(page.locator('.entries tbody tr')).toHaveCount(4)
  await expect(page.locator('.entries')).not.toContainText('image.png')
  await page.getByLabel('域名', { exact: true }).selectOption('example.com')
  await page.getByRole('searchbox').fill('/blog')
  await expect(page.locator('.entries tbody tr')).toHaveCount(1)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出筛选后的 URL' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('sitemap-urls.txt')
  expect(await readFile((await download.path())!, 'utf8')).toBe('https://example.com/blog?a=1&b=2\n')
  expect(requests).toEqual([])
  expect(errors).toEqual([])
})

test('pasted edits invalidate old results and invalid entries stay out of exports', async ({ page }) => {
  await page.getByRole('button', { name: '试用示例' }).click()
  await expect(page.locator('.stats dd')).toHaveText(['4', '3', '1', '0'])
  await page.getByLabel('显示', { exact: true }).selectOption('duplicates')
  await expect(page.locator('.entries tbody tr')).toHaveCount(1)
  await page.locator('#sitemap-xml').fill(urlset('javascript:alert(1)', 'https://user:pass@example.com/', 'https://example.com/#fragment'))
  await expect(page.locator('.results')).toHaveCount(0)
  await page.getByRole('button', { name: '解析 XML', exact: true }).click()
  await expect(page.locator('.stats dd')).toHaveText(['3', '1', '0', '2'])
  await expect(page.locator('.entries')).toContainText('#fragment')
  await page.getByLabel('显示', { exact: true }).selectOption('invalid')
  await expect(page.locator('.entries tbody tr')).toHaveCount(2)
  await expect(page.getByRole('button', { name: '导出筛选后的 URL' })).toBeDisabled()
  await page.getByRole('button', { name: '清空', exact: true }).click()
  await expect(page.locator('#sitemap-xml')).toHaveValue('')
  await expect(page.locator('.results')).toHaveCount(0)
})

test('sitemap indexes show unexpanded references and do not request children', async ({ page }) => {
  const requested: string[] = []
  await page.route('https://example.com/**', async (route) => {
    requested.push(route.request().url())
    await route.abort()
  })
  await page.locator('#sitemap-xml').fill('<sitemapindex><sitemap><loc>https://example.com/child.xml</loc></sitemap></sitemapindex>')
  await page.getByRole('button', { name: '解析 XML', exact: true }).click()
  await expect(page.locator('.result-kind')).toHaveText('Sitemap 索引')
  await expect(page.locator('.index-note')).toContainText('其内容尚未读取')
  await expect(page.locator('.entries')).toContainText('https://example.com/child.xml')
  expect(requested).toEqual([])
})

test('malformed XML, mixed roots, and entity declarations produce actionable errors', async ({ page }) => {
  for (const [xml, message] of [
    ['<urlset><url></urlset>', 'XML 格式错误'],
    ['<!DOCTYPE urlset [<!ENTITY x "a">]><urlset/>', '不支持 DOCTYPE'],
    ['<html/>', '根元素应为'],
    ['<urlset xmlns="https://wrong.example/"><url/></urlset>', '根元素应为'],
    ['<urlset><sitemap><loc>https://example.com/a.xml</loc></sitemap></urlset>', '存在不匹配的条目'],
  ]) {
    await page.locator('#sitemap-xml').fill(xml)
    await page.getByRole('button', { name: '解析 XML', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(message)
    await expect(page.locator('.results')).toHaveCount(0)
  }
  await page.locator('#sitemap-xml').fill('<urlset/>')
  await page.getByRole('button', { name: '解析 XML', exact: true }).click()
  await expect(page.locator('.stats dd')).toHaveText(['0', '0', '0', '0'])
})

test('pagination filters the full list and resets after a new query', async ({ page }) => {
  await page.locator('#sitemap-xml').fill(urlset(...Array.from({ length: 51 }, (_, i) => `https://example.com/post/${i}`)))
  await page.getByRole('button', { name: '解析 XML', exact: true }).click()
  await expect(page.locator('.entries tbody tr')).toHaveCount(50)
  await page.getByRole('button', { name: '下一页', exact: true }).click()
  await expect(page.locator('.entries tbody tr')).toHaveCount(1)
  await page.getByRole('searchbox').fill('/post/0')
  await expect(page.locator('.entries')).toContainText('/post/0')
  await expect(page.locator('.pagination')).toHaveCount(0)
})

test('rejects oversized files and excessive entries before displaying partial results', async ({ page }) => {
  await page.locator('#sitemap-file').setInputFiles({ name: 'large.xml', mimeType: 'application/xml', buffer: Buffer.alloc(5 * 1024 * 1024 + 1, ' ') })
  await expect(page.getByRole('alert')).toContainText('5 MiB')
  await page.locator('#sitemap-file').setInputFiles({ name: 'many.xml', mimeType: 'application/xml', buffer: Buffer.from(`<urlset>${'<url/>'.repeat(50001)}</urlset>`) })
  await expect(page.getByRole('alert')).toContainText('50,000')
  await expect(page.locator('.results')).toHaveCount(0)
})

test('English page works at a mobile viewport and accepts a dropped file', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/tools/sitemap')
  await expect(page).toHaveTitle(/Sitemap parser/)
  const data = await page.evaluateHandle((xml) => {
    const transfer = new DataTransfer()
    transfer.items.add(new File([xml], 'sitemap.xml', { type: 'application/xml' }))
    return transfer
  }, urlset('https://example.com/hello'))
  await page.locator('.input-panel').dispatchEvent('drop', { dataTransfer: data })
  await data.dispose()
  await expect(page.locator('.result-kind')).toHaveText('Page list')
  await expect(page.locator('.entries')).toContainText('/hello')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
