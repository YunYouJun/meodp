# API 参考

从 `meodp/check` 导入 Node.js HTTP 检测器，支持 ESM、CommonJS 与 TypeScript 类型声明。该入口不需要浏览器。

## 检查 URL

```ts
import { checkLinks, checkSitemap, readSitemapUrls } from 'meodp/check'

const links = await checkLinks(['https://example.com/'], { observer: 'ci' })
const pages = await checkSitemap('https://example.com/', { discover: true })
const urls = await readSitemapUrls('https://example.com/sitemap.xml')
```

| 函数                                | 输入                                                 | 返回值                          |
| ----------------------------------- | ---------------------------------------------------- | ------------------------------- |
| `checkLinks(input, options?)`       | 字符串或 `LinkTarget` 对象的只读数组；`CheckOptions` | `Promise<CheckReport>`          |
| `checkSitemap(source, options?)`    | Sitemap 或站点 URL；`SitemapOptions`                 | `Promise<CheckReport>`          |
| `readSitemapUrls(source, options?)` | Sitemap 或站点 URL；`SitemapOptions`                 | `Promise<string[]>`，不检测页面 |

`checkLinks()` 在请求前校验全部输入，结果保持规范化后的输入顺序。请求失败会成为检测记录；输入、选项错误或自定义 `onResult` 回调抛错则会拒绝整次调用。`readSitemapUrls()` 只发出发现请求，历史与结果回调用于页面检测阶段。

## 检测选项 {#check-options}

| 选项             | 默认值     | 范围或行为                                                  |
| ---------------- | ---------- | ----------------------------------------------------------- |
| `concurrency`    | `5`        | 整数，1–100                                                 |
| `timeoutMs`      | `10000`    | 整数，1–300000；每次请求的毫秒数，包含响应体                |
| `retries`        | `1`        | 整数，0–5；用于传输错误和 5xx                               |
| `maxRedirects`   | `5`        | 整数，0–20；每次尝试的跳转上限                              |
| `observer`       | 系统主机名 | 非空的环境标识                                              |
| `previousReport` | 无         | 相同 observer 的上次 `CheckReport`                          |
| `onResult`       | 无         | 每个 URL 完成后的同步或异步回调；完成顺序可能不同于输入顺序 |

`SitemapOptions` 在此基础上增加 `discover`、`maxUrls`、`maxSitemaps` 和 `maxSitemapBytes`。默认值、范围及发现失败行为详见 [sitemap 指南](../guide/sitemap)。

## 报告辅助函数

```ts
import { checkLinks, formatReport, writeReports, writeReportSite } from 'meodp/check'

const report = await checkLinks(['https://example.com/'])
const markdown = formatReport(report)
await writeReports(report, 'reports/links')
await writeReportSite(report, 'reports/site')
await writeReportSite(undefined, 'reports/viewer', { dataUrl: './latest.json' })
```

| 函数                                                      | 返回结果                                                                      |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `formatReport(report, format?)`                           | 字符串，格式为 `markdown`（默认）、`json` 或 `html`                           |
| `writeReports(report, directory)`                         | 返回 `{ json, markdown, html }` 文件路径的 Promise                            |
| `writeReportSite(reportOrUndefined, directory, options?)` | 返回 `{ index, json? }` 的 Promise；`ReportSiteOptions.dataUrl` 指定托管 JSON |
| `readReport(path)`                                        | 返回已校验的 `CheckReport`；文件不存在时返回 `undefined`                      |
| `saveReport(report, path)`                                | 原子替换历史文件后完成的 Promise                                              |
| `parseReport(data)`                                       | 校验未知的已解析 JSON 并返回 `CheckReport`；格式不合法则抛错                  |

`parseReport()` 会验证报告中的汇总是否与校验后的结果一致。导入 JSON 字符串时，先使用 `JSON.parse()` 再调用该函数。结果含义与查看器行为详见[报告与历史](../guide/reports)。

## 导出的数据类型

以下声明直接引入包内源码，避免文档字段与实现不同步。

::: details 检测目标、观测结果、报告及选项类型
<<< @/../packages/meodp/src/check/types.ts
:::

包根入口 `meodp` 保留实验性浏览器 API。新 HTTP 集成使用 `meodp/check`；旧版 `checkSiteMap()` 是独立的实验性 API。
