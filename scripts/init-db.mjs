import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function loadDotEnvLocal() {
  const envPath = path.join(root, '.env.local')
  if (!fs.existsSync(envPath)) return

  const raw = fs.readFileSync(envPath, 'utf8')
  const lines = raw.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const idx = trimmed.indexOf('=')
    if (idx === -1) continue

    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

loadDotEnvLocal()

// Default sqlite; set DATABASE_PROVIDER=postgresql for Postgres + schema.postgres.prisma
const provider = (process.env.DATABASE_PROVIDER || 'sqlite').toLowerCase()
const schemaRel =
  provider === 'postgresql' ? 'prisma/schema.postgres.prisma' : 'prisma/schema.prisma'

const hasPostgresUrl =
  !!process.env.POSTGRES_URL?.trim() || !!process.env.POSTGRES_PRISMA_URL?.trim()
const hasDatabaseUrl = !!process.env.DATABASE_URL?.trim()

if (provider === 'sqlite') {
  if (!hasDatabaseUrl) {
    console.error('[init-db] Set DATABASE_URL for sqlite (e.g. file:./prisma/dev.db)')
    process.exit(1)
  }
} else {
  if (!hasPostgresUrl) {
    console.error('[init-db] Set POSTGRES_PRISMA_URL (or POSTGRES_URL) for postgresql')
    process.exit(1)
  }
}

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', cwd: root, env: process.env, shell: true })
}

console.log(`[init-db] provider=${provider} schema=${schemaRel}`)

run(`npx prisma generate --schema ${schemaRel}`)
run(`npx prisma db push --schema ${schemaRel}`)

console.log('[init-db] done')
