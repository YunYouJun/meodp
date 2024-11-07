import { defineConfig } from 'seod'

export default defineConfig({
  clean: true,
  urls: [
    // {
    //   type: 'link',
    //   url: 'https://www.yunyoujun.cn/images/avatar.jpg',
    // },
    {
      type: 'site',
      url: 'https://www.example.com',
    },
    {
      type: 'site',
      url: 'https://www.qq.com/',
    },
    {
      type: 'site',
      url: 'https://www.yunyoujun.cn',
    },
    // {
    //   type: 'sitemap',
    //   url: 'https://www.yunyoujun.cn/sitemap.xml',
    // },
  ],

  checkExternalLinks: false,

  ignoreLinks: [
    'https://rumt-zh.com/',
    'https://support.weixin.qq.com',
    'https://localhost.weixin.qq.com',
    'https://www.google-analytics.com',
  ],
  ignoreExtensions: [
    '.mp3',
    '.mp4',
  ],

  log: {
    type: 'raw',
    file: false,
  },
})
