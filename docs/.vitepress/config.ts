import type { DefaultTheme } from 'vitepress'
import process from 'node:process'
import { defineConfig } from 'vitepress'

const repository = 'https://github.com/YunYouJun/meodp'
const base = process.env.DOCS_BASE || '/'

function navigation(prefix: string, chinese: boolean): DefaultTheme.Config {
  return {
    nav: [
      { text: chinese ? '指南' : 'Guide', link: `${prefix}/guide/quick-start` },
      { text: 'API', link: `${prefix}/reference/api` },
      { text: 'CLI', link: `${prefix}/reference/cli` },
    ],
    sidebar: [{
      text: chinese ? '使用 MEODP' : 'Using MEODP',
      items: [
        { text: chinese ? '快速开始' : 'Quick start', link: `${prefix}/guide/quick-start` },
        { text: chinese ? 'Sitemap 子页面检测' : 'Sitemap page checks', link: `${prefix}/guide/sitemap` },
        { text: chinese ? '报告与历史' : 'Reports and history', link: `${prefix}/guide/reports` },
        { text: chinese ? '命令行参考' : 'CLI reference', link: `${prefix}/reference/cli` },
        { text: chinese ? 'API 参考' : 'API reference', link: `${prefix}/reference/api` },
        { text: chinese ? '开发与验证' : 'Development and verification', link: `${prefix}/guide/development` },
      ],
    }],
    outline: { level: [2, 3], label: chinese ? '本页目录' : 'On this page' },
    docFooter: { prev: chinese ? '上一篇' : 'Previous', next: chinese ? '下一篇' : 'Next' },
    editLink: { pattern: `${repository}/edit/main/docs/:path`, text: chinese ? '在 GitHub 上编辑此页' : 'Edit this page on GitHub' },
    lastUpdated: { text: chinese ? '最后更新' : 'Last updated' },
    sidebarMenuLabel: chinese ? '菜单' : 'Menu',
    returnToTopLabel: chinese ? '返回顶部' : 'Return to top',
    langMenuLabel: chinese ? '切换语言' : 'Change language',
    darkModeSwitchLabel: chinese ? '外观' : 'Appearance',
  }
}

export default defineConfig({
  title: 'MEODP',
  base,
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }]],
  lastUpdated: true,
  // Keep the historical research note in Git without publishing its source-file links.
  srcExclude: ['competitive-analysis.md'],
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      description: 'Website and friend-link checks with history and portable reports.',
      themeConfig: navigation('', false),
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      description: '检查网站与友链可访问性，保留历史并输出可分享的报告。',
      themeConfig: navigation('/zh', true),
    },
  },
  themeConfig: {
    socialLinks: [{ icon: 'github', link: repository }],
    search: {
      provider: 'local',
      options: {
        locales: {
          zh: {
            translations: {
              button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
              modal: {
                displayDetails: '显示详细内容',
                resetButtonTitle: '清除搜索',
                backButtonTitle: '关闭搜索',
                noResultsText: '无法找到相关结果',
                footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
              },
            },
          },
        },
      },
    },
  },
})
