# Quick start

MEODP checks the HTTP availability of websites and friend links. It runs in Node.js or CI and produces reports you can inspect offline or publish as static files.

## Install

Use **Node.js 22.19 or newer**. No Playwright installation is needed for the `meodp/check` library, `check`, or `sitemap` commands.

```bash
pnpm add meodp
```

## Check a friend list

Create `links.yml` (JSON arrays also work):

```yaml
- name: Example
  url: https://example.com/
```

```bash
pnpm exec meodp check links.yml --output reports/links
```

Open `reports/links/report.html`. The same directory contains `report.json` and `report.md`.

Friends-style objects can contain avatar, email, or other fields: only `url` and `name` are used. Input URLs are validated before checking, normalized, and deduplicated. Duplicate fragments identify the same page; query strings remain distinct.

## Use the library

```ts
import { checkLinks, formatReport, writeReports } from 'meodp/check'

const report = await checkLinks([
  { name: 'Example', url: 'https://example.com/' },
], { concurrency: 5, retries: 1 })

console.log(formatReport(report))
await writeReports(report, 'reports/links')
```

`checkLinks()` returns data without writing files. Use [sitemap checks](./sitemap) to discover subpages, or [history](./reports#history) to compare separate runs.

## Choose the operation

| Operation | Makes page requests? | Purpose                                        |
| --------- | -------------------- | ---------------------------------------------- |
| `check`   | Yes                  | Check an explicit JSON/YAML URL list           |
| `sitemap` | Yes                  | Read sitemap documents, then check their pages |
| `report`  | No                   | Export an interactive viewer from saved data   |
| `scan`    | Yes, in a browser    | Run the experimental legacy scanner            |

Running `meodp` without arguments shows help. `meodp report` never starts a fresh scan.

The HTTP checker does not execute JavaScript, verify page content, or check embedded images/scripts. A 200 response can still be a challenge or parked-domain page. See [result interpretation](./reports#results).
