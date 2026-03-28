import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '@/generated/prisma/client'
import { isPostgresConnectionUrl } from '@/lib/db-env'

declare global {
  var prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const raw = process.env.DATABASE_URL?.trim()
  if (raw && isPostgresConnectionUrl(raw)) {
    const adapter = new PrismaPg({
      connectionString: raw,
      connectionTimeoutMillis: 5000,
    })
    return new PrismaClient({ adapter })
  }
  const sqliteUrl =
    raw && !isPostgresConnectionUrl(raw) ? raw : 'file:./prisma/dev.db'
  const adapter = new PrismaBetterSqlite3({ url: sqliteUrl })
  return new PrismaClient({ adapter })
}

export const prisma = globalThis.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

export default prisma
