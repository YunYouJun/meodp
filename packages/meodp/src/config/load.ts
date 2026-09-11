import type { MeodpConfig } from './index'
import { access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { loadConfig } from 'c12'

export async function loadProjectConfig(file?: string) {
  if (file)
    await access(resolve(file))
  const { config, configFile } = await loadConfig<MeodpConfig>({
    name: 'meodp',
    cwd: process.cwd(),
    configFile: file ? resolve(file) : undefined,
    rcFile: false,
    globalRc: false,
    dotenv: false,
    packageJson: false,
    extend: false,
    giget: false,
  })
  const root = configFile ? dirname(configFile) : process.cwd()
  return { config, path: (value: string) => resolve(root, value) }
}
