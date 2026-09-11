# MEODP (Mystic Eyes of Death Perception)

[![npm version](https://img.shields.io/npm/v/meodp)](https://www.npmjs.com/package/meodp)

[English](https://yunyoujun.github.io/meodp/) | [简体中文](https://yunyoujun.github.io/meodp/zh/)

Check website and friend-link availability from Node.js or the command line. Built on [linkinator](https://github.com/JustinBeckwith/linkinator), with interactive HTML, JSON, and Markdown reports and optional history across runs.

Requires **Node.js 22.19+**. The `meodp/check` entry, `meodp check`, and `meodp sitemap` commands do not require Playwright or a browser installation.

Guides: [English](https://yunyoujun.github.io/meodp/guide/quick-start.html) · [简体中文](https://yunyoujun.github.io/meodp/zh/guide/quick-start.html). The repository's VitePress site includes API/CLI references and workspace development instructions in both languages.

## Install

```bash
pnpm add meodp
```

## Library

```ts
import { checkLinks, formatReport, readReport, saveReport, writeReports } from 'meodp/check'

const historyFile = '.cache/link-check/local.json'
const report = await checkLinks([
  { name: '云游君', url: 'https://www.yunyoujun.cn/' },
  'https://example.com/',
], {
  observer: 'my-local-network',
  previousReport: await readReport(historyFile),
  concurrency: 5,
  timeoutMs: 10000,
  retries: 1,
})

console.log(formatReport(report))
await writeReports(report, 'reports/links')
await saveReport(report, historyFile)
```

`checkLinks()` returns a report without writing files. URL strings and objects with `url` and optional `name` are accepted; duplicate normalized URLs are checked once, in input order. Other fields such as friend email addresses are not copied into reports. Invalid input rejects before any requests are made.

| Option           | Default          | Meaning                                                   |
| ---------------- | ---------------- | --------------------------------------------------------- |
| `concurrency`    | `5`              | Simultaneous site checks, from 1 to 100                   |
| `timeoutMs`      | `10000`          | Per-request timeout in milliseconds, from 1 to 300000     |
| `retries`        | `1`              | Additional attempts for transport/5xx errors, from 0 to 5 |
| `maxRedirects`   | `5`              | Maximum followed redirects per attempt, from 0 to 20      |
| `observer`       | Machine hostname | Identifies the network used for these observations        |
| `previousReport` | None             | Previous report from the same observer                    |
| `onResult`       | None             | Optional callback when each site's observation is ready   |

Each observation includes its HTTP status, final URL, redirect chain, duration, attempt count, failure reason, last success, consecutive failed runs, and recovery/change flags. `formatReport(report, 'html')` returns a self-contained interactive HTML report; `'json'` returns JSON; the default is Markdown. `writeReports()` writes `report.html`, `report.json`, and `report.md` and returns `{ html, json, markdown }`.

## Project configuration

Starting with 0.2.0, HTTP commands read `meodp.config.ts`:

```ts
import { defineConfig } from 'meodp/config'

export default defineConfig({
  reporter: ['json', 'markdown', ['html', { outputFolder: 'reports/site' }]],
  check: {
    input: 'public/links.yml',
    output: 'reports/links',
    history: '.cache/links.json',
    failOn: 'none',
  },
  report: { input: 'reports/links/report.json', reporter: 'html', output: 'dist/status' },
})
```

Run `meodp check` to collect observations or `meodp report` to render saved data. CLI options override config values. Config file paths are relative to the config; CLI paths are relative to your working directory.

The same config supports history seeding, deployment verification (`meodp report --verify`), and optional Feishu / SMTP notifications (`meodp notify`). Reuse the pure policy from `meodp/notify` and delivery adapters from `meodp/notify/feishu` or `meodp/notify/email`. Email requires the optional Nodemailer peer only for sending. Notification channels default to off; use `--mode changes|weekly` to enable and `--dry-run` to preview.

See the [configuration guide](https://yunyoujun.github.io/meodp/guide/configuration) ([中文](https://yunyoujun.github.io/meodp/zh/guide/configuration)). The older browser `defineConfig` at the package root remains unchanged; HTTP projects import from `meodp/config`.

Override formats with `--reporter=json,markdown,html` or repeated `--reporter` flags. JSON / Markdown tuples accept `outputFile`; HTML accepts `outputFolder` or a standalone `outputFile`. See [reporter formats and path precedence](https://yunyoujun.github.io/meodp/guide/reports#reporters).

## Sitemap page checks

Check all pages listed in an XML sitemap, reusing the same HTTP observations, history, and reports:

```ts
import { checkSitemap, readSitemapUrls, writeReports } from 'meodp/check'

const report = await checkSitemap('https://example.com/sitemap.xml', {
  concurrency: 5,
  timeoutMs: 10000,
  maxUrls: 10000,
})
await writeReports(report, 'reports/pages')

// Start from a site: read Sitemap directives in robots.txt, then /sitemap.xml if none exist.
const siteReport = await checkSitemap('https://example.com/', { discover: true })

// Inspect or select the page list before making any page requests.
const urls = await readSitemapUrls('https://example.com/sitemap.xml')
```

```bash
pnpm exec meodp sitemap https://example.com/sitemap.xml --output reports/pages
pnpm exec meodp sitemap https://example.com/ --discover --output reports/pages \
  --history .cache/sitemap/local.json --observer my-local-network
pnpm exec meodp sitemap --help
```

Supports XML URL sets, nested sitemap indexes, namespaces, CDATA, XML entities, gzip files, redirects, and multiple `Sitemap:` directives in `robots.txt`. Relative entries resolve against the final sitemap URL. Pages and indexes are deduplicated; fragment identifiers are removed and query strings are preserved. Cyclic indexes terminate. Sitemaps may list pages on other HTTP(S) origins; those explicit entries are included.

All `checkLinks()` options also apply. `readSitemapUrls()` only requests discovery documents; `checkSitemap()` then checks the complete list with the existing linkinator adapter. Sitemap documents are read sequentially; `concurrency` controls page checks. HTTP timeouts, retries, and redirect limits apply to both phases. Only transport/5xx discovery failures are retried. Robots discovery falls back for 404/410 or a successful file with no sitemap declarations; other errors are surfaced.

| Additional option                         | Default    | Meaning                                                                     |
| ----------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| `discover` / `--discover`                 | `false`    | Treat the input as a site URL; otherwise it is an explicit sitemap URL      |
| `maxUrls` / `--max-urls`                  | `10000`    | Maximum unique pages, configurable up to 50000                              |
| `maxSitemaps` / `--max-sitemaps`          | `100`      | Maximum sitemap documents, configurable up to 10000                         |
| `maxSitemapBytes` / `--max-sitemap-bytes` | `10485760` | Per-document downloaded/decompressed byte limit, configurable up to 100 MiB |

Discovery is complete before any page checks begin. A missing or unreadable nested sitemap, invalid XML/URL, empty page list, or exceeded limit rejects the run. The CLI exits with `2` and preserves existing reports/history, even with `--fail-on none`; it never saves a silently truncated page list. Page findings use the same `0`/`1` exit policies as `meodp check`.

This mode measures HTTP availability of sitemap-listed pages. It does not follow their article links, check embedded assets, execute JavaScript, or apply robots `Disallow` rules. XML parsing and validation use [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser); MEODP handles bounded discovery and delegates page checks to linkinator. Linkinator also offers a [native sitemap scan](https://github.com/JustinBeckwith/linkinator#command-usage), but its public API combines discovery with page/link scanning. Keeping discovery separate preserves MEODP's URL-only probes and existing redirect/history semantics.

## CLI

Use explicit subcommands to distinguish a fresh network check from rendering saved data:

| Command        | Input                            | Behavior                                                       |
| -------------- | -------------------------------- | -------------------------------------------------------------- |
| `meodp check`  | URL array in JSON/YAML           | Request sites and write fresh HTML, Markdown, and JSON reports |
| `meodp report` | Saved `report.json`, or no input | Render JSON, Markdown or HTML; no site-check requests          |
| `meodp scan`   | Legacy config directory          | Run the experimental Playwright scanner                        |

`meodp`, `meodp --help`, and `meodp help` display the command overview. Use `meodp check -h` or `meodp help report` for details; `meodp --version` / `-v` prints the version. Unknown commands exit with code `2` instead of starting a scan. Help and version do not require Playwright.

Create `links.yml` (JSON arrays also work):

```yaml
- name: 云游君
  url: https://www.yunyoujun.cn/
- name: Example
  url: https://example.com/
```

```bash
pnpm exec meodp check links.yml --output reports/links

# Persist observations from one network across separate runs.
pnpm exec meodp check links.yml --output reports/links \
  --history .cache/link-check/local.json --observer my-local-network

# Generate a maintenance report without failing because a friend is unavailable.
pnpm exec meodp check links.yml --fail-on none

pnpm exec meodp check --help
```

`meodp check` inputs are local `.json`, `.yml`, or `.yaml` files. A friends-style array containing additional fields is supported directly. Only its `url` and `name` are used. Download remote list data explicitly before checking it; use `meodp sitemap` for remote sitemap inputs.

Exit codes:

- `0`: the selected policy passed.
- `1`: observations matched the policy. Default `--fail-on unavailable` fails on unavailable sites; `--fail-on review` also includes restricted access and redirects.
- `2`: invalid input/options, incompatible or corrupt history, or an execution/report-writing error. `--fail-on none` does not suppress these errors.

### Project scripts

Keep the package CLI general and name project scripts after their specific subject:

```json
{
  "scripts": {
    "check:links": "meodp check public/links.yml --output reports/links --fail-on none",
    "report:links": "meodp report reports/links/report.json --output reports/site"
  }
}
```

Use `pnpm run check:links` and `pnpm run report:links`; keep `lint`, `typecheck`, and `test` for code validation. `report:links` should render existing observations rather than implicitly invoke `check:links`. This makes exporting a report reproducible without another network scan. In CI, select the failure policy explicitly; friends uses `check:links:ci` with its own observer and history file.

Documentation and CI use explicit `pnpm run <script>` for project scripts and `pnpm exec meodp <command>` for the package CLI. [pnpm documents](https://pnpm.io/cli/run) script-name shorthand only when it does not conflict with a built-in command; options after the script name are passed to the script.

## Interactive report and static site

Open `report.html` directly in a browser. It embeds the data, script, and styles in one file and works offline. The viewer supports status filters, name/URL search, sorting, pagination, expandable HTTP/error/redirect/history details, local JSON import (including drag-and-drop), JSON URL loading, and downloading the loaded report. Mobile layouts keep technical fields inside expandable details.

Export an existing report as a static site, **without checking the sites again**:

```bash
pnpm exec meodp report reports/links/report.json --output reports/site

# A reusable viewer with no bundled data; users can load their own JSON.
pnpm exec meodp report --output reports/viewer

# Read data from another location (cross-origin sources must allow CORS).
pnpm exec meodp report --output reports/viewer --data-url https://example.com/report.json
```

Upload the contents of `reports/site/` to any static host, including a subdirectory. No Node.js server, database, browser automation, or CDN assets are needed at runtime. The output contains:

- `index.html`: the interactive viewer with an embedded snapshot.
- `report.json`: the data loaded on each hosted page visit, with cache bypassed. Replace it after a new scan to update the hosted view.

Opening `index.html` through `file://` uses the embedded snapshot; choose a JSON file to load newer data offline. A hosted data-load failure displays an error and retains the embedded/current report. `--data-url` overrides the hosted source. The page reads reports; scanning still runs in Node.js or CI. Displayed timestamps always come from the observations, not the page load time.

```ts
import { parseReport, writeReportSite } from 'meodp/check'

const report = parseReport(JSON.parse(jsonText))
await writeReportSite(report, 'reports/site')
await writeReportSite(undefined, 'reports/viewer', { dataUrl: './data/report.json' })
```

The viewer accepts MEODP `schemaVersion: 1` reports, validates observations and summary counts, and renders names/errors as text. Local files stay in the browser. Browser imports are limited to 10 MiB and 50,000 sites; HTTP data loads time out after 15 seconds. No remote scanning occurs in the viewer. Publish only the report data you intend to share: reports include observer names, site URLs, times, and error details.

## Interpreting results

| Status        | Meaning                                                                               |
| ------------- | ------------------------------------------------------------------------------------- |
| `reachable`   | The requested URL, possibly after redirects, returned HTTP 2xx                        |
| `restricted`  | HTTP 401, 403, 429, 451, or 999; access needs review                                  |
| `unavailable` | Other HTTP errors, transport/DNS/TLS failures, timeouts, or invalid/looping redirects |

`checkLinks()` requests only the supplied URLs and their redirect destinations. `checkSitemap()` first reads discovery documents, then uses those same probes for the listed pages. The checker uses GET for the pages and does not request discovered article links, images, scripts, or stylesheets. Redirects are recorded separately from availability; a redirect to a working site is still reachable.

Results describe **this observer at this time**. HTTP 2xx does not verify content, detect expired-domain parking, execute JavaScript, or prove that a blog is still owned by the same person. Restricted results require manual or browser verification. Sites using JavaScript redirects or returning a challenge page with HTTP 200 need separate verification.

`consecutiveFailures` counts separate completed runs, not retries within one run or days of continuous downtime. A reachable or restricted observation breaks that failure streak. Previous success is retained. History must use the same observer; use distinct files for different machines or CI networks. Missing history starts a new record; corrupt history is an error. Use one writer per history file.

MEODP reports observations; it does not remove friends, change their addresses, or send notifications.

## Existing browser scanner

The original Playwright-based scanner remains available through the root library entry and `meodp scan [root]` with `meodp.config.ts`. Install `playwright` and its browsers separately to use it. Its experimental resource scanning and legacy report format are separate from `meodp/check`; its CLI does not implement the new failure policies. The old `meodp export` command is retained for that legacy report format; use `meodp report` for a new `schemaVersion: 1` JSON report.

**CLI migration for 0.1:** change a bare `meodp` scan to `meodp scan`, and `meodp ./project` to `meodp scan ./project`. The bare command now displays help. Existing `meodp check` / `meodp report` invocations and library APIs are unchanged.

The former development-only `meodp-ts` executable is no longer shipped. Run `pnpm --filter meodp exec tsx bin/index.ts` from the workspace root when developing.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
pnpm pack
```

The viewer source lives in `packages/meodp/src/check/viewer/` in the repository. Build, test, and typecheck commands bundle its browser TypeScript and CSS into an ignored generated module; published HTML needs no runtime dependencies.

Tests use local HTTP servers for redirects, restricted access, transient failures, timeouts, history, report output, CLI exit policies, and sitemap discovery (indexes, gzip, namespaces, cycles, limits, and partial failures). They do not scan external sites. Library type checking and declaration generation use the package's `tsconfig.json`, independently of the experimental client template.

See [competitive analysis](https://github.com/YunYouJun/meodp/blob/main/docs/competitive-analysis.md) for the project scope and alternatives.
