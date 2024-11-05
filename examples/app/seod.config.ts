import { defineConfig } from 'seod'

export default defineConfig({
  clean: true,
  urls: [
    // {
    //   type: 'link',
    //   url: 'https://www.yunyoujun.cn/images/avatar.jpg',
    // },
    // {
    //   type: 'site',
    //   url: 'https://www.example.com',
    // },
    {
      type: 'site',
      url: 'https://cover.weixin.qq.com',
    },
    // {
    //   type: 'site',
    //   url: 'https://www.yunyoujun.cn',
    // },
    // {
    //   type: 'sitemap',
    //   url: 'https://www.yunyoujun.cn/sitemap.xml',
    // },
  ],

  ignoreLinks: [
    'https://rumt-zh.com/',
  ],

  log: {
    type: 'raw',
    file: false,
  },
})
