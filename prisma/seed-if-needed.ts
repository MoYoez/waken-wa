import { PrismaClient } from '@prisma/client'
import { runSeed } from './seed'

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.warn('[seed-if-needed] DATABASE_URL not set, skip')
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
