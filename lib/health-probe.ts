import 'server-only'

import { sql } from 'drizzle-orm'

import { db, isPostgresDb } from '@/lib/db'
import { hasRedisConfigured, redisPing } from '@/lib/redis-client'

export type DependencyStatus = 'ok' | 'down' | 'disabled'

export type HealthReport = {
  status: 'ok' | 'degraded'
  checks: {
    database: { status: DependencyStatus; driver: 'postgres' | 'sqlite' }
    redis: { status: DependencyStatus }
  }
}

/**
 * Best-effort DB connectivity probe.
 * The node-postgres driver exposes `execute()`, while better-sqlite3 uses `get()`.
 */
async function ProbeDatabase(): Promise<boolean> {
  try {
    if (isPostgresDb()) {
      await db.execute(sql`select 1`)
    } else {
      db.get(sql`select 1`)
    }
    return true
  } catch {
    return false
  }
}

/**
 * Compose a dependency health report.
 * A missing/disabled Redis is not a failure; only a configured-but-unreachable
 * Redis or an unreachable database marks the service as degraded.
 */
export async function GetHealthReport(): Promise<HealthReport> {
  const driver: 'postgres' | 'sqlite' = isPostgresDb() ? 'postgres' : 'sqlite'

  const redisConfigured = hasRedisConfigured()
  const [databaseOk, redisOk] = await Promise.all([
    ProbeDatabase(),
    redisConfigured ? redisPing() : Promise.resolve(false),
  ])

  const redisStatus: DependencyStatus = !redisConfigured ? 'disabled' : redisOk ? 'ok' : 'down'
  const databaseStatus: DependencyStatus = databaseOk ? 'ok' : 'down'

  const degraded = databaseStatus === 'down' || redisStatus === 'down'

  return {
    status: degraded ? 'degraded' : 'ok',
    checks: {
      database: { status: databaseStatus, driver },
      redis: { status: redisStatus },
    },
  }
}
