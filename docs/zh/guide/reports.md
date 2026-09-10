# 报告与历史

## 理解检测结果 {#results}

每条结果记录 URL、最终 URL、跳转过程、HTTP 状态或失败原因、耗时、尝试次数以及检测时间。

| 状态          | 含义                                                             |
| ------------- | ---------------------------------------------------------------- |
| `reachable`   | 最终 HTTP 响应为 2xx                                             |
| `restricted`  | HTTP 401、403、429、451 或 999；当前检测环境无法确定站点是否正常 |
| `unavailable` | 其他 HTTP 响应，或 DNS、TLS、超时、网络、跳转错误                |

跳转可能以任何一种状态结束。友链迁移域名时值得人工检查，但跳转本身不代表不可用。成功响应也不能证明页面内容或域名归属符合预期。

传输错误和 5xx 响应可以重试，访问受限响应不会重试。`attempts` 包含首次尝试。CI 行为详见 [CLI 失败策略](../reference/cli#exit-codes)。

## 比较多次检测 {#history}

为每个网络环境和 URL 集合使用独立的历史文件：

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

历史文件不存在时开始首次记录；数据格式错误或 `observer` 不匹配时会报错。应在检测完成后保存，`saveReport()` 会原子替换历史文件。

| 字段                  | 含义                                                    |
| --------------------- | ------------------------------------------------------- |
| `consecutiveFailures` | 连续观测到 `unavailable` 的次数；可访问或访问受限会清零 |
| `firstFailureAt`      | 当前连续失败记录的起点                                  |
| `lastSuccessAt`       | 最近一次观测到可访问的时间                              |
| `changed`             | 状态或最终 URL 与上次不同                               |
| `recovered`           | 上次不可用，本次可访问                                  |

历史文件保存本次集合，不会累积所有旧记录。多次失败属于独立观测，不能据此认定两次检测之间持续宕机。

## 查看与分享报告

`check` 和 `sitemap` 会在 `--output` 目录写入三个文件：

| 文件          | 用途                                              |
| ------------- | ------------------------------------------------- |
| `report.json` | `schemaVersion: 1` 结构化数据，用于历史记录与集成 |
| `report.md`   | 适合审阅与自动化流程的表格                        |
| `report.html` | 内嵌数据的独立交互快照                            |

HTML 查看器支持状态筛选、名称与 URL 搜索、排序、分页、展开详情和下载 JSON，目前界面为中文。它无需后端，也不会发起页面检测。

将已有报告导出为静态报告站点：

```bash
pnpm exec meodp report reports/links/report.json --output reports/site
```

命令生成 `index.html` 和 `report.json`。通过 HTTP(S) 托管时，查看器每次访问都会以 `cache: no-cache` 请求 JSON；通过 `file://` 直接打开 HTML 时使用内嵌快照。后续检测完成后，重新生成或替换 JSON 即可提供新数据。

也可以生成空查看器，或指定托管数据地址：

```bash
pnpm exec meodp report --output reports/viewer
pnpm exec meodp report --output reports/viewer --data-url https://example.com/report.json
```

读者可以选择或拖入本地 JSON，也可以输入 HTTP(S) 或相对 JSON URL。本地文件仅在浏览器内读取；跨域加载需要数据源允许 CORS。URL 加载超时为 15 秒，导入上限为 10 MiB、50,000 条结果，报告格式错误时会显示提示。

静态报告查看器与本 VitePress 文档站是两个独立产物，发布时需要分别部署。
