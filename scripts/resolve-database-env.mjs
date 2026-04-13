/**
 * Shared: load .env / .env.local, pick SQLite vs PostgreSQL, normalize DATABASE_URL for Drizzle.
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

/**
 * When `sslmode=require` is present, also ensure `uselibpqcompat=true` is set.
 * This makes pg adopt libpq-compatible SSL semantics and suppresses the
 * pg SSL-mode security warning introduced in pg-connection-string v3.
 */
export function ensureLibpqCompat(url) {
  if (!url) return url
  try {
    const u = new URL(url)
    if (u.searchParams.get('sslmode') === 'require' && !u.searchParams.has('uselibpqcompat')) {
      u.searchParams.set('uselibpqcompat', 'true')
    }
    return u.toString()
  } catch {
    // Not a parseable URL — return as-is
    return url
  }
}

export function isPostgresUrl(s) {
  const t = typeof s === 'string' ? s.trim() : ''
  return t.length > 0 && /^postgres(ql)?:\/\//i.test(t)
}

/** App / build / push: pooled URL first. */
export function pickPostgresUrl() {
  const a = process.env.DATABASE_URL?.trim()
  const b = process.env.POSTGRES_URL?.trim()
  if (isPostgresUrl(a)) return a
  if (isPostgresUrl(b)) return b
  return null
}

/** `pnpm db:init` / postinstall: prefer direct (non-pooling) for migrations push. */
export function pickPostgresUrlForInitDb() {
  const np = process.env.POSTGRES_URL_NON_POOLING?.trim()
  const a = process.env.DATABASE_URL?.trim()
  const b = process.env.POSTGRES_URL?.trim()
  if (isPostgresUrl(np)) return np
  if (isPostgresUrl(a)) return a
  if (isPostgresUrl(b)) return b
  return null
}

/**
 * Loads .env then .env.local (same order as Next). Mutates process.env.DATABASE_URL when using PG.
 * @param {{ forInitDb?: boolean, forceProvider?: 'sqlite' | 'postgresql' }} [options]
 * @returns {{ drizzleConfig: string, provider: string, onVercel: boolean }}
 */
export function resolveDatabaseEnv(options = {}) {
  const forInitDb = options.forInitDb === true
  const pick = forInitDb ? pickPostgresUrlForInitDb : pickPostgresUrl

  loadEnvFile(path.join(repoRoot, '.env'))
  loadEnvFile(path.join(repoRoot, '.env.local'))

  // Vercel injects VERCEL=1 automatically; always use PostgreSQL in that environment.
  const onVercel = process.env.VERCEL === '1'

  const inferredPostgres = pick() !== null
  const explicitPostgres = (process.env.DATABASE_PROVIDER || '').toLowerCase() === 'postgresql'
  let provider =
    onVercel || inferredPostgres || explicitPostgres
      ? 'postgresql'
      : (process.env.DATABASE_PROVIDER || 'sqlite').toLowerCase()

  if (options.forceProvider === 'postgresql') {
    provider = 'postgresql'
  }
  if (options.forceProvider === 'sqlite') {
    provider = 'sqlite'
  }

  const drizzleConfig =
    provider === 'postgresql' ? 'drizzle.config.pg.ts' : 'drizzle.config.sqlite.ts'

  if (provider === 'sqlite') {
    if (!process.env.DATABASE_URL?.trim()) {
      process.env.DATABASE_URL = 'file:./data/dev.db'
      console.log('[db-env] DATABASE_URL unset; using default file:./data/dev.db')
    }
  } else {
    const pgUrl = pick()
    if (!pgUrl) {
      throw new Error(
        forInitDb
          ? 'PostgreSQL: set POSTGRES_URL_NON_POOLING, DATABASE_URL, or POSTGRES_URL (postgres:// or postgresql://...)'
          : 'PostgreSQL: set DATABASE_URL, or POSTGRES_URL (postgres:// or postgresql://...)',
      )
    }
    process.env.DATABASE_URL = ensureLibpqCompat(pgUrl)
  }

  return { drizzleConfig, provider, onVercel }
}
