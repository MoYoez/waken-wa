import { count, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES } from '@/lib/site-config-constants'
import { adminUsers, siteConfig } from '@/lib/drizzle-schema'
import type { SetupInitialConfig } from '@/types/components'
import type { AdminSetupSnapshot } from '@/types/setup'

function siteRowToSetupInitial(row: unknown): SetupInitialConfig {
  const r = row as Record<string, unknown>
  return {
    pageTitle: typeof r.pageTitle === 'string' ? r.pageTitle : undefined,
    userName: typeof r.userName === 'string' ? r.userName : '',
    userBio: typeof r.userBio === 'string' ? r.userBio : '',
    avatarUrl: typeof r.avatarUrl === 'string' ? r.avatarUrl : '',
    userNote: typeof r.userNote === 'string' ? r.userNote : '',
    historyWindowMinutes:
      typeof r.historyWindowMinutes === 'number'
        ? r.historyWindowMinutes
        : SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
    currentlyText: typeof r.currentlyText === 'string' ? r.currentlyText : '',
    earlierText: typeof r.earlierText === 'string' ? r.earlierText : '',
    adminText: typeof r.adminText === 'string' ? r.adminText : '',
  }
}

export type { AdminSetupSnapshot } from '@/types/setup'

/** Single DB round-trip for setup page and status checks. */
export async function getAdminSetupSnapshot(): Promise<AdminSetupSnapshot> {
  const [[adminCountRow], [row]] = await Promise.all([
    db.select({ c: count() }).from(adminUsers),
    db.select().from(siteConfig).where(eq(siteConfig.id, 1)).limit(1),
  ])
  const adminCount = Number(adminCountRow?.c ?? 0)
  const hasAdmin = adminCount > 0
  return {
    isConfigOK: hasAdmin && row !== undefined,
    hasAdmin,
    initialConfig: row ? siteRowToSetupInitial(row) : undefined,
  }
}

/** Convenience when only the boolean is needed. */
export async function isConfigOK(): Promise<boolean> {
  const s = await getAdminSetupSnapshot()
  return s.isConfigOK
}
