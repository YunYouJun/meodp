import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

// Verify the same files consumers install, without workspace or optional clients.
const directory = await mkdtemp(join(tmpdir(), 'meodp-package-'))
// Cover the earliest supported compiler line as well as current 5.x, 6.x and 7.x.
const typescriptVersions = ['5.0.4', '5.6.3', '5.9.3', '6.0.3', '7.0.2']
function run(command: string, args: string[]) {
  return execFileSync(command, args, {
    cwd: directory,
    stdio: 'inherit',
    // A globally installed optional peer must not mask a missing dependency.
    env: { ...process.env, NODE_PATH: '' },
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
    for (const entry of ['playwright', 'nodemailer', 'typescript'])
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

  const consumer = await readFile(new URL('./fixtures/typescript-consumer.mts', import.meta.url), 'utf8')
  await writeFile(join(directory, 'consumer.mts'), consumer)
  await writeFile(join(directory, 'consumer.cts'), consumer)
  await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      noEmit: true,
      types: ['node'],
    },
    files: ['consumer.mts', 'consumer.cts'],
  }))

  for (const version of typescriptVersions) {
    // Native TypeScript 7 ships its compiler in a platform optional dependency.
    // Optional meodp peers (Playwright and Nodemailer) must remain absent.
    run('npm', ['install', '--include=optional', '--ignore-scripts', '--no-audit', '--strict-peer-deps', `typescript@${version}`, '@types/node@22.9.0'])
    const compiler = join(directory, 'node_modules/typescript/bin/tsc')
    run(process.execPath, [compiler, '--version'])
    run(process.execPath, [compiler, '--project', 'tsconfig.json'])
    run(process.execPath, [compiler, '--project', 'tsconfig.json', '--module', 'ESNext', '--moduleResolution', 'Bundler'])
    // The contributor workspace targets 5.6+ (including its DOM-based tests),
    // while the published declarations remain compatible with 5.0 consumers.
    // Keep the compiler API used by unbuild, ESLint and Vue tooling unchanged.
    if (version !== '5.0.4')
      run(process.execPath, [compiler, '--noEmit', '--project', resolve(import.meta.dirname, '../tsconfig.json')])
    run(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict'
      import { createRequire } from 'node:module'
      const require = createRequire(import.meta.url)
      assert.equal(require('typescript/package.json').version, '${version}')
      for (const entry of ['playwright', 'nodemailer'])
        assert.throws(() => require.resolve(entry), { code: 'MODULE_NOT_FOUND' })
    `])
    run(process.execPath, [cli, 'check'])
    run(process.execPath, [cli, 'report'])
    console.log(`Packed package checks passed with TypeScript ${version}.`)
  }
  console.log('Packed package passed dependency audit, public imports, TypeScript compatibility and configured CLI checks.')
}
finally {
  await rm(directory, { recursive: true, force: true })
}
