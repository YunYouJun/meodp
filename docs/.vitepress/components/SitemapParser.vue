<script setup lang="ts">
import type { SitemapAnalysis } from '../lib/sitemap'
import { computed, ref, shallowRef, watch } from 'vue'
import { MAX_XML_BYTES, parseSitemapXml, SitemapError } from '../lib/sitemap'

const props = withDefaults(defineProps<{ lang?: 'en' | 'zh' }>(), { lang: 'en' })
const messages = {
  en: {
    input: 'Sitemap XML',
    placeholder: 'Paste your sitemap XML here…',
    file: 'Choose XML file',
    drop: 'or drop one UTF-8 .xml file here · up to 5 MiB',
    parse: 'Parse XML',
    sample: 'Try an example',
    clear: 'Clear',
    loading: 'Reading file…',
    local: 'Your XML stays in this browser. No URLs are requested.',
    result: 'Analysis',
    pages: 'Page list',
    index: 'Sitemap index',
    indexNote: 'These URLs reference child sitemaps. Their contents have not been read. Import each child file separately to inspect it.',
    total: 'Entries',
    unique: 'Unique URLs',
    duplicates: 'Duplicate entries',
    invalid: 'Invalid entries',
    search: 'Filter by URL or path',
    host: 'Domain',
    allHosts: 'All domains',
    filter: 'Show',
    all: 'All entries',
    repeated: 'Duplicates',
    invalidOnly: 'Invalid entries',
    url: 'URL',
    count: 'Count',
    note: 'Note',
    missing: 'Missing loc',
    multiple: 'Multiple loc elements',
    invalidUrl: 'Expected an absolute HTTP(S) URL without credentials',
    empty: 'No matching entries.',
    copy: 'Copy filtered URLs',
    download: 'Export filtered URLs',
    copied: 'URLs copied.',
    copyFailed: 'Copy failed. Use export to save the URLs.',
    exportNote: 'Copy and export include unique, valid URLs matching the filters. Query strings and fragments are preserved.',
    previous: 'Previous',
    next: 'Next',
    page: 'Page',
    of: 'of',
    matches: 'matching entries',
    errors: {
      empty: 'Paste XML or choose a file first.',
      size: 'XML exceeds the 5 MiB limit.',
      xml: 'Invalid XML. Check that tags and entities are properly closed or escaped.',
      doctype: 'DOCTYPE and custom entity declarations are not supported.',
      root: 'Expected a urlset or sitemapindex root with the sitemap namespace (or no namespace).',
      mixed: 'Unexpected entries: urlset must contain url entries, and sitemapindex must contain sitemap entries.',
      limit: 'This document exceeds the 50,000 entry limit.',
      file: 'Choose one uncompressed .xml file.',
      read: 'Could not read this file. Try selecting it again.',
    },
  },
  zh: {
    input: 'Sitemap XML',
    placeholder: '在此粘贴站点生成的 sitemap XML…',
    file: '选择 XML 文件',
    drop: '或拖入一个 UTF-8 .xml 文件 · 最大 5 MiB',
    parse: '解析 XML',
    sample: '试用示例',
    clear: '清空',
    loading: '正在读取文件…',
    local: 'XML 仅在当前浏览器中处理，不会请求其中的 URL。',
    result: '解析结果',
    pages: '页面清单',
    index: 'Sitemap 索引',
    indexNote: '这里的 URL 指向子 sitemap，其内容尚未读取。请分别导入子文件查看。',
    total: '条目数',
    unique: '唯一 URL',
    duplicates: '重复条目',
    invalid: '无效条目',
    search: '按 URL 或路径筛选',
    host: '域名',
    allHosts: '全部域名',
    filter: '显示',
    all: '全部条目',
    repeated: '重复项',
    invalidOnly: '无效条目',
    url: 'URL',
    count: '出现次数',
    note: '说明',
    missing: '缺少 loc',
    multiple: '存在多个 loc',
    invalidUrl: '需要不含账号密码的绝对 HTTP(S) URL',
    empty: '没有符合条件的条目。',
    copy: '复制筛选后的 URL',
    download: '导出筛选后的 URL',
    copied: '已复制 URL。',
    copyFailed: '复制失败，请使用导出保存 URL。',
    exportNote: '复制和导出包含符合筛选条件的有效、去重 URL，保留 query 和 fragment。',
    previous: '上一页',
    next: '下一页',
    page: '第',
    of: '/',
    matches: '条匹配结果',
    errors: {
      empty: '请先粘贴 XML 或选择文件。',
      size: 'XML 超过 5 MiB 上限。',
      xml: 'XML 格式错误，请检查标签闭合和实体转义。',
      doctype: '不支持 DOCTYPE 和自定义实体声明。',
      root: '根元素应为 urlset 或 sitemapindex，使用 sitemap 命名空间或不声明命名空间。',
      mixed: '存在不匹配的条目：urlset 应包含 url，sitemapindex 应包含 sitemap。',
      limit: '文件超过 50,000 条目上限。',
      file: '请选择一个未压缩的 .xml 文件。',
      read: '无法读取文件，请重新选择。',
    },
  },
}
const t = computed(() => messages[props.lang])
const raw = ref('')
const result = shallowRef<SitemapAnalysis>()
const error = ref<keyof typeof messages.en.errors>()
const notice = ref<'copied' | 'copyFailed'>()
const busy = ref(false)
const fileInput = ref<HTMLInputElement>()
const query = ref('')
const host = ref('')
const filter = ref('all')
const page = ref(1)
const pageSize = 50
const hosts = computed(() => [...new Set(result.value?.entries.flatMap(entry => entry.host ? [entry.host] : []) ?? [])].sort())
const filtered = computed(() => result.value?.entries.filter(entry =>
  (!query.value || (entry.url ?? entry.value).toLowerCase().includes(query.value.trim().toLowerCase()))
  && (!host.value || entry.host === host.value)
  && (filter.value === 'all' || (filter.value === 'duplicates' ? entry.count > 1 : !!entry.issue)),
) ?? [])
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const visible = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const exportUrls = computed(() => filtered.value.flatMap(entry => entry.url ? [entry.url] : []))
watch([query, host, filter], () => {
  page.value = 1
  notice.value = undefined
})

