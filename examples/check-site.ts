import { checkSite, checkSiteUrl } from '../src'

export async function main() {
  // const siteUrl = 'https://www.yunyoujun.cn'
  const siteUrl = 'https://cover.weixin.qq.com'

  // await checkSite(siteUrl)
  await checkSiteUrl(siteUrl)
}

main()
