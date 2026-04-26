import bcrypt from 'bcryptjs'
import { count } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { hashPassword, validatePasswordStrength } from '@/lib/auth'
import { getSession } from '@/lib/auth'
import { isRemoteAvatarUrl } from '@/lib/avatar-url'
import { db, isPostgresDb } from '@/lib/db'
import { DEFAULT_PAGE_TITLE, PAGE_TITLE_MAX_LEN } from '@/lib/default-page-title'
import { adminUsers, siteConfig } from '@/lib/drizzle-schema'
import { getRequestLanguage } from '@/lib/i18n/request-locale'
import { getT } from '@/lib/i18n/server'
import { safeSiteConfigUpsert } from '@/lib/safe-site-config-upsert'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { parseHistoryWindowMinutes, parseProcessStaleSeconds } from '@/lib/site-config-constants'
import { bootstrapSiteSettingsSplitStorage } from '@/lib/site-settings-write'
import { normalizeCustomCss } from '@/lib/theme-css'
import { parseThemeCustomSurface } from '@/lib/theme-custom-surface'

export async function POST(request: NextRequest) {
  const { t } = await getT('auth', { lng: getRequestLanguage(request) })
  try {
    const [countRows, configRows] = await Promise.all([
      db.select({ c: count() }).from(adminUsers),
      getSiteConfigMemoryFirst(),
    ])
    const countRow = countRows[0]
    const existingConfig = configRows
    const hasAdmin = Number(countRow?.c ?? 0) > 0

    if (hasAdmin && existingConfig) {
      return NextResponse.json(
        { success: false, error: t('setup.alreadyCompleted') },
        { status: 403 },
      )
    }

    if (hasAdmin) {
      const session = await getSession()
      if (!session) {
        return NextResponse.json({ success: false, error: t('errors.unauthorized') }, { status: 401 })
      }
    }

    const {
      username,
      password,
      userName,
      userBio,
      avatarUrl,
      avatarFetchByServerEnabled,
      userNote,
      themePreset,
      themeCustomSurface,
      customCss,
      historyWindowMinutes,
      appMessageRules,
      appBlacklist,
      appWhitelist,
      appFilterMode,
      appNameOnlyList,
      processStaleSeconds,
      pageLockEnabled,
      pageLockPassword,
      currentlyText,
      earlierText,
      adminText,
      pageTitle,
    } = await request.json()
    const normalizedUsername = String(username ?? '').trim()
    const rawPassword = String(password ?? '')
    const normalizedUserName = String(userName ?? '').trim()
    const normalizedUserBio = String(userBio ?? '').trim()
    const normalizedAvatarUrl = String(avatarUrl ?? '').trim()
    const normalizedAvatarFetchByServerEnabled =
      isRemoteAvatarUrl(normalizedAvatarUrl) && avatarFetchByServerEnabled === true
    const normalizedUserNote = String(userNote ?? '').trim()
    const normalizedThemePreset = String(themePreset ?? 'basic').trim() || 'basic'
    const normalizedThemeCustomSurface = parseThemeCustomSurface(themeCustomSurface ?? {})
    const normalizedCustomCss = normalizeCustomCss(customCss)
    const normalizedHistoryWindowMinutes = parseHistoryWindowMinutes(historyWindowMinutes)
    const normalizedProcessStaleSeconds = parseProcessStaleSeconds(processStaleSeconds)
    const normalizedAppMessageRules = Array.isArray(appMessageRules) ? appMessageRules : []
    const normalizedAppBlacklist = Array.isArray(appBlacklist)
      ? appBlacklist
          .map((item: unknown) => String(item ?? '').trim())
          .filter((item: string) => item.length > 0)
      : []
    const normalizedAppWhitelist = Array.isArray(appWhitelist)
      ? appWhitelist
          .map((item: unknown) => String(item ?? '').trim())
          .filter((item: string) => item.length > 0)
      : []
    const normalizedAppFilterModeRaw = String(appFilterMode ?? 'blacklist').trim().toLowerCase()
    const normalizedAppFilterMode =
      normalizedAppFilterModeRaw === 'whitelist' ? 'whitelist' : 'blacklist'
    const normalizedAppNameOnlyList = Array.isArray(appNameOnlyList)
      ? appNameOnlyList
          .map((item: unknown) => String(item ?? '').trim())
          .filter((item: string) => item.length > 0)
      : []
    const normalizedPageLockEnabled = Boolean(pageLockEnabled)
    const rawPageLockPassword = String(pageLockPassword ?? '').trim()
    const normalizedCurrentlyText = String(currentlyText ?? '').trim() || '当前状态'
    const normalizedEarlierText = String(earlierText ?? '').trim() || '最近的随想录'
    const normalizedAdminText = String(adminText ?? '').trim() || 'admin'
    const normalizedPageTitle = (
      String(pageTitle ?? '').trim() || DEFAULT_PAGE_TITLE
    ).slice(0, PAGE_TITLE_MAX_LEN)

    if (!normalizedUserName || !normalizedUserBio || !normalizedAvatarUrl) {
      return NextResponse.json(
        { success: false, error: t('setup.requiredHomeInfo') },
        { status: 400 }
      )
    }

    if (!hasAdmin && (!normalizedUsername || !rawPassword)) {
      return NextResponse.json(
        { success: false, error: t('setup.requiredAdminCredentials') },
        { status: 400 }
      )
    }

    if (!hasAdmin) {
      const pwError = validatePasswordStrength(rawPassword, t)
      if (pwError) {
        return NextResponse.json(
          { success: false, error: pwError },
          { status: 400 }
        )
      }
    }

    if (
      normalizedPageLockEnabled &&
      !rawPageLockPassword &&
      !existingConfig?.pageLockPasswordHash
    ) {
      return NextResponse.json(
        { success: false, error: t('setup.pageLockPasswordRequired') },
        { status: 400 }
      )
    }

    const pageLockPasswordHash =
      rawPageLockPassword.length > 0
        ? await bcrypt.hash(rawPageLockPassword, 12)
        : existingConfig?.pageLockPasswordHash ?? null

    const passwordHashForAdmin = !hasAdmin ? await hashPassword(rawPassword) : null

    const upsertPayload = {
      where: { id: 1 },
      update: {
        pageTitle: normalizedPageTitle,
        userName: normalizedUserName,
        userBio: normalizedUserBio,
        avatarUrl: normalizedAvatarUrl,
        avatarFetchByServerEnabled: normalizedAvatarFetchByServerEnabled,
        userNote: normalizedUserNote,
        themePreset: normalizedThemePreset,
        themeCustomSurface: normalizedThemeCustomSurface,
        customCss: normalizedCustomCss,
        historyWindowMinutes: normalizedHistoryWindowMinutes,
        appMessageRules: normalizedAppMessageRules,
        appBlacklist: normalizedAppBlacklist,
        appWhitelist: normalizedAppWhitelist,
        appFilterMode: normalizedAppFilterMode,
        appNameOnlyList: normalizedAppNameOnlyList,
        processStaleSeconds: normalizedProcessStaleSeconds,
        pageLockEnabled: normalizedPageLockEnabled,
        pageLockPasswordHash,
        currentlyText: normalizedCurrentlyText,
        earlierText: normalizedEarlierText,
        adminText: normalizedAdminText,
      },
      create: {
        id: 1,
        pageTitle: normalizedPageTitle,
        userName: normalizedUserName,
        userBio: normalizedUserBio,
        avatarUrl: normalizedAvatarUrl,
        avatarFetchByServerEnabled: normalizedAvatarFetchByServerEnabled,
        userNote: normalizedUserNote,
        themePreset: normalizedThemePreset,
        themeCustomSurface: normalizedThemeCustomSurface,
        customCss: normalizedCustomCss,
        historyWindowMinutes: normalizedHistoryWindowMinutes,
        appMessageRules: normalizedAppMessageRules,
        appBlacklist: normalizedAppBlacklist,
        appWhitelist: normalizedAppWhitelist,
        appFilterMode: normalizedAppFilterMode,
        appNameOnlyList: normalizedAppNameOnlyList,
        processStaleSeconds: normalizedProcessStaleSeconds,
        pageLockEnabled: normalizedPageLockEnabled,
        pageLockPasswordHash,
        currentlyText: normalizedCurrentlyText,
        earlierText: normalizedEarlierText,
        adminText: normalizedAdminText,
      },
    }

    async function applySetup(executor: typeof db) {
      let admin: { id: number; username: string } | null = null
      if (!hasAdmin && passwordHashForAdmin) {
        const [row] = await executor
          .insert(adminUsers)
          .values({
            username: normalizedUsername,
            passwordHash: passwordHashForAdmin,
          })
          .returning({ id: adminUsers.id, username: adminUsers.username })
        admin = row ?? null
      }
      const upsertResult = await safeSiteConfigUpsert(upsertPayload, executor)
      if (upsertResult.strippedColumns.length > 0) {
        console.warn(
          `[setup-admin] unknown DB columns stripped during setup upsert: ${upsertResult.strippedColumns.join(', ')}`,
        )
      }
      await bootstrapSiteSettingsSplitStorage(executor)
      return { admin, schemaWarnings: upsertResult.strippedColumns }
    }

    const result = isPostgresDb()
      ? await db.transaction(async (tx: typeof db) => applySetup(tx))
      : await applySetup(db)

    return NextResponse.json(
      {
        success: true,
        data: result.admin,
        adminCreated: !hasAdmin,
        schemaWarnings: result.schemaWarnings,
      },
      { status: hasAdmin ? 200 : 201 }
    )
  } catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: string }).code) : ''
    const msg = String((error as { message?: string })?.message ?? error ?? '')
    if (
      code === '23505' ||
      code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      /unique constraint failed/i.test(msg)
    ) {
      return NextResponse.json(
        { success: false, error: t('setup.duplicateUsername') },
        { status: 409 },
      )
    }
    console.error('初始化管理员失败:', error)
    return NextResponse.json(
      { success: false, error: t('setup.initializeFailed') },
      { status: 500 }
    )
  }
}
