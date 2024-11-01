import { defineConfig } from 'seod'

export default defineConfig({
  urls: [
    {
      type: 'link',
      url: 'https://www.yunyoujun.cn/images/avatar.jpg',
    },
    {
      type: 'site',
      url: 'https://www.example.com',
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
})
