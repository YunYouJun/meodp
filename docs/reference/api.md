# API reference

Import the Node.js HTTP checker from `meodp/check`. ESM, CommonJS, and TypeScript declarations are provided. This entry does not require a browser.

## Check URLs

```ts
import { checkLinks, checkSitemap, readSitemapUrls } from 'meodp/check'

const links = await checkLinks(['https://example.com/'], { observer: 'ci' })
const pages = await checkSitemap('https://example.com/', { discover: true })
const urls = await readSitemapUrls('https://example.com/sitemap.xml')
```

| Function                            | Input                                                             | Returns                                   |
| ----------------------------------- | ----------------------------------------------------------------- | ----------------------------------------- |
| `checkLinks(input, options?)`       | Readonly array of strings or `LinkTarget` objects; `CheckOptions` | `Promise<CheckReport>`                    |
| `checkSitemap(source, options?)`    | Sitemap/site URL; `SitemapOptions`                                | `Promise<CheckReport>`                    |
| `readSitemapUrls(source, options?)` | Sitemap/site URL; `SitemapOptions`                                | `Promise<string[]>` without probing pages |

`checkLinks()` validates the full input before sending requests. Results retain the normalized input order. Request failures become observations; invalid input/options or errors from your `onResult` callback reject the run. `readSitemapUrls()` makes discovery requests only; history and result callbacks concern the page-checking phase.

## Check options {#check-options}

| Option           | Default     | Range or behavior                                                                             |
| ---------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `concurrency`    | `5`         | Integer 1–100                                                                                 |
| `timeoutMs`      | `10000`     | Integer 1–300000, per request including the body                                              |
| `retries`        | `1`         | Integer 0–5, for transport errors and 5xx                                                     |
| `maxRedirects`   | `5`         | Integer 0–20 per attempt                                                                      |
| `observer`       | OS hostname | Nonempty environment identifier                                                               |
| `previousReport` | None        | Prior `CheckReport` with the same observer                                                    |
| `onResult`       | None        | Sync or async callback after each URL completes; completion order can differ from input order |

`SitemapOptions` extends these with `discover`, `maxUrls`, `maxSitemaps`, and `maxSitemapBytes`. See the [sitemap guide](../guide/sitemap) for defaults, bounds, and discovery error handling.

## Report helpers

```ts
import { checkLinks, formatReport, writeReports, writeReportSite } from 'meodp/check'

const report = await checkLinks(['https://example.com/'])
const markdown = formatReport(report)
await writeReports(report, 'reports/links')
await writeReportSite(report, 'reports/site')
await writeReportSite(undefined, 'reports/viewer', { dataUrl: './latest.json' })
```

| Function                                                  | Result                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `formatReport(report, format?)`                           | String; format is `markdown` (default), `json`, or `html`                      |
| `writeReports(report, directory)`                         | Promise of `{ json, markdown, html }` file paths                               |
| `writeReportSite(reportOrUndefined, directory, options?)` | Promise of `{ index, json? }`; `ReportSiteOptions.dataUrl` selects hosted JSON |
| `readReport(path)`                                        | Promise of validated `CheckReport`, or `undefined` for a missing file          |
| `saveReport(report, path)`                                | Promise completing after atomic history replacement                            |
| `parseReport(data)`                                       | Validate unknown parsed JSON and return `CheckReport`; invalid data throws     |

`parseReport()` verifies that the supplied summary matches the validated results. For imported JSON, parse it with `JSON.parse()` before calling this helper. See [reports and history](../guide/reports) for interpretation and viewer behavior.

## Exported data types

The following declarations are included directly from the package source so their fields stay aligned with the implementation.

::: details Link targets, observations, reports, and check options
<<< @/../packages/meodp/src/check/types.ts
:::

The package root entry `meodp` retains the experimental browser APIs. New HTTP integrations should use `meodp/check`; the older `checkSiteMap()` is a separate experimental API.
