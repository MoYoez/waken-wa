import fs from 'fs'
import path from 'path'

const POSTGRES_URL_RE = /^postgres(ql)?:\/\//i

export function isPostgresConnectionUrl(value: string | undefined): boolean {
  const s = value?.trim()
  return !!s && POSTGRES_URL_RE.test(s)
}

/**
 * First standard postgres URL among env vars.
 * Priority: POSTGRES_URL_NON_POOLING (direct), then DATABASE_URL, POSTGRES_URL, POSTGRES_PRISMA_URL.
 */
export function pickPostgresUrlFromEnv(): string | null {
  const np = process.env.POSTGRES_URL_NON_POOLING?.trim()
  const a = process.env.DATABASE_URL?.trim()
  const b = process.env.POSTGRES_URL?.trim()
  const c = process.env.POSTGRES_PRISMA_URL?.trim()
  if (isPostgresConnectionUrl(np)) return np!
  if (isPostgresConnectionUrl(a)) return a!
  if (isPostgresConnectionUrl(b)) return b!
  if (isPostgresConnectionUrl(c)) return c!
  return null
}

function prismaClientSchemaIsPostgresql(): boolean {
  try {
    const schemaPath = path.join(process.cwd(), 'node_modules/.prisma/client/schema.prisma')
    if (!fs.existsSync(schemaPath)) return false
    return fs.readFileSync(schemaPath, 'utf8').includes('provider = "postgresql"')
  } catch {
    return false
  }
}

/**
 * When Client was generated with schema.postgres.prisma, ensure DATABASE_URL is a postgres URL
 * (copy from POSTGRES_URL_NON_POOLING / POSTGRES_URL / etc. if needed).
 */
export function applyDatabaseUrlAliases(): void {
  if (!prismaClientSchemaIsPostgresql()) return
  const picked = pickPostgresUrlFromEnv()
  if (picked) process.env.DATABASE_URL = picked
}

applyDatabaseUrlAliases()
