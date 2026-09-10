# Sitemap page checks

To inspect a generated XML file without making requests, use the browser-only [Sitemap parser](../tools/sitemap).

Use a sitemap to supply the page list, then reuse MEODP's linkinator adapter, history, and reports.

## Start with a sitemap or a site

```bash
pnpm exec meodp sitemap https://example.com/sitemap.xml --output reports/pages
pnpm exec meodp sitemap https://example.com/ --discover --output reports/pages
```

By default, the input is an explicit sitemap URL. `--discover` treats it as a site: read `/robots.txt`, collect all `Sitemap:` directives, or fall back to `/sitemap.xml` when robots is absent (404/410) or has no declarations. Other robots errors are surfaced.

```ts
import { checkSitemap, readSitemapUrls, writeReports } from 'meodp/check'

const report = await checkSitemap('https://example.com/', {
  discover: true,
  concurrency: 5,
  maxUrls: 10000,
})
await writeReports(report, 'reports/pages')

// Read the complete list without requesting its pages.
const urls = await readSitemapUrls('https://example.com/sitemap.xml')
```

## Supported inputs and limits

XML URL sets, nested indexes, namespaces, CDATA, XML entities, gzip files, and redirects are supported. Relative entries resolve against the final sitemap URL. Cyclic indexes terminate; URLs are deduplicated, fragments removed, and query strings preserved.

| Option / CLI flag                         | Default    | Allowed range                                       |
| ----------------------------------------- | ---------- | --------------------------------------------------- |
| `discover` / `--discover`                 | `false`    | Boolean                                             |
| `maxUrls` / `--max-urls`                  | `10000`    | 1–50000 unique pages                                |
| `maxSitemaps` / `--max-sitemaps`          | `100`      | 1–10000 documents                                   |
| `maxSitemapBytes` / `--max-sitemap-bytes` | `10485760` | 1 byte–100 MiB per downloaded/decompressed document |

All [check options](../reference/api#check-options) also apply. Sitemap documents are read sequentially; `concurrency` controls page checks. Timeouts include response bodies. Transport/5xx discovery failures can be retried; access restrictions are not retried.

## Complete discovery before checking

A missing or unreadable child sitemap, invalid XML/URL, empty page list, or exceeded limit rejects discovery. No page probes begin until discovery succeeds. The CLI exits with `2` and leaves existing reports/history intact, including with `--fail-on none`.

This prevents a partial scan from appearing complete. After discovery succeeds, individual page failures become normal report observations.

::: details Scope and implementation
The new `checkSitemap()` API checks only sitemap-listed page URLs and their redirects. It does not crawl article links, inspect embedded resources, execute JavaScript, or apply robots `Disallow` rules. Explicit HTTP(S) entries on other origins are included.

XML parsing and validation use fast-xml-parser. MEODP manages bounded discovery and delegates page probes to linkinator. Linkinator's own sitemap API combines discovery with page/link scanning; separate discovery preserves MEODP's redirect tracking and history semantics. The legacy root-entry `checkSiteMap()` is experimental and is not the new API.
:::
