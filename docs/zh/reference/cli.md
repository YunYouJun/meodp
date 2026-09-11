# 命令行参考

执行 `pnpm exec meodp --help` 查看命令，`meodp <command> --help` 或 `meodp help <command>` 查看细节，`meodp --version` 查看包版本。不带参数只显示帮助，不会启动扫描。

## 命令

```bash
meodp check links.yml --output reports/links
meodp sitemap https://example.com/sitemap.xml --output reports/pages
meodp sitemap https://example.com/ --discover
meodp report reports/pages/report.json --output reports/site
meodp report reports/pages/report.json --reporter=json,markdown,html
meodp check --config meodp.config.ts
meodp notify --channel feishu --mode changes --dry-run
```

所有 HTTP 命令支持 `--config`，配置包含 `input` 时可省略位置参数。`notify` 读取已有报告生成或投递通知。详见[项目配置与通知](../guide/configuration)。

`check` 接收一个本地 `.json`、`.yml` 或 `.yaml` 文件，内容为 URL 字符串或带 `url`、可选 `name` 的对象数组，不会下载远程输入文件。`sitemap` 接收一个 HTTP(S) URL。两者都会发出网络请求，并在检测完成后生成报告。

`report [report.json]` 最多接收一个本地报告，不传且配置未提供输入时，默认 HTML 生成空查看器。支持 `--output`（默认 `reports/site`）和 `--data-url`（托管查看器加载的 HTTP(S) 或相对 JSON URL）。导出操作不会检查站点或请求数据 URL，详见[报告指南](../guide/reports)。

`check`、`sitemap`、`report` 都支持 `--reporter`，如 `--reporter=json,markdown` 或 `--reporter=json --reporter=html`。它替换配置中的整个 reporter 列表。JSON / Markdown 需要输入报告；HTML 支持空查看器。`--output` 设置默认目录，显式元组路径优先；完整规则见[报告格式](../guide/reports#reporters)。

## check 与 sitemap 通用选项

| 参数                   | 默认值          | 含义                                   |
| ---------------------- | --------------- | -------------------------------------- |
| `--output <directory>` | `reports/meodp` | 输出 JSON、Markdown 和独立 HTML        |
| `--history <file>`     | 无              | 读取历史并保存本次完整结果             |
| `--observer <name>`    | 主机名          | 网络环境标识，必须与历史一致           |
| `--concurrency <n>`    | `5`             | 1–100 个并发页面检测                   |
| `--timeout <ms>`       | `10000`         | 每次请求 1–300000 毫秒，包含响应体读取 |
| `--retries <n>`        | `1`             | 传输错误或 5xx 最多重试 0–5 次         |
| `--max-redirects <n>`  | `5`             | 每次尝试最多跟随 0–20 次跳转           |
| `--fail-on <policy>`   | `unavailable`   | `unavailable`、`review` 或 `none`      |

Sitemap 还支持 `--discover`、`--max-urls`、`--max-sitemaps`、`--max-sitemap-bytes`，详见[发现行为与限制](../guide/sitemap#supported-inputs-and-limits)。

## 退出码 {#exit-codes}

以下约定适用于 `check` 和 `sitemap`：

| 退出码 | 含义                                            |
| ------ | ----------------------------------------------- |
| `0`    | 检测完成，所选策略通过                          |
| `1`    | 检测完成，结果触发失败策略                      |
| `2`    | 输入、参数或执行错误，包括 sitemap 未能完整发现 |

`unavailable` 只在存在不可用结果时失败；`review` 还会因访问受限或跳转而失败。`none` 接受所有完整检测结果，但不会忽略输入或执行错误。完整检测以 `1` 退出时，报告和历史仍会保存。

```bash
meodp sitemap https://example.com/sitemap.xml --fail-on review --observer ci
```

`report` 导出或 `--verify` 验证成功返回 `0`，输入或执行失败返回 `2`。`notify` 发送、预览或跳过返回 `0`，配置或投递错误返回 `2`。

## 旧版浏览器命令

```bash
meodp scan examples/app
meodp export examples/app --type md
```

`scan [root]` 从指定根目录（默认 `.`）读取 `meodp.config.ts`，运行实验性的 Playwright 扫描器，需要安装 Playwright 及浏览器。`export [root] [--type md|html]` 导出旧扫描器的数据，不接收新的 `schemaVersion: 1` 报告格式。

旧版隐式调用 `meodp [root]` 现在改为显式 `meodp scan [root]`。新的 HTTP 可访问性集成使用 `check` 或 `sitemap`，报告展示使用 `report`。
