#!/usr/bin/env vite-node --script
'use strict'

import process from 'node:process'
import { runCli } from '../src/cli/main'

async function main() {
  process.exitCode = await runCli()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 2
})
