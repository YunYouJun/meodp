import path from "path"
import { createLowDB, type MEODPSiteItem } from "../db"
import process from "process"

import fs from 'fs-extra'
import consola from "consola"
import { colors } from "consola/utils"

import { markdownTable } from 'markdown-table'

const successIcon = '<font color="green">✔</font>'
const errorIcon = '<font color="red">✖</font>'

function getCheckStatusEmoji(checkStatus: 'passed' | 'failed' | 'timeout' | 'ignored' | 'goto' | 'pending') {
  switch (checkStatus) {
    case 'passed':
      return '✅'
    case 'failed':
      return '❌'
    case 'timeout':
      return '⏰'
    case 'ignored':
      return '👻'
    case 'goto':
      return '🔗'
    case 'pending':
      return '⏳'
    default:
      return ''
  }
}

function getErrorMdContent(sites: Record<string, MEODPSiteItem>) {
  const errorSites = Object.entries(sites).filter(([key, value]) => {
    return ['failed', 'timeout'].includes(value.checkStatus)
  })

  if (!errorSites.length) {
    return 'No error found.'
  }

  let md = ''
  for (const [key, value] of errorSites) {
    md += `- [${value.name || value.url}](${value.url})\n`

    for (const link of value.links) {
      if (link.checkStatus === 'passed') {
        continue
      }
      const statusInfo = link.statusText ? `${link.statusCode} ${link.statusText}` : link.statusCode
      md += `  - \[${statusInfo}\] [${link.url}](${link.url})\n`

      for (const req of link.requests) {
        if (req.failed) {
          if (req.statusCode) {
            const statusInfo = req.statusText ? `${req.statusCode} ${req.statusText}` : req.statusCode
            md += `    - \[${statusInfo}\] [${req.url}](${req.url})\n`
          } else {
            md += `    - [⏰ TIMEOUT] <${req.url}>\n`
          }
        }
      }
    }
  }

  return md
}

export async function generateContentFromSiteData(site: MEODPSiteItem) {
  let md = ''

  const successLength = site.links.filter(link => link.checkStatus === 'passed').length
  const failedLength = site.links.filter(link => link.checkStatus === 'failed').length
  const timeoutLength = site.links.filter(link => link.checkStatus === 'timeout').length
  const summary = `
> 🔗 Links ${site.links.length} | ${successIcon} ${successLength} Passed | ${errorIcon} ${failedLength} Failed | ⏰ ${timeoutLength} Timeout | 👻 ${site.ignored.length} Ignored

`

  md += summary

  // markdownTable([
  //   [`[${link.url}](${link.url})`, link.status, link.statusText],
  // ])

  const siteArr: string[][] = [
    ['', 'CheckInfo', 'Duration', 'URL']
  ]



  site.links?.forEach(link => {
    let checkStr = getCheckStatusEmoji(link.checkStatus)

    let checkInfo = [
      '<span>**' + link.total + ' Requests' + '**</span><br>',
    ]
    if (link.success) {
      checkInfo.push('<font color="green">✔</font> ' + link.success)
    }
    if (link.failed) {
      checkInfo.push(errorIcon + ' ' + link.failed)
    }
    if (link.timeout) {
      checkInfo.push('⏰ ' + link.timeout)
    }
    if (link.ignored) {
      checkInfo.push('👻 ' + link.ignored)
    }



    const statusStr = (link.statusText ? `${link.statusCode} ${link.statusText}` : link.statusCode).toString()
    siteArr.push([
      checkStr,
      checkInfo.join(' '),
      // statusStr,
      link.duration ? `${link.duration}ms` : '',
      `[${link.url}](${link.url})`
    ])
  })

  md += markdownTable(siteArr, {
    align: ['l', 'l', 'r', 'l']
  })
  md += '\n'
  return md
}


/**
 * Output markdown result
 */
export async function outputMarkdown(options = {
  /**
   * Show config in markdown
   */
  showConfig: false,
}) {
  // init from json
  const db = await createLowDB()
  await db.read()

  const rootDir = process.cwd()
  const mdPath = path.resolve(rootDir, 'logs/meodp/report.md')

  await fs.ensureFile(mdPath)

  let mdContent = '# MEODP Report\n'
  if (options.showConfig) {
    mdContent += `
<details>
<summary>Config</summary>

\`\`\`json
${JSON.stringify(db.data.config, null, 2)}
\`\`\`

</details>
`
  }

  // error
  mdContent += `
## Errors

${getErrorMdContent(db.data.sites)}
`

  // site detail
  mdContent += '## Sites\n'
  for (const [key, value] of Object.entries(db.data.sites)) {
    const site = value
    mdContent += `\n### ${getCheckStatusEmoji(site.checkStatus)} [${site.name || site.url}](${site.url})\n`
    mdContent += await generateContentFromSiteData(value)
  }

  // write to file
  await fs.writeFile(mdPath, mdContent)
  consola.success(`${colors.cyan('Report Markdown File:')} ${colors.gray(mdPath)}`)
}
