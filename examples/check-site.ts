import { checkSiteUrl } from '../src'

export async function main() {
  // const siteUrl = 'https://www.yunyoujun.cn'
  const siteHomeUrl = 'https://cover.weixin.qq.com'

  // await checkSite(siteHomeUrl)
  await checkSiteUrl(siteHomeUrl, {
    urlItem: {
      type: 'site',
      url: siteHomeUrl,
    },
  })
}

main()
