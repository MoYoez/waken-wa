import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const isMainModule = (() => {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return import.meta.url === pathToFileURL(path.resolve(entry)).href
  } catch {
    return false
  }
})()

export async function runSeed(prisma: PrismaClient) {
  console.log('Seeding database...')

  const existingAdmin = await prisma.adminUser.findUnique({
    where: { username: 'admin' }
  })

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin123', 12)
    await prisma.adminUser.create({
      data: {
        username: 'admin',
        passwordHash
      }
    })
    console.log('Created default admin user: admin / admin123')
  } else {
    console.log('Admin user already exists')
  }

  const existingToken = await prisma.apiToken.findFirst({
    where: { name: 'Default Token' }
  })

  if (!existingToken) {
    const token = crypto.randomBytes(32).toString('hex')
    await prisma.apiToken.create({
      data: {
        name: 'Default Token',
        token
      }
    })
    console.log('Created default API token:', token)
  } else {
    console.log('Default token already exists:', existingToken.token)
  }

  const activityCount = await prisma.activityLog.count()
  if (activityCount === 0) {
    await prisma.activityLog.createMany({
      data: [
        {
          device: 'MacBook Pro',
          processName: 'Visual Studio Code',
          processTitle: 'activity-tracker - index.tsx',
          startedAt: new Date(Date.now() - 1000 * 60 * 30),
          metadata: { editor: 'vscode', workspace: 'activity-tracker' }
        },
        {
          device: 'MacBook Pro',
          processName: 'Chrome',
          processTitle: 'GitHub - Pull Requests',
          startedAt: new Date(Date.now() - 1000 * 60 * 60),
          endedAt: new Date(Date.now() - 1000 * 60 * 30),
          metadata: { browser: 'chrome', url: 'github.com' }
        },
        {
          device: 'iPhone 15 Pro',
          processName: 'Spotify',
          processTitle: 'Now Playing: Chill Vibes',
          startedAt: new Date(Date.now() - 1000 * 60 * 120),
          metadata: { app: 'spotify', playlist: 'Chill Vibes' }
        }
      ]
    })
    console.log('Created sample activity logs')
  }

  console.log('Seeding complete!')
}

async function main() {
  const prisma = new PrismaClient()
  try {
    await runSeed(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

if (isMainModule) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
