import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'
import { runSeed } from './seed'

function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
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

    // Strip surrounding quotes from `.env` values.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

async function main() {
  loadDotEnvLocal()

  const provider = (process.env.DATABASE_PROVIDER || 'postgresql').toLowerCase()
  const hasPostgresUrl = !!process.env.POSTGRES_URL?.trim()
  const hasDatabaseUrl = !!process.env.DATABASE_URL?.trim()

  if (provider === 'sqlite') {
    if (!hasDatabaseUrl) {
      console.warn('[seed-if-needed] DATABASE_URL not set for sqlite, skip')
      process.exit(0)
    }
  } else {
    if (!hasPostgresUrl) {
      console.warn('[seed-if-needed] POSTGRES_URL not set for postgresql, skip')
      process.exit(0)
    }
  }

  // Prisma reads datasource url from env inside the selected schema.
  // We only use this check to avoid confusing errors when connection env vars are missing.
  if (!(hasPostgresUrl || hasDatabaseUrl)) {
    console.warn('[seed-if-needed] No database URL env vars set, skip')
    process.exit(0)
  }

  const prisma = new PrismaClient()
  try {
    const adminCount = await prisma.adminUser.count()
    if (adminCount === 0) {
      console.log('[seed-if-needed] no admin user, running seed...')
      await runSeed(prisma)
    } else {
      console.log('[seed-if-needed] admin user exists, skip seed')
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
