import type { CheckReport } from '../types'
import { parseReport } from '../schema'
import { viewerCss, viewerScript } from './assets.generated'

export interface ReportSiteOptions {
  /** Automatically load this HTTP(S) or relative JSON URL when hosted. */
  dataUrl?: string
}

export function createReportHtml(report?: CheckReport, options: ReportSiteOptions = {}): string {
  if (options.dataUrl !== undefined) {
    const url = new URL(options.dataUrl, 'https://meodp.invalid/')
    if (!options.dataUrl.trim() || !['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw new TypeError('dataUrl must be an HTTP(S) or relative URL without credentials')
  }
  // Escape the HTML raw-text delimiter, including hostile names and error messages.
  const data = JSON.stringify({ report: report ? parseReport(report) : null, dataUrl: options.dataUrl ?? null })
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="referrer" content="no-referrer">
<title>友链可访问性报告 · meodp</title>
<style>${viewerCss}</style>
</head>
<body>
<a class="skip-link" href="#results">跳到检测结果</a>
<header><div class="header-inner"><span class="wordmark">meodp</span><div class="actions">
<button id="open-import" type="button">加载 JSON</button><button id="download" class="primary" type="button" disabled>下载 JSON</button>
<a class="github-link" href="https://github.com/YunYouJun/meodp" target="_blank" rel="noopener noreferrer" aria-label="meodp GitHub 仓库（在新标签页打开）" title="meodp on GitHub">
<svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
</a>
</div></div></header>
<main>
<section aria-labelledby="report-title"><h1 id="report-title">友链可访问性报告</h1><p id="metadata" class="muted">加载检测数据，查看站点可访问性。</p>
<div id="metrics" class="metrics"></div><div id="distribution" class="distribution" aria-hidden="true"></div>
<p class="note">访问受限不等于失效；结果仅代表本次检测环境。</p></section>
<p id="message" role="status" aria-live="polite" hidden></p>
<section id="results" aria-label="检测结果" tabindex="-1">
<nav id="filters" aria-label="状态筛选"></nav>
<div class="toolbar"><label class="search"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input id="search" type="search" aria-label="搜索站点名称或 URL" placeholder="搜索站点名称或 URL"></label>
<select id="sort" aria-label="排序方式"><option value="original">原始顺序</option><option value="severity">优先查看异常</option><option value="duration">耗时从高到低</option><option value="failures">连续失败从多到少</option><option value="name">按站点名称</option></select></div>
<div id="empty" class="empty">尚未加载报告<button id="empty-import" type="button">选择 JSON 文件</button><span>也可以将报告文件拖入此页面</span></div>
<table id="table" hidden><caption class="sr-only">站点检测结果，展开详情可查看跳转和历史记录</caption><thead><tr><th>站点</th><th>状态</th><th class="technical">HTTP / 原因</th><th class="technical">耗时</th><th class="detail-heading">详情</th></tr></thead><tbody id="rows"></tbody></table>
<footer class="pagination"><span id="result-count" role="status" aria-live="polite"></span><div><button id="previous" type="button" disabled>上一页</button><button id="next" type="button" disabled>下一页</button></div></footer>
</section>
</main>
<dialog id="import-dialog" aria-labelledby="import-title"><form method="dialog" class="dialog-heading"><h2 id="import-title">加载检测报告</h2><button aria-label="关闭" type="submit">×</button></form>
<p class="muted">选择 meodp 生成的 report.json，或加载托管的数据。</p>
<label class="file-label" for="file">选择 JSON 文件<input id="file" type="file" accept=".json,application/json"></label>
<form id="url-form"><label for="data-url">报告数据 URL</label><div class="url-controls"><input id="data-url" type="text" placeholder="./report.json 或 https://…" required><button class="primary" type="submit">加载</button></div></form>
<p class="note">跨域数据需要源站允许 CORS。本地文件仅在浏览器内读取。</p></dialog>
<noscript><p>交互报告需要启用 JavaScript。也可查看一同生成的 report.md 或 report.json。</p></noscript>
<script id="meodp-data" type="application/json">${data}</script>
<script>${viewerScript.replace(/<\/script/gi, '<\\/script')}</script>
</body></html>
`
}
