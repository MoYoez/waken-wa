import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import simpleImportSort from 'eslint-plugin-simple-import-sort'

/**
 * Add eslint-config-next/typescript when you want @typescript-eslint rules (stricter).
 * @see https://nextjs.org/docs/app/api-reference/config/eslint
 */
export default defineConfig([
  // ESLint may try to traverse .vercel even when absent; ignore explicitly.
  {
    ignores: ['.vercel/**'],
  },
  ...nextVitals,
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/exports': 'error',
      'simple-import-sort/imports': 'error',
      // Project rule: Prisma 7 client is generated to @/generated/prisma/client, not @prisma/client.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              message:
                'Import PrismaClient and model types from @/generated/prisma/client (Prisma ORM 7).',
            },
          ],
        },
      ],
      // React 19 compiler rules: warn until refactors (mounted portals, skeleton random width, etc.).
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'generated/**',
    'node_modules/**',
  ]),
])
