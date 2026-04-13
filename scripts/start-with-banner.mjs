#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

import { printStartupBanner } from './startup-banner.mjs'

const require = createRequire(import.meta.url)
const nextBin = require.resolve('next/dist/bin/next')
const [mode = 'dev', ...args] = process.argv.slice(2)

if (!['dev', 'start'].includes(mode)) {
  console.error(`[startup] Unsupported mode "${mode}". Expected "dev" or "start".`)
  process.exit(1)
}

printStartupBanner(mode)

const child = spawn(process.execPath, [nextBin, mode, ...args], {
  stdio: 'inherit',
  env: process.env,
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal)
  })
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})

