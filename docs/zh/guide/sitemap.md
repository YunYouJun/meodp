# Sitemap 子页面检测

通过 sitemap 获取页面清单，再复用 MEODP 的 linkinator 检测适配、历史记录和报告。

## 从 sitemap 或站点开始

```bash
pnpm exec meodp sitemap https://example.com/sitemap.xml --output reports/pages
pnpm exec meodp sitemap https://example.com/ --discover --output reports/pages
```

默认输入是明确的 sitemap URL。指定 `--discover` 后，输入视为站点地址：读取 `/robots.txt` 中的所有 `Sitemap:` 声明；如果 robots 不存在（404/410）或没有声明，回退到 `/sitemap.xml`。其他 robots 请求错误会直接报错。

```ts
import { checkSitemap, readSitemapUrls, writeReports } from 'meodp/check'

const report = await checkSitemap('https://example.com/', {
  discover: true,
  concurrency: 5,
  maxUrls: 10000,
})
await writeReports(report, 'reports/pages')

// 只读取完整清单，不请求其中的页面。
const urls = await readSitemapUrls('https://example.com/sitemap.xml')
```

## 支持范围与上限 {#supported-inputs-and-limits}

支持 XML URL 集、嵌套索引、命名空间、CDATA、XML 实体、gzip 压缩和重定向。相对地址基于最终 sitemap URL 解析。循环索引会终止，重复 URL 会合并，fragment 会去除，query 会保留。

| 配置 / CLI 参数                           | 默认值     | 可选范围                                    |
| ----------------------------------------- | ---------- | ------------------------------------------- |
| `discover` / `--discover`                 | `false`    | 布尔值                                      |
| `maxUrls` / `--max-urls`                  | `10000`    | 1–50000 个唯一页面                          |
| `maxSitemaps` / `--max-sitemaps`          | `100`      | 1–10000 份文档                              |
| `maxSitemapBytes` / `--max-sitemap-bytes` | `10485760` | 每份文档下载和解压后分别最多 1 byte–100 MiB |

也支持全部[通用检测选项](../reference/api#check-options)。Sitemap 文档按顺序读取，`concurrency` 控制页面检测并发。超时包含响应正文读取；网络或 5xx 错误可重试，访问限制不重试。

## 完成发现后再检测

任一子 sitemap 缺失或不可读、XML/URL 无效、页面清单为空、超过上限，都会导致发现阶段失败。完整发现成功后才开始页面请求。CLI 返回退出码 `2`，保留已有报告和历史文件；即使指定 `--fail-on none` 也一样。

这样可以避免把部分扫描误当作完整结果。发现成功后，单个页面失败会成为正常的报告记录。

::: details 检测边界与实现
新的 `checkSitemap()` 只检查 sitemap 列出的页面 URL 及其重定向，不继续爬文章链接、不检测内嵌资源、不执行 JavaScript，也不应用 robots 的 `Disallow` 规则。清单中明确列出的其他来源 HTTP(S) URL 也会被检查。

XML 解析和校验使用 fast-xml-parser；MEODP 管理发现流程与上限，页面请求交给 linkinator。Linkinator 原生 sitemap API 将发现和页面链接扫描绑定在一起，单独读取清单可以保留 MEODP 的重定向记录与历史规则。旧版根入口的 `checkSiteMap()` 仍属实验功能，与新 API 不同。
:::
