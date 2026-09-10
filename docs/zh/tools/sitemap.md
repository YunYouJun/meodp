---
outline: false
---

<script setup>
import SitemapParser from '../../.vitepress/components/SitemapParser.vue'
</script>

# Sitemap 解析器

检查站点生成的 sitemap：粘贴 XML 或导入本地文件，提取 URL、查找重复项、筛选并导出清单。所有处理都在当前浏览器中完成。

<SitemapParser lang="zh" />

::: details 支持范围与结果含义
每次导入一个 UTF-8 `.xml` 文件，最大 5 MiB、50,000 个条目。支持 `urlset`、`sitemapindex`、sitemap 命名空间、XML 实体和 CDATA。`.gz` 文件请先解压。

只提取条目下直属的 `loc`，忽略图片、视频扩展中的 URL。缺失、重复的 `loc` 元素，以及相对地址或非 HTTP(S) 地址会标为无效。空 sitemap 显示空清单。这里只检查格式和 URL，不代表完整的 sitemap schema 或搜索引擎规则校验。

有效 URL 经过浏览器 URL 解析器规范化后去重，保留 query 和 fragment。重复条目数为首次出现之外的次数。筛选作用于全部结果，每页最多显示 50 行；复制和文本导出排除无效条目，包含所有分页中符合筛选条件的 URL。

Sitemap 索引只展示子文件引用，不加载子 sitemap，也不统计子文件中的页面。工具不会请求 sitemap 或页面 URL，文件内容不会上传或在离开页面后保存。不支持 DOCTYPE 和自定义实体声明。
:::

需要检测实时 HTTP 状态、重定向和历史变化时，在本地或 CI 中运行 [sitemap CLI / SDK](../guide/sitemap)，再查看生成的[报告](../guide/reports)。
