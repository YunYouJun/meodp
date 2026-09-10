#!/usr/bin/env node
'use strict'

import process from 'node:process'
import { runCli } from '../dist/cli/main.mjs'

async function main() {
  process.exitCode = await runCli()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 2
})
