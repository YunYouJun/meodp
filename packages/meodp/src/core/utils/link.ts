/**
 * 是否为链接
 */
export function isLink(url: string) {
  if (url) {
    return url.startsWith('http') || url.startsWith('/')
  }
  else {
    return false
  }
}
