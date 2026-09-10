# 快速开始

MEODP 用于检查网站与友链的 HTTP 可访问性。检测在 Node.js 或 CI 中运行，报告可以离线查看，也可以作为静态文件发布。

## 安装

需要 **Node.js 22.19 或更新版本**。`meodp/check` 库入口以及 `check`、`sitemap` 命令无需安装 Playwright。

```bash
pnpm add meodp
```

## 检查友链清单

创建 `links.yml`，也支持 JSON 数组：

```yaml
- name: 示例站点
  url: https://example.com/
```

```bash
pnpm exec meodp check links.yml --output reports/links
```

打开 `reports/links/report.html` 查看交互报告。同一目录还会生成 `report.json` 和 `report.md`。

友链对象可以包含头像、邮箱等其他字段，但检测器只使用 `url` 和 `name`。请求前会校验输入、规范化 URL 并去重；不同 fragment 视为同一页面，query 参数会保留。

## 使用库 API

```ts
import { checkLinks, formatReport, writeReports } from 'meodp/check'

const report = await checkLinks([
  { name: '示例站点', url: 'https://example.com/' },
], { concurrency: 5, retries: 1 })

console.log(formatReport(report))
await writeReports(report, 'reports/links')
```

`checkLinks()` 只返回数据，不写文件。批量发现子页面可使用 [sitemap 检测](./sitemap)，比较多次运行可使用[历史记录](./reports#history)。

## 选择操作

| 操作      | 是否请求页面   | 用途                             |
| --------- | -------------- | -------------------------------- |
| `check`   | 是             | 检查 JSON/YAML 中明确列出的 URL  |
| `sitemap` | 是             | 读取 sitemap，然后检查其中的页面 |
| `report`  | 否             | 把已有数据导出成交互式报告站点   |
| `scan`    | 是，通过浏览器 | 运行实验性的旧版扫描器           |

不带参数执行 `meodp` 只显示帮助。`meodp report` 不会重新扫描站点。

HTTP 检测不会执行 JavaScript、验证页面内容或检查内嵌图片与脚本。返回 200 的页面仍可能是验证码或域名停放页，详见[结果解释](./reports#results)。
