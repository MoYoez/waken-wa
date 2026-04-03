import { count } from 'drizzle-orm'

import { db } from '@/lib/db'
import { adminUsers } from '@/lib/drizzle-schema'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES } from '@/lib/site-config-constants'
import type { SetupInitialConfig } from '@/types/components'
import type { AdminSetupSnapshot } from '@/types/setup'

type DbErrorLike = {
  code?: unknown
  message?: unknown
  cause?: unknown
}

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

function getErrorCode(error: unknown): string | null {
  const current = error as DbErrorLike
  if (typeof current?.code === 'string') return current.code
  const cause = current?.cause as DbErrorLike | undefined
  if (typeof cause?.code === 'string') return cause.code
  return null
}

function getErrorMessage(error: unknown): string {
  const current = error as DbErrorLike
  if (typeof current?.message === 'string') return current.message
  const cause = current?.cause as DbErrorLike | undefined
  if (typeof cause?.message === 'string') return cause.message
  return ''
}

function isMissingTableError(error: unknown): boolean {
  const code = getErrorCode(error)
  if (code === '42P01' || code === 'undefined_table') {
    return true
  }

  return code === 'SQLITE_ERROR' && /no such table/i.test(getErrorMessage(error))
}

async function getAdminCountSafe(): Promise<number> {
  try {
    const [adminCountRow] = await db.select({ c: count() }).from(adminUsers)
    return Number(adminCountRow?.c ?? 0)
  } catch (error) {
    if (isMissingTableError(error)) {
      return 0
    }
    throw error
  }
}

async function getSetupInitialConfigSafe(): Promise<SetupInitialConfig | undefined> {
  try {
    const row = await getSiteConfigMemoryFirst()
    return row ? siteRowToSetupInitial(row) : undefined
  } catch (error) {
    if (isMissingTableError(error)) {
      return undefined
    }
    throw error
  }
}

export type { AdminSetupSnapshot } from '@/types/setup'

export type AdminInitState = {
  hasAdmin: boolean
}

export async function getAdminInitState(): Promise<AdminInitState> {
  const adminCount = await getAdminCountSafe()
  return { hasAdmin: adminCount > 0 }
}

/** Single DB round-trip for setup page and status checks. */
export async function getAdminSetupSnapshot(): Promise<AdminSetupSnapshot> {
  const [{ hasAdmin }, initialConfig] = await Promise.all([
    getAdminInitState(),
    getSetupInitialConfigSafe(),
  ])
  return {
    isConfigOK: hasAdmin && initialConfig !== undefined,
    hasAdmin,
    initialConfig,
  }
}

/** Convenience when only the boolean is needed. */
export async function isConfigOK(): Promise<boolean> {
  const s = await getAdminSetupSnapshot()
  return s.isConfigOK
}
