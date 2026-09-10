# MEODP (Mystic Eyes of Death Perception)

[![npm version](https://img.shields.io/npm/v/meodp)](https://www.npmjs.com/package/meodp)
[![npm downloads](https://img.shields.io/npm/dm/meodp)](https://www.npmjs.com/package/meodp)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**English** | [简体中文](README.zh-CN.md)

[Documentation](https://yunyoujun.github.io/meodp/) · [中文文档](https://yunyoujun.github.io/meodp/zh/) · [npm](https://www.npmjs.com/package/meodp)

Check website and friend-link availability with structured results, history, and portable reports. Built on [linkinator](https://github.com/JustinBeckwith/linkinator).

## Install

Requires **Node.js 22.19+**. The HTTP checker does not require Playwright or a browser installation.

```bash
pnpm add meodp
```

```ts
import { checkLinks, checkSitemap, writeReports } from 'meodp/check'

const links = await checkLinks(['https://example.com/'])
await writeReports(links, 'reports/links')

const pages = await checkSitemap('https://example.com/', { discover: true })
await writeReports(pages, 'reports/pages')
```

```bash
pnpm exec meodp check links.yml --output reports/links
pnpm exec meodp sitemap https://example.com/sitemap.xml --output reports/pages
pnpm exec meodp report reports/pages/report.json --output reports/site
```

`check` and `sitemap` make HTTP requests; `report` renders saved results without scanning. Running `meodp` with no arguments shows help. The optional legacy browser scanner uses `meodp scan` and its existing configuration.

Documentation: [English](docs/guide/quick-start.md) · [简体中文](docs/zh/guide/quick-start.md). Full usage and result semantics are also in the [package README](packages/meodp/README.md).

## Workspace

The workspace layout follows [starter-monorepo](https://github.com/YunYouJun/starter-monorepo). Only `packages/meodp` is published; the root, docs, client, and examples are private.

```text
packages/meodp/   Published SDK, CLI, report viewer, and tests
apps/client/      Existing experimental Vitesse client
docs/            Bilingual VitePress documentation and research notes
examples/app/    Consumer linked to meodp through workspace:*
```

The report viewer is bundled into the library's HTML output. It does not depend on the experimental client.

## Development

```bash
pnpm install
pnpm run ci
```

Or run individual checks:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm docs:build
pnpm docs:dev
pnpm exec meodp --help
pnpm --filter meodp pack
```

`pnpm build` and `pnpm test` target the published package; `pnpm typecheck` checks the package and docs configuration. `pnpm docs:dev` starts the bilingual documentation at `127.0.0.1`; `pnpm docs:preview` previews its built output. See the [development guide](docs/guide/development.md) for workspace commands and deployment base paths. Start the experimental client explicitly with `pnpm dev:client`. `pnpm demo` runs the legacy browser scanner against `examples/app/meodp.config.ts`; install Playwright browsers before using it.

`pnpm run ci` runs lint, type checking, HTTP tests, package build, browser tests, and the documentation build. Install test browsers once with `pnpm --filter meodp exec playwright install`.

For source-level CLI development, use `pnpm --filter meodp exec tsx bin/index.ts --help`. Shared Git hooks and lint rules live at the workspace root. Release commands target the `meodp` package; the workspace root cannot be published.

See [competitive analysis](docs/competitive-analysis.md) for the original investigation and project scope.

## License

[MIT](LICENSE)
