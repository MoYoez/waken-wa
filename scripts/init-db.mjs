import { execSync } from 'node:child_process'

import { repoRoot,resolvePrismaEnv } from './prisma-resolve-env.mjs'

try {
  const { schemaRel, provider } = resolvePrismaEnv({ forInitDb: true })

  function run(cmd) {
    execSync(cmd, { stdio: 'inherit', cwd: repoRoot, env: process.env, shell: true })
  }

  console.log(`[init-db] provider=${provider} schema=${schemaRel}`)

  run(`npx prisma generate --schema ${schemaRel}`)
  run(`npx prisma db push --schema ${schemaRel}`)

  console.log('[init-db] done')
} catch (e) {
  console.error('[init-db]', e.message || e)
  process.exit(1)
}
