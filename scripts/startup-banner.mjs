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

// Glad To See you! Thanks for using my program and found this! I hope you like it.
const mottos = [
  'If I say yes, will you take me with you?', // PEAK
  'If you want, we can disappear together.', // Persona 5
  'I don’t want to forget you.',  // To the moon
  'We could just leave Night City. Right now.',  // Cyberpunk 2077
  'Is it okay for someone like me… to wish for something like this?', // lucy -the eternity she wished for- my love.
  'Why don’t you stay a little longer?', // Touhou Mystia's Izakaya
  'Stay Hungry, Stay Foolish.', // Steve Jobs
  'Is escape a selfish goal? Does survival justify your choices?', // The Alters
  'It is end? Or just a new beginning?', // Minecraft.
  '踏平坎坷成大道。' // 黑神话：悟空
]

function getDailyMotto() {
  const dayKey = new Date().toISOString().slice(0, 10)
  const seed = [...dayKey].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return mottos[seed % mottos.length]
}

export function printStartupBanner(mode = process.env.NODE_ENV || 'startup') {
  const label = mode === 'dev' ? 'development' : mode === 'start' ? 'production' : mode
  console.log(`${cyan}${banner}${reset}`)
  console.log(`${dim}Waken-Wa v${packageJson.version} · ${label}${reset}`)
  console.log(`${dim}"${getDailyMotto()}"${reset}\n`)
}

if (process.argv[1] === currentFile) {
  printStartupBanner(process.argv[2])
}