function resetResult() {
  result.value = undefined
  error.value = undefined
  notice.value = undefined
  query.value = ''
  host.value = ''
  filter.value = 'all'
  page.value = 1
}

function parse() {
  resetResult()
  try {
    result.value = parseSitemapXml(raw.value)
  }
  catch (cause) {
    error.value = cause instanceof SitemapError ? cause.code : 'xml'
  }
}

function clear() {
  raw.value = ''
  resetResult()
  if (fileInput.value)
    fileInput.value.value = ''
}

function sample() {
  raw.value = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/blog/hello</loc></url>
  <url><loc>https://example.com/blog/hello</loc></url>
  <url><loc>https://example.com/search?a=1&amp;b=2</loc></url>
</urlset>`
  parse()
}

async function loadFiles(files: FileList | null) {
  if (busy.value || !files?.length)
    return
  const selected = Array.from(files)
  clear()
  const file = selected[0]
  if (selected.length !== 1 || !/\.xml$/i.test(file.name)) {
    error.value = 'file'
    return
  }
  if (file.size > MAX_XML_BYTES) {
    error.value = 'size'
    return
  }
  busy.value = true
  try {
    raw.value = await file.text()
    parse()
  }
  catch {
    error.value = 'read'
  }
  finally {
    busy.value = false
  }
}

function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement
  void loadFiles(input.files)
}

async function copy() {
  try {
    await navigator.clipboard.writeText(exportUrls.value.join('\n'))
    notice.value = 'copied'
  }
  catch {
    notice.value = 'copyFailed'
  }
}

function download() {
  const url = URL.createObjectURL(new Blob([`${exportUrls.value.join('\n')}\n`], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = result.value?.kind === 'sitemapindex' ? 'child-sitemaps.txt' : 'sitemap-urls.txt'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <section class="sitemap-tool" :aria-label="t.input" :aria-busy="busy">
    <div class="input-panel" @dragover.prevent @drop.prevent="loadFiles($event.dataTransfer?.files ?? null)">
      <label class="input-label" for="sitemap-xml">{{ t.input }}</label>
      <textarea id="sitemap-xml" v-model="raw" :placeholder="t.placeholder" :readonly="busy" spellcheck="false" rows="9" @input="resetResult" />
      <div class="file-row">
        <label class="file-button" for="sitemap-file">{{ t.file }}<input id="sitemap-file" ref="fileInput" type="file" accept=".xml,application/xml,text/xml" :disabled="busy" @change="chooseFile"></label>
        <span>{{ t.drop }}</span>
      </div>
      <div class="actions">
        <button class="primary" type="button" :disabled="busy" @click="parse">
          {{ busy ? t.loading : t.parse }}
        </button>
        <button type="button" :disabled="busy" @click="sample">
          {{ t.sample }}
        </button>
        <button type="button" :disabled="busy || (!raw && !error)" @click="clear">
          {{ t.clear }}
        </button>
      </div>
      <p class="hint">
        {{ t.local }}
      </p>
    </div>
    <p v-if="error" class="error" role="alert">
      {{ t.errors[error] }}
    </p>
    <div v-if="result" class="results" :aria-label="t.result">
      <p class="result-kind">
        {{ result.kind === 'urlset' ? t.pages : t.index }}
      </p>
      <p v-if="result.kind === 'sitemapindex'" class="index-note">
        {{ t.indexNote }}
      </p>
      <dl class="stats" aria-live="polite">
        <div><dt>{{ t.total }}</dt><dd>{{ result.total }}</dd></div>
        <div><dt>{{ t.unique }}</dt><dd>{{ result.unique }}</dd></div>
        <div><dt>{{ t.duplicates }}</dt><dd>{{ result.duplicates }}</dd></div>
        <div><dt>{{ t.invalid }}</dt><dd>{{ result.invalid }}</dd></div>
      </dl>
      <div class="filters">
        <label class="search">{{ t.search }}<input v-model="query" type="search" :placeholder="t.search"></label>
        <label>{{ t.host }}<select v-model="host" :aria-label="t.host"><option value="">{{ t.allHosts }}</option><option v-for="domain in hosts" :key="domain" :value="domain">{{ domain }}</option></select></label>
        <label>{{ t.filter }}<select v-model="filter" :aria-label="t.filter"><option value="all">{{ t.all }}</option><option value="duplicates">{{ t.repeated }}</option><option value="invalid">{{ t.invalidOnly }}</option></select></label>
      </div>
      <p class="hint" aria-live="polite">
        {{ filtered.length }} {{ t.matches }}
      </p>
      <table v-if="visible.length" class="entries">
        <thead>
          <tr>
            <th scope="col">
              {{ t.url }}
            </th><th scope="col">
              {{ t.count }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(entry, index) in visible" :key="index">
            <td><span>{{ entry.url || entry.value || '—' }}</span><small v-if="entry.issue" class="entry-issue">{{ entry.issue === 'missing' ? t.missing : entry.issue === 'multiple' ? t.multiple : t.invalidUrl }}</small></td>
            <td>{{ entry.count }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else>
        {{ t.empty }}
      </p>
      <div v-if="pageCount > 1" class="pagination">
        <button type="button" :disabled="page === 1" @click="page--">
          {{ t.previous }}
        </button>
        <span>{{ t.page }} {{ page }} {{ t.of }} {{ pageCount }}</span>
        <button type="button" :disabled="page === pageCount" @click="page++">
          {{ t.next }}
        </button>
      </div>
      <div class="actions">
        <button type="button" :disabled="!exportUrls.length" @click="copy">
          {{ t.copy }}
        </button>
        <button type="button" :disabled="!exportUrls.length" @click="download">
          {{ t.download }}
        </button>
      </div>
      <p class="hint">
        {{ t.exportNote }}
      </p>
      <p v-if="notice" role="status">
        {{ t[notice] }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.sitemap-tool {
  margin: 24px 0;
}
.input-panel {
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.input-label,
.filters label {
  display: block;
  font-size: 13px;
  font-weight: 600;
}
textarea,
input[type='search'],
select {
  width: 100%;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}
textarea {
  display: block;
  margin-top: 8px;
  padding: 12px;
  resize: vertical;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.6;
}
input[type='search'],
select {
  display: block;
  height: 38px;
  margin-top: 6px;
  padding: 6px 10px;
  font-weight: 400;
}
button,
.file-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 7px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
button:hover:not(:disabled),
.file-button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
button.primary {
  border-color: var(--vp-c-brand-3);
  background: var(--vp-c-brand-3);
  color: white;
}
button.primary:hover:not(:disabled) {
  color: white;
  background: var(--vp-c-brand-2);
}
button:focus-visible,
textarea:focus-visible,
input:focus-visible,
select:focus-visible,
.file-button:focus-within {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}
.file-button {
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}
.file-button input {
  position: absolute;
  inset: 0;
  width: 100%;
  opacity: 0;
  cursor: pointer;
}
.actions,
.file-row,
.pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}
.file-row span,
.hint {
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.hint {
  margin: 12px 0 0;
  line-height: 1.7;
}
.error,
.entry-issue {
  color: var(--vp-c-danger-1);
}
.error,
.index-note {
  padding: 12px 16px;
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
}
.result-kind {
  font-weight: 600;
  margin-top: 28px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin: 16px 0 24px;
}
.stats div {
  padding: 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}
.stats dt {
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.stats dd {
  margin: 6px 0 0;
  font-size: 24px;
  font-weight: 600;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.filters label {
  flex: 1;
  min-width: 130px;
}
.filters .search {
  flex: 2;
  min-width: 200px;
}
.entries {
  display: table;
  width: 100%;
  table-layout: fixed;
  font-size: 13px;
}
.entries th:last-child,
.entries td:last-child {
  width: 94px;
  text-align: center;
}
.entries td {
  overflow-wrap: anywhere;
}
.entry-issue {
  display: block;
  margin-top: 4px;
}
.pagination {
  justify-content: space-between;
  font-size: 13px;
}
@media (max-width: 639px) {
  .input-panel {
    padding: 14px;
  }
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .filters label,
  .filters .search {
    min-width: 100%;
  }
}
</style>
