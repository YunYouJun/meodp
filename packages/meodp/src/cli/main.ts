import process from 'node:process'
import pkg from '../../package.json'

const help = `Usage: meodp <command> [options]

Commands:
  check <links.json|links.yml>  Request listed HTTP(S) URLs and write fresh reports
  sitemap <sitemap-url>        Check pages listed in an XML sitemap or nested index
  report [report.json]         Export a static viewer from saved data; no site checks
  notify                      Send configured report notifications; supports --dry-run
  scan [root]                 Run the legacy browser scanner using meodp.config.ts
  export [root]               Export a legacy browser-scan report

Options:
  -h, --help                  Show this help
  -v, --version               Show the package version

Examples:
  meodp check links.yml --output reports/links
  meodp sitemap https://example.com/sitemap.xml --output reports/pages
  meodp report reports/links/report.json --output reports/site
  meodp check --help
  meodp help report

check, sitemap, and scan initiate site checks. scan requires Playwright.
Running meodp without arguments shows help; no scan starts automatically.
`

/** Keep command discovery independent of optional browser dependencies. */
export async function runCli(args = process.argv.slice(2)): Promise<number> {
  try {
    const [command, ...rest] = args
    if (!command || command === '--help' || command === '-h') {
      if (rest.length)
        throw new Error('Use meodp <command> --help for command-specific help')
      console.log(help)
      return 0
    }
    if (command === '--version' || command === '-v') {
      if (rest.length)
        throw new Error('--version does not accept additional arguments')
      console.log(pkg.version)
      return 0
    }
    if (command === 'help') {
      if (!rest.length)
        return runCli(['--help'])
      if (rest.length !== 1 || !['check', 'sitemap', 'report', 'notify', 'scan', 'export'].includes(rest[0]))
        throw new Error('Use meodp help <check|sitemap|report|notify|scan|export>')
      return runCli([rest[0], '--help'])
    }
    if (command === 'notify') {
      const { runNotifyCli } = await import('../notify/cli')
      return runNotifyCli(rest)
    }
    if (command === 'check') {
      const { runCheckCli } = await import('../check/cli')
      return runCheckCli(rest)
    }
    if (command === 'report') {
      const { runReportCli } = await import('../check/cli')
      return runReportCli(rest)
    }
    if (command === 'sitemap') {
      const { runSitemapCli } = await import('../check/cli')
      return runSitemapCli(rest)
    }
    if (command === 'scan' || command === 'export') {
      if (rest.includes('--help') || rest.includes('-h')) {
        console.log(command === 'scan'
          ? 'Usage: meodp scan [root]\n\nRun the legacy Playwright scanner with meodp.config.ts in root (default: .).\nThis starts browser/network activity and uses the legacy configuration and reports.'
          : 'Usage: meodp export [root] [--type md|html]\n\nExport the legacy browser scanner\'s stored data.\nFor a schemaVersion: 1 report.json, use meodp report instead.')
        return 0
      }
      const { run } = await import('./index')
      await run(command === 'scan' ? rest : ['export', ...rest], command === 'scan' ? 'meodp scan' : 'meodp')
      return 0
    }
    throw new Error(`Unknown command ${JSON.stringify(command)}. Use meodp --help. For the legacy scanner, use meodp scan [root].`)
  }
  catch (error) {
    console.error(`meodp: ${error instanceof Error ? error.message : String(error)}`)
    return 2
  }
}
