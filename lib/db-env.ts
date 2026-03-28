import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import fs from 'fs'
import path from 'path'

const POSTGRES_URL_RE = /^postgres(ql)?:\/\//i

export function isPostgresConnectionUrl(value: string | undefined): boolean {
  const s = value?.trim()
  return !!s && POSTGRES_URL_RE.test(s)
}

/**
 * First standard postgres URL among env vars.
 * Priority: POSTGRES_PRISMA_URL, then DATABASE_URL, then POSTGRES_URL.
 */
export function pickPostgresUrlFromEnv(): string | null {
  const prisma = process.env.POSTGRES_PRISMA_URL?.trim()
  const a = process.env.DATABASE_URL?.trim()
  const b = process.env.POSTGRES_URL?.trim()
  if (isPostgresConnectionUrl(prisma)) return prisma!
  if (isPostgresConnectionUrl(a)) return a!
  if (isPostgresConnectionUrl(b)) return b!
  return null
}

function prismaLegacySchemaCandidates(): string[] {
  const cwd = process.cwd()
  const list: string[] = [
    path.join(cwd, 'node_modules/.prisma/client/schema.prisma'),
    path.join(cwd, 'node_modules/@prisma/client/schema.prisma'),
  ]
  try {
    const require = createRequire(fileURLToPath(import.meta.url))
    const pkgJson = require.resolve('@prisma/client/package.json')
    const clientDir = path.dirname(pkgJson)
    list.push(path.join(clientDir, '..', '.prisma', 'client', 'schema.prisma'))
  } catch {
    // bundled or missing @prisma/client during tooling
  }
  return [...new Set(list)]
}

/** Provider from generated Prisma Client (v7: internal/class.ts; legacy: copied schema.prisma). */
function readGeneratedDatasourceProvider(): 'postgresql' | 'sqlite' | null {
  const cwd = process.cwd()
  const classTs = path.join(cwd, 'generated/prisma/internal/class.ts')
  try {
    if (fs.existsSync(classTs)) {
      const text = fs.readFileSync(classTs, 'utf8')
      const m = text.match(/"activeProvider":\s*"(postgresql|sqlite)"/)
      if (m?.[1] === 'postgresql' || m?.[1] === 'sqlite') {
        return m[1]
      }
    }
  } catch {
    // fall through
  }
  for (const schemaPath of prismaLegacySchemaCandidates()) {
    try {
      if (!fs.existsSync(schemaPath)) continue
      const text = fs.readFileSync(schemaPath, 'utf8')
      if (text.includes('provider = "postgresql"')) return 'postgresql'
      if (text.includes('provider = "sqlite"')) return 'sqlite'
    } catch {
      continue
    }
  }
  return null
}

/**
 * When Client was generated with schema.postgres.prisma, ensure DATABASE_URL is a postgres URL
 * (copy from POSTGRES_PRISMA_URL / POSTGRES_URL / etc. if needed).
 */
export function applyDatabaseUrlAliases(): void {
  const picked = pickPostgresUrlFromEnv()
  if (!picked) return

  const provider = readGeneratedDatasourceProvider()
  if (provider === 'postgresql') {
    process.env.DATABASE_URL = picked
    return
  }
  if (provider === 'sqlite') {
    return
  }

  // Provider unknown (e.g. schema path differs in a worker). Never clobber file: SQLite URLs.
  const cur = process.env.DATABASE_URL?.trim()
  if (!cur) {
    process.env.DATABASE_URL = picked
    return
  }
  if (cur.startsWith('file:')) return
  if (isPostgresConnectionUrl(cur)) {
    process.env.DATABASE_URL = picked
  }
}

applyDatabaseUrlAliases()
