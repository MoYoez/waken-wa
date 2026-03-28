/**
 * Runs `prisma generate` with the schema chosen from env (same rules as init-db / postinstall).
 * Used by `pnpm build` on Vercel so Client matches DATABASE_URL (Postgres vs SQLite).
 */
import { execSync } from 'node:child_process'

import { repoRoot,resolvePrismaEnv } from './prisma-resolve-env.mjs'

try {
  const { schemaRel, provider } = resolvePrismaEnv()
  console.log(`[prisma-generate] provider=${provider} schema=${schemaRel}`)
  execSync(`npx prisma generate --schema ${schemaRel}`, {
    stdio: 'inherit',
    cwd: repoRoot,
    env: process.env,
    shell: true,
  })
} catch (e) {
  console.error(e.message || e)
  process.exit(1)
}
