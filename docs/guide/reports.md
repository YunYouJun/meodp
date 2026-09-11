# Reports and history

## Read the results {#results}

Each result records a URL, final URL, redirects, HTTP status or failure reason, duration, attempts, and observation time.

| Status        | Meaning                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| `reachable`   | The final HTTP response is 2xx                                             |
| `restricted`  | HTTP 401, 403, 429, 451, or 999; access from this observer is inconclusive |
| `unavailable` | Other HTTP responses or a DNS, TLS, timeout, network, or redirect failure  |

A redirect can end in any of these statuses. It deserves review when a friend has moved domains, but does not alone mean the site is unavailable. A successful response does not verify the page's content or ownership.

Retries apply to transport errors and 5xx responses, not restricted responses. `attempts` includes the initial attempt. See the [CLI failure policies](../reference/cli#exit-codes) for CI behavior.

## Compare runs {#history}

Use one history file per network/environment and URL collection:

```bash
pnpm exec meodp check links.yml --observer home --history .cache/links-home.json
```

```ts
import { checkLinks, readReport, saveReport } from 'meodp/check'

const history = '.cache/links-home.json'
const report = await checkLinks(['https://example.com/'], {
  observer: 'home',
  previousReport: await readReport(history),
})
await saveReport(report, history)
```

A missing history file starts a new history. Malformed data or a different `observer` is an error. Save only after the run completes; `saveReport()` replaces the history file atomically.

| Field                 | Meaning                                                                           |
| --------------------- | --------------------------------------------------------------------------------- |
| `consecutiveFailures` | Consecutive observed `unavailable` runs; reachable or restricted results reset it |
| `firstFailureAt`      | Start of the current observed failure streak                                      |
| `lastSuccessAt`       | Most recent observed reachable result                                             |
| `changed`             | Status or final URL differs from the previous result                              |
| `recovered`           | A previously unavailable URL is reachable in this run                             |

History contains the current collection, not an append-only archive. Failed runs are separate observations and do not establish continuous downtime between runs.

## Select reporters {#reporters}

Starting with 0.2.0, use `reporter` in `meodp.config.ts` to select JSON, Markdown, and HTML output. The name / tuple configuration follows [Playwright](https://playwright.dev/docs/test-reporters#multiple-reporters); repeatable `--reporter` flags also follow [Vitest](https://vitest.dev/guide/reporters#combining-reporters).

```ts
import { defineConfig } from 'meodp/config'

export default defineConfig({
  reporter: [
    ['json', { outputFile: 'reports/data.json' }],
    ['markdown', { outputFile: 'reports/summary.md' }],
    ['html', { outputFolder: 'reports/site' }],
  ],
  check: { input: 'links.yml' },
  report: { input: 'reports/data.json' },
})
```

A single name (`reporter: 'json'`), names (`reporter: ['json', 'markdown']`), and mixed names / tuples are supported. Wrap tuples in the outer array. `reporter: []` disables report artifacts; checks and separately configured history still run.

```bash
meodp check links.yml --reporter=json,markdown,html --output reports/check
meodp sitemap https://example.com/sitemap.xml --reporter=json
meodp report reports/data.json --reporter=markdown --output reports/export
meodp report reports/data.json --reporter=json --reporter=html
```

| Reporter   | Default output under the output directory | Tuple options                                                                  |
| ---------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| `json`     | `report.json`                             | `outputFile`                                                                   |
| `markdown` | `report.md`                               | `outputFile`                                                                   |
| `html`     | `index.html` + `report.json`              | `outputFolder`, or `outputFile` for a standalone HTML file; optional `dataUrl` |

HTML folders embed a snapshot and load the sidecar when hosted. A standalone HTML file embeds its snapshot without needing a sidecar; `dataUrl` can opt into hosted data loading. HTML without input produces an empty viewer; JSON and Markdown require a report. All reporters write files, and none launches a browser. Only these built-in reporters and the built-in HTML viewer are supported.

Selection precedence is CLI `--reporter` → command section (`check.reporter`, `sitemap.reporter`, `report.reporter`) → top-level `reporter` → command defaults. The selection replaces the whole list, including tuple options. Thus the same project can generate several formats after checking and export only HTML while building its status page:

```ts
import { defineConfig } from 'meodp/config'

export default defineConfig({
  reporter: ['json', 'markdown', 'html'],
  check: { input: 'links.yml', output: 'reports/check' },
  report: {
    input: 'reports/check/report.json',
    reporter: 'html',
    output: 'dist/status',
  },
})
```

Explicit tuple `outputFile` / `outputFolder` paths are relative to the config file and take precedence over the default directory. `--output` overrides the command's `output` directory for reporters without explicit paths; CLI paths are relative to the working directory. To redirect all outputs, supply both `--reporter` and `--output`. `--data-url` overrides all HTML data URLs; otherwise each HTML tuple overrides `report.dataUrl`.

Without any reporter selection, checks retain the three files below and `report` retains its static site export. Default output directories remain `reports/meodp` for checks and `reports/site` for `report`. Invalid reporters/options and overlapping output paths fail before a scan or any report writes. JSON and HTML may share `report.json` because both write the same data. Selecting fewer formats leaves old files in place; use a fresh directory for a clean export. History and notification inputs require JSON independently of the selected artifacts.

For library use, `writeReporters(report, reporter, { outputDir?, cwd?, dataUrl? })` from `meodp/check` accepts the same selection and returns `{ reporter, files }[]`. Omit the report only for HTML templates. `formatReport()`, `writeReports()`, and `writeReportSite()` remain available with their existing behavior.

## Open or share a report

Without a reporter selection, `check` and `sitemap` write three files to `--output`:

| File          | Use                                                           |
| ------------- | ------------------------------------------------------------- |
| `report.json` | Structured `schemaVersion: 1` data, history, and integrations |
| `report.md`   | Readable tables for reviews and automation                    |
| `report.html` | Standalone interactive snapshot with embedded data            |

The HTML viewer supports status filters, name/URL search, sorting, pagination, expandable details, and JSON download. Its current interface is in Chinese. It runs without a backend and never starts page checks.

To generate a static report site from saved data:

```bash
pnpm exec meodp report reports/links/report.json --output reports/site
```

This writes `index.html` and `report.json`. When served over HTTP(S), the viewer requests the JSON on each visit with `cache: no-cache`; opening `index.html` with `file://` uses the embedded snapshot. Regenerate or replace the JSON after a later scan to make fresh data available.

To create an empty viewer or choose a hosted data source:

```bash
pnpm exec meodp report --output reports/viewer
pnpm exec meodp report --output reports/viewer --data-url https://example.com/report.json
```

Readers can select or drop a local JSON file, or enter an HTTP(S) or relative JSON URL. Local files stay in the browser. Cross-origin requests require CORS from the data server. URL loading has a 15-second timeout; imports are limited to 10 MiB and 50,000 results. Invalid reports show an error.

The static report viewer and this VitePress documentation site are separate outputs. Publishing either is an explicit deployment step.
