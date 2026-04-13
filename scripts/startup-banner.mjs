import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentFile = fileURLToPath(import.meta.url)
const root = dirname(dirname(currentFile))
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

const useColor = process.stdout.isTTY && !process.env.NO_COLOR
const cyan = useColor ? '\x1b[36m' : ''
const dim = useColor ? '\x1b[2m' : ''
const reset = useColor ? '\x1b[0m' : ''

const banner = String.raw`
__        __    _                  __        __
\ \      / /_ _| | _____ _ __      \ \      / /_
 \ \ /\ / / _' | |/ / _ \ '_ \ _____\ \ /\ / / _' |
  \ V  V / (_| |   <  __/ | | |_____\ V  V / (_| |
   \_/\_/ \__,_|_|\_\___|_| |_|      \_/\_/ \__,_|
`

export function printStartupBanner(mode = process.env.NODE_ENV || 'startup') {
  const label = mode === 'dev' ? 'development' : mode === 'start' ? 'production' : mode
  console.log(`${cyan}${banner}${reset}`)
  console.log(`${dim}Waken-Wa v${packageJson.version} · ${label}${reset}\n`)
}

if (process.argv[1] === currentFile) {
  printStartupBanner(process.argv[2])
}
