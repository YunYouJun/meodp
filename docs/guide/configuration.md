# Project configuration and notifications

Use `meodp/config` to keep a project's HTTP checks, report output, and notification settings in `meodp.config.ts`. This lightweight entry includes TypeScript declarations and does not load browser or mail clients. It is available starting with meodp 0.2.0.

```ts
// meodp.config.ts
import process from 'node:process'
import { defineConfig } from 'meodp/config'

export default defineConfig({
  check: {
    reporter: ['json', 'markdown', ['html', { outputFolder: 'reports/site' }]],
    input: 'public/links.yml',
    output: 'reports/links',
    history: '.cache/links.json',
    observer: 'ci',
    failOn: 'none',
  },
  report: {
    reporter: 'html',
    input: 'public/status/report.json',
    output: 'dist/status',
    verify: { url: 'https://example.com/status/report.json' },
  },
  notify: {
    input: 'reports/links/report.json',
    previousReport: 'public/status/report.json',
    title: 'My links',
    failureThreshold: 2,
    reportUrl: 'https://example.com/status/',
    timeZone: 'Asia/Shanghai',
    feishu: {
      mode: 'off',
      transport: 'app',
      appId: process.env.FEISHU_APP_ID,
      appSecret: process.env.FEISHU_APP_SECRET,
      receiveId: process.env.FEISHU_RECEIVE_ID,
      receiveIdType: 'open_id',
    },
  },
})
```

```bash
meodp check
meodp check --timeout 15000 --fail-on unavailable
meodp report
meodp report --verify
meodp notify --channel feishu --mode changes --dry-run
```

## Configuration rules

- `check`, `sitemap`, `report`, and `notify` discover `meodp.config.ts` in the current directory. Select another file with `--config path/to/meodp.config.ts`.
- Explicit CLI arguments override configuration values, which override built-in defaults. Input positionals can be omitted when the corresponding section defines `input`.
- File paths in configuration are relative to the config file. CLI file paths are relative to the working directory. Sitemap inputs remain HTTP(S) URLs.
- `meodp`, `--help`, and `--version` do not load configuration or run checks. A missing explicit config or a config that throws exits with code `2`.
- Config files execute trusted project code. Environment values are read only when your config references them; the HTTP commands do not automatically load `.env` files.
- The existing browser scanner's `defineConfig` from `meodp` retains its legacy shape. Use the separate `meodp/config` entry for these HTTP commands.

`check` accepts the [HTTP check options](../reference/api#check-options), with `history` replacing the in-memory `previousReport`. `sitemap` additionally accepts discovery options such as `discover` and `maxUrls`. `site` optionally writes a portable static viewer after the check; `report` renders existing data independently.

`report.input` is the saved JSON read by `meodp report`; `report.reporter` selects what that command writes. The example reads the published snapshot, which your CI saves separately after checking. For a direct check → export flow, point `report.input` to `reports/links/report.json`. Select formats with top-level or command-specific `reporter`, using names or `[name, options]` tuples. CLI `--reporter` accepts comma-separated or repeated names. See [reporter formats and precedence](./reports#reporters).

## History and deployment

`historySeed` can point to a committed report to restore a missing local history file on a fresh CI runner. Invalid history is an error. An observer mismatch is an error by default; set `observerMismatch: 'reset'` explicitly to start a new baseline when the network/environment changes. Use separate observers and history files for CI and local runs.

```ts
import { defineConfig } from 'meodp/config'

export default defineConfig({
  check: {
    input: 'links.yml',
    history: '.cache/ci.json',
    historySeed: 'public/status/report.json',
    observer: 'github-actions-ubuntu',
    observerMismatch: 'reset',
  },
})
```

Keep scheduling, artifact storage, snapshot commits, and hosting deployment in your repository's CI. `meodp report --verify` polls `report.verify.url` until the served JSON matches `report.input` and the same directory contains the MEODP viewer. It defaults to 12 attempts, 15 seconds apart; configure `attempts` and `delayMs` to change this. A timeout exits with `2`.

Send notifications only after deployment verification succeeds. Compare against the snapshot from **before** the current run's update: checkout the triggering commit in a separate notification job, or save a previous report before replacing it. Comparing a report to itself suppresses change notifications.

## Notification policy

Each channel has its own `mode`, defaulting to `off`. The CLI's `--mode` overrides selected channels. `createNotification()` uses `changes` by default for direct library calls and returns `undefined` when there is nothing to send.

| Mode      | Behavior                                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| `off`     | Skip before reading reports or using credentials                                                                  |
| `changes` | New unavailable/restricted state, first crossing of the failure threshold, recovery, or lifted access restriction |
| `weekly`  | Summary on every invocation, including current problems and recoveries                                            |

`weekly` does not create a schedule. The failure threshold defaults to 2 observations, not an elapsed downtime duration. Unchanged failures after crossing the threshold stay quiet in `changes` mode. The structured entry kinds are `unavailable`, `restricted`, `failure-threshold`, `recovered`, and `restriction-lifted`. Comparing reports from different observers fails unless `notify.observerMismatch` explicitly requests `reset`.

```bash
# Render without credentials or sending. Off channels remain off unless overridden.
meodp notify --channel feishu --mode weekly --dry-run

# Preview an explicitly labeled test, using an optional saved historical snapshot.
meodp notify --channel feishu --test --dry-run

# Send a test even if this channel is off; credentials and recipient must be configured.
meodp notify --channel feishu --test
```

When multiple channels are configured, `--test` requires `--channel`. Normal invocations can select one channel or process all configured channels in order. Use separate CI jobs per channel if delivery failures must be independent. Notifications return `0` when sent, previewed, or skipped, and `2` for configuration/delivery errors.

## Delivery and library reuse

Feishu cards contain status counts, observation time, up to six entries, and optional report/run buttons. `timeZone` defaults to `UTC`; `maxItems` accepts 1–6. App delivery obtains a tenant token and sends to `open_id` (default), `user_id`, `union_id`, or `email`. Set `transport: 'app'` explicitly for direct messages. The adapter defaults to `webhook` and accepts a Feishu custom-bot `webhook`, optional signing `secret`, and optional `keyword`.

Email delivery uses `notify.email` with `host`, `port`, `user`, `password`, `from`, and `to`. Install the optional `nodemailer` peer only when sending email (`pnpm add -D nodemailer@^10.0.3`). Port 465 uses TLS; 587 requires STARTTLS. Dry runs do not load Nodemailer. Read credentials from environment variables; keep recipient IDs and secrets out of tracked files.

The API separates the pure notification policy from delivery:

```ts
import { readReport } from 'meodp/check'
import { createNotification } from 'meodp/notify'
import { createFeishuCard } from 'meodp/notify/feishu'

const report = await readReport('reports/links/report.json')
const previousReport = await readReport('public/status/report.json')
if (report) {
  const message = createNotification(report, { previousReport, title: 'My links' })
  if (message)
    console.log(createFeishuCard(message, { timeZone: 'Asia/Shanghai' }))
}
```

Call `sendFeishuNotification(message, options)` from `meodp/notify/feishu` or `sendEmailNotification(message, options)` from `meodp/notify/email` to deliver. `waitForReport(report, options)` is exported from `meodp/check`. These functions do not read your project's config or environment automatically.
