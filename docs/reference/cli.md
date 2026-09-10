# CLI reference

Run `pnpm exec meodp --help` for command discovery, `meodp <command> --help` or `meodp help <command>` for details, and `meodp --version` for the package version. No arguments shows help without starting a scan.

## Commands

```bash
meodp check links.yml --output reports/links
meodp sitemap https://example.com/sitemap.xml --output reports/pages
meodp sitemap https://example.com/ --discover
meodp report reports/pages/report.json --output reports/site
```

`check` accepts exactly one local `.json`, `.yml`, or `.yaml` file containing an array of URL strings or objects with `url` and optional `name`. It does not fetch remote input files. `sitemap` accepts exactly one HTTP(S) URL. Both make network requests and write reports after completion.

`report [report.json]` accepts at most one local report. Without one, it exports an empty viewer. Its options are `--output` (default `reports/site`) and `--data-url` (HTTP(S) or relative JSON URL loaded by the hosted viewer). Exporting does not check sites or fetch the data URL. See [reports](../guide/reports).

## Check and sitemap options

| Flag                   | Default         | Meaning                                            |
| ---------------------- | --------------- | -------------------------------------------------- |
| `--output <directory>` | `reports/meodp` | Write JSON, Markdown, and standalone HTML          |
| `--history <file>`     | None            | Read prior observations and save the completed run |
| `--observer <name>`    | Hostname        | Network/environment identifier; must match history |
| `--concurrency <n>`    | `5`             | 1–100 concurrent page checks                       |
| `--timeout <ms>`       | `10000`         | 1–300000 ms per request, including the body        |
| `--retries <n>`        | `1`             | 0–5 retries for transport/5xx failures             |
| `--max-redirects <n>`  | `5`             | 0–20 followed redirects per attempt                |
| `--fail-on <policy>`   | `unavailable`   | `unavailable`, `review`, or `none`                 |

Sitemap also supports `--discover`, `--max-urls`, `--max-sitemaps`, and `--max-sitemap-bytes`. See [discovery behavior and bounds](../guide/sitemap#supported-inputs-and-limits).

## Exit codes {#exit-codes}

These codes apply to `check` and `sitemap`:

| Code | Meaning                                                                             |
| ---- | ----------------------------------------------------------------------------------- |
| `0`  | Completed and passed the chosen policy                                              |
| `1`  | Completed, but findings matched the policy                                          |
| `2`  | Invalid input/options or an execution error, including incomplete sitemap discovery |

`unavailable` fails only for unavailable results. `review` also fails for restricted results and redirects. `none` accepts all completed observations but never suppresses input/execution errors. Reports and history are still saved when a completed run exits with `1`.

```bash
meodp sitemap https://example.com/sitemap.xml --fail-on review --observer ci
```

`report` exits with `0` after export or `2` on invalid input/execution failure.

## Legacy browser commands

```bash
meodp scan examples/app
meodp export examples/app --type md
```

`scan [root]` loads `meodp.config.ts` from the selected root (default `.`) and runs the experimental Playwright scanner. It requires Playwright and installed browsers. `export [root] [--type md|html]` exports that scanner's stored data; it does not consume the new `schemaVersion: 1` report format.

The older implicit `meodp [root]` invocation is now explicit `meodp scan [root]`. For new HTTP availability integrations, use `check` or `sitemap` and `report`.
