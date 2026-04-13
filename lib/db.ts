import 'server-only'

import Database from 'better-sqlite3'
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import fs from 'node:fs'
import path from 'node:path'
import { Pool } from 'pg'

import { pgSchema } from '@/drizzle/schema.pg'
import { sqliteSchema } from '@/drizzle/schema.sqlite'
import { isPostgresConnectionUrl } from '@/lib/db-env'
import { postgresAdapterPoolConfig } from '@/lib/pg-pool-config'

function sqliteFilePath(url: string): string {
  const u = url.trim()
  if (!u.startsWith('file:')) return u
  const rest = u.slice('file:'.length)
  if (rest.startsWith('//')) return rest.slice(2)
  return rest
}

type AppDb =
  | ReturnType<typeof drizzlePg<typeof pgSchema>>
  | ReturnType<typeof drizzleSqlite<typeof sqliteSchema>>

declare global {
  var __wakenDrizzleDb: AppDb | undefined
  var __wakenDrizzlePool: Pool | undefined
  var __wakenDrizzleSqlite: Database.Database | undefined
}

function createDb(): AppDb {
  const raw = process.env.DATABASE_URL?.trim()
  if (raw && isPostgresConnectionUrl(raw)) {
    const pool =
      globalThis.__wakenDrizzlePool ??
      new Pool(postgresAdapterPoolConfig(raw))
    if (process.env.NODE_ENV !== 'production') {
      globalThis.__wakenDrizzlePool = pool
    }
    return drizzlePg(pool, { schema: pgSchema })
  }
  const sqliteUrl =
    raw && !isPostgresConnectionUrl(raw) ? raw : 'file:./data/dev.db'
  const dbPath = sqliteFilePath(sqliteUrl)
  const dir = path.dirname(dbPath)
  if (dir && dir !== '.') {
    fs.mkdirSync(dir, { recursive: true })
  }
  const client =
    globalThis.__wakenDrizzleSqlite ?? new Database(dbPath)
  if (process.env.NODE_ENV !== 'production') {
    globalThis.__wakenDrizzleSqlite = client
  }
  return drizzleSqlite(client, { schema: sqliteSchema })
}

const rawDb = globalThis.__wakenDrizzleDb ?? createDb()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__wakenDrizzleDb = rawDb
}

/**
 * Runtime uses exactly one driver (pg or better-sqlite3). Pg vs SQLite Drizzle types are not
 * a callable union in TypeScript; use a loose surface for app queries.
 */
export const db: any = rawDb

export function isPostgresDb(): boolean {
  const raw = process.env.DATABASE_URL?.trim()
  return !!raw && isPostgresConnectionUrl(raw)
}

export { appSchema as schema } from '@/lib/drizzle-schema'
