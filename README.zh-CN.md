# MEODP (Mystic Eyes of Death Perception)

[![npm version](https://img.shields.io/npm/v/meodp)](https://www.npmjs.com/package/meodp)
[![npm downloads](https://img.shields.io/npm/dm/meodp)](https://www.npmjs.com/package/meodp)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[English](README.md) | **简体中文**

[中文文档](https://yunyoujun.github.io/meodp/zh/) · [English docs](https://yunyoujun.github.io/meodp/) · [npm](https://www.npmjs.com/package/meodp)

检查网站与友链可访问性，支持 sitemap 子页面发现、历史记录，以及交互式 HTML、JSON、Markdown 报告。底层 HTTP 检测基于 [linkinator](https://github.com/JustinBeckwith/linkinator)。

## 安装

需要 **Node.js 22.19+**。HTTP 检测不需要安装 Playwright 或浏览器。

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

`check` 和 `sitemap` 会发出 HTTP 请求；`report` 只展示已有结果。不带参数运行 `meodp` 显示帮助。旧版浏览器扫描器使用显式的 `meodp scan` 命令及原有配置。

访问受限不等于站点失效；检测结果只代表当前网络环境。返回 200 也不能证明页面内容正常，详见[报告与历史](https://yunyoujun.github.io/meodp/zh/guide/reports.html)。

## 项目配置

从 0.2.0 开始，HTTP 命令可通过 `meodp.config.ts` 集中配置：

```ts
import { defineConfig } from 'meodp/config'

export default defineConfig({
  check: {
    reporter: ['json', 'markdown', ['html', { outputFolder: 'reports/site' }]],
    input: 'public/links.yml',
    output: 'reports/links',
    history: '.cache/links.json',
    failOn: 'none',
  },
  report: { input: 'reports/links/report.json', reporter: 'html', output: 'dist/status' },
})
```

执行 `meodp check` 检测，`meodp report` 渲染已有报告。`check.reporter` 指定检测产物，`report.input` 指定要读取的 JSON，`report.reporter` 指定导出格式；顶层 `reporter` 仅用于共享默认格式。命令行参数优先于配置，配置内的文件路径相对配置文件解析。

同一配置还支持历史恢复、部署验证和飞书 / SMTP 通知。通用策略通过 `meodp/notify` 复用，卡片及投递使用 `meodp/notify/feishu`、`meodp/notify/email`。通知通道默认关闭，使用 `--mode changes|weekly` 启用、`--dry-run` 预览。完整示例见[项目配置与通知](docs/zh/guide/configuration.md)。

使用 `--reporter=json,markdown,html` 或重复的 `--reporter` 覆盖格式。JSON / Markdown 元组支持 `outputFile`，HTML 支持 `outputFolder` 或单文件 `outputFile`。格式与路径优先级详见[报告指南](docs/zh/guide/reports.md#reporters)。

## 工作区

参考 [starter-monorepo](https://github.com/YunYouJun/starter-monorepo) 划分模块，只有 `packages/meodp` 用于 npm 发布，其余工作区包保持 private。

```text
packages/meodp/   SDK、CLI、报告查看器与测试
apps/client/      实验性 Vitesse 客户端
docs/            中英文 VitePress 文档与调研笔记
examples/app/    使用 workspace:* 引用 meodp 的示例
```

报告查看器打包在库内，不依赖实验性客户端。

## 开发与检查

```bash
pnpm install
pnpm --filter meodp exec playwright install
pnpm run ci
```

`pnpm run ci` 依次运行 lint、类型检查、HTTP 测试、包构建、浏览器测试和文档构建。也可单独运行 `pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm build`、`pnpm test:e2e` 和 `pnpm docs:build`。

`pnpm docs:dev` 启动双语文档，`pnpm docs:preview` 预览构建结果；`pnpm dev:client` 启动实验性客户端。`pnpm demo` 使用示例配置运行旧版浏览器扫描器，需要先安装 Playwright 浏览器。

源码 CLI 可用 `pnpm --filter meodp exec tsx bin/index.ts --help` 调试，`pnpm --filter meodp pack` 可检查本地 npm 包产物。Git hooks 和 lint 统一在根目录管理。

`pnpm release <patch|minor|major|version>` 只准备版本；发布匹配版本的 GitHub Release 后，由 OIDC 工作流发布 npm 包。详见[开发与发布指南](https://yunyoujun.github.io/meodp/zh/guide/development.html)。

项目范围与替代方案见[竞品调研](docs/competitive-analysis.md)。

## 许可证

[MIT](LICENSE)
