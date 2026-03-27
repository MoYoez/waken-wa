/**
 * Shared: load .env / .env.local, pick SQLite vs PostgreSQL schema, normalize DATABASE_URL.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const repoRoot = path.join(__dirname, '..')

export function loadEnvFile(envPath) {
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

export function isPostgresUrl(s) {
  const t = typeof s === 'string' ? s.trim() : ''
  return t.length > 0 && /^postgres(ql)?:\/\//i.test(t)
}

export function pickPostgresUrl() {
  const prisma = process.env.POSTGRES_PRISMA_URL?.trim()
  const a = process.env.DATABASE_URL?.trim()
  const b = process.env.POSTGRES_URL?.trim()
  if (isPostgresUrl(prisma)) return prisma
  if (isPostgresUrl(a)) return a
  if (isPostgresUrl(b)) return b
  return null
}

/**
 * Loads .env then .env.local (same order as Next). Mutates process.env.DATABASE_URL when using PG.
 * @returns {{ schemaRel: string, provider: string }}
 */
export function resolvePrismaEnv() {
  loadEnvFile(path.join(repoRoot, '.env'))
  loadEnvFile(path.join(repoRoot, '.env.local'))

  const inferredPostgres = pickPostgresUrl() !== null
  const explicitPostgres = (process.env.DATABASE_PROVIDER || '').toLowerCase() === 'postgresql'
  const provider =
    inferredPostgres || explicitPostgres
      ? 'postgresql'
      : (process.env.DATABASE_PROVIDER || 'sqlite').toLowerCase()

  const schemaRel =
    provider === 'postgresql' ? 'prisma/schema.postgres.prisma' : 'prisma/schema.prisma'

  if (provider === 'sqlite') {
    if (!process.env.DATABASE_URL?.trim()) {
      process.env.DATABASE_URL = 'file:./prisma/dev.db'
      console.log('[prisma-env] DATABASE_URL unset; using default file:./prisma/dev.db')
    }
  } else {
    const pgUrl = pickPostgresUrl()
    if (!pgUrl) {
      throw new Error(
        'PostgreSQL: set POSTGRES_PRISMA_URL, DATABASE_URL, or POSTGRES_URL (postgres:// or postgresql://...)',
      )
    }
    process.env.DATABASE_URL = pgUrl
  }

  return { schemaRel, provider }
}
