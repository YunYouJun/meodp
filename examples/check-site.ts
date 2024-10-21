import { checkSite } from '../src'

export async function main() {
  const siteUrl = 'https://www.yunyoujun.cn'

  await checkSite(siteUrl)
}

main()
