import { defineConfig } from 'drizzle-kit'

function ensureLibpqCompat(url: string): string {
  if (!url) return url
  try {
    const u = new URL(url)
    if (u.searchParams.get('sslmode') === 'require' && !u.searchParams.has('uselibpqcompat')) {
      u.searchParams.set('uselibpqcompat', 'true')
    }
    return u.toString()
  } catch {
    return url
  }
}

export default defineConfig({
  schema: './drizzle/schema.pg.ts',
  out: './drizzle/migrations/pg',
  dialect: 'postgresql',
  dbCredentials: {
    url: ensureLibpqCompat(process.env.DATABASE_URL ?? ''),
  },
  schemaFilter: ["public"],
  tablesFilter: ["!pg_stat_statements"],
})
