import type { SetupInitialConfig } from '@/components/admin/setup-form'
import prisma from '@/lib/prisma'

function siteRowToSetupInitial(row: unknown): SetupInitialConfig {
  const r = row as Record<string, unknown>
  return {
    pageTitle: typeof r.pageTitle === 'string' ? r.pageTitle : undefined,
    userName: typeof r.userName === 'string' ? r.userName : '',
    userBio: typeof r.userBio === 'string' ? r.userBio : '',
    avatarUrl: typeof r.avatarUrl === 'string' ? r.avatarUrl : '',
    userNote: typeof r.userNote === 'string' ? r.userNote : '',
    historyWindowMinutes:
      typeof r.historyWindowMinutes === 'number' ? r.historyWindowMinutes : 120,
    currentlyText: typeof r.currentlyText === 'string' ? r.currentlyText : '',
    earlierText: typeof r.earlierText === 'string' ? r.earlierText : '',
    adminText: typeof r.adminText === 'string' ? r.adminText : '',
  }
}

export type AdminSetupSnapshot = {
  /** True when at least one admin exists and SiteConfig id=1 exists (setup finished). */
  isConfigOK: boolean
  hasAdmin: boolean
  /** Defaults for setup form when a SiteConfig row exists but setup is incomplete. */
  initialConfig?: SetupInitialConfig
}

/** Single DB round-trip for setup page and status checks. */
export async function getAdminSetupSnapshot(): Promise<AdminSetupSnapshot> {
  const [adminCount, row] = await Promise.all([
    prisma.adminUser.count(),
    prisma.siteConfig.findUnique({ where: { id: 1 } }),
  ])
  const hasAdmin = adminCount > 0
  return {
    isConfigOK: hasAdmin && row !== null,
    hasAdmin,
    initialConfig: row ? siteRowToSetupInitial(row) : undefined,
  }
}

/** Convenience when only the boolean is needed. */
export async function isConfigOK(): Promise<boolean> {
  const s = await getAdminSetupSnapshot()
  return s.isConfigOK
}
