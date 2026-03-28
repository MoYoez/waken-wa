import { execSync } from 'node:child_process'

import { repoRoot,resolvePrismaEnv } from './prisma-resolve-env.mjs'

try {
  const { schemaRel, provider } = resolvePrismaEnv()
  console.log(`[prisma-push] provider=${provider} schema=${schemaRel}`)
  execSync(`npx prisma db push --schema ${schemaRel}`, {
    stdio: 'inherit',
    cwd: repoRoot,
    env: process.env,
    shell: true,
  })
} catch (e) {
  console.error(e.message || e)
  process.exit(1)
}
