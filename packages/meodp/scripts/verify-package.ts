import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

// Verify the same files consumers install, without workspace or optional clients.
const directory = await mkdtemp(join(tmpdir(), 'meodp-package-'))
function run(command: string, args: string[]) {
  return execFileSync(command, args, {
    cwd: directory,
    stdio: 'inherit',
  })
}

try {
  const packed = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', directory], {
    cwd: resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
  })) as { filename: string }[]
  await writeFile(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
  run('npm', ['install', '--omit=optional', '--ignore-scripts', '--no-audit', join(directory, packed[0]!.filename)])
  run('npm', ['audit', '--omit=dev', '--omit=optional', '--audit-level=high'])
  run(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict'
    import { createRequire } from 'node:module'
    const require = createRequire(import.meta.url)
    for (const entry of ['meodp/config', 'meodp/check', 'meodp/notify', 'meodp/notify/feishu', 'meodp/notify/email']) {
      assert.ok(await import(entry))
      assert.ok(require(entry))
    }
    for (const entry of ['playwright', 'nodemailer'])
      assert.throws(() => require.resolve(entry), { code: 'MODULE_NOT_FOUND' })
  `])
  await writeFile(join(directory, 'links.json'), '[]')
  await writeFile(join(directory, 'settings.ts'), 'export const input: string = \'links.json\'\n')
  await writeFile(join(directory, 'meodp.config.ts'), `
    import { defineConfig } from 'meodp/config'
    import { input } from './settings'
    export default defineConfig({
      check: { input, reporter: 'json' },
      report: { input: 'reports/meodp/report.json', reporter: 'html' },
    })
  `)
  const cli = join(directory, 'node_modules/meodp/bin/index.mjs')
  run(process.execPath, [cli, '--version'])
  run(process.execPath, [cli, 'check'])
  run(process.execPath, [cli, 'report'])
  console.log('Packed package passed dependency audit, public imports and configured CLI checks.')
}
finally {
  await rm(directory, { recursive: true, force: true })
}
