import bcrypt from 'bcryptjs'

import {
  REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
  REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS,
} from '@/constants/activity-api'
import {
  SITE_CONFIG_HISTORY_WINDOW_MAX_MINUTES,
  SITE_CONFIG_HISTORY_WINDOW_MIN_MINUTES,
  SITE_CONFIG_PROCESS_STALE_MAX_SECONDS,
  SITE_CONFIG_PROCESS_STALE_MIN_SECONDS,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
  SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
} from '@/constants/site-config'
import { normalizeActivityUpdateMode } from '@/lib/activity-update-mode'
import { isRemoteAvatarUrl } from '@/lib/avatar-url'
import {
  isRedisCacheForcedOnServerless,
  parseRedisCacheTtlSeconds,
} from '@/lib/cache-runtime-toggle'
import { DEFAULT_PAGE_TITLE, PAGE_TITLE_MAX_LEN } from '@/lib/default-page-title'
import { normalizeHitokotoCategories, normalizeHitokotoEncode } from '@/lib/hitokoto'
import { normalizeInspirationAllowedHashes } from '@/lib/inspiration-device-allowlist'
import {
  assertAllowedLlmFields,
  createSiteConfigFieldReaders,
  ensureJsonObject,
  getNormalizedExistingSiteConfig,
  getSafeSiteConfig,
  LLM_DENIED_SITE_CONFIG_KEYS,
  normalizeAiToolMode,
  resolveColorSettings,
  resolveTodayStatusSettings,
} from '@/lib/llm-site-config-helpers'
import {
  mediaPlaySourceBlocklistFromRules,
  normalizeMediaPlaySourceRules,
} from '@/lib/media-play-source-rules'
import { normalizePublicPageFontOptions } from '@/lib/public-page-font'
import { normalizeReportedAppTitleLimit } from '@/lib/reported-app-title-limit'
import {
  backfillCoursePeriodIdsFromTemplate,
  defaultSchedulePeriodTemplate,
  isAllowedSlotMinutes,
  MAX_SCHEDULE_ICS_BYTES,
  parseScheduleCoursesJson,
  parseSchedulePeriodTemplateJson,
  validateCoursePeriodIdsAgainstTemplate,
} from '@/lib/schedule-courses'
import {
  defaultScheduleGridByWeekday,
  minIntervalFromGrid,
  normalizeScheduleGridByWeekday,
} from '@/lib/schedule-grid-by-weekday'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { storeSiteConfigInlineImageSources } from '@/lib/site-config-image-sources'
import {
  parseHistoryWindowMinutes,
  parseIntegerInRangeForWrite,
  parseProcessStaleSeconds,
} from '@/lib/site-config-values'
import { normalizeSiteIconUrl } from '@/lib/site-icon'
import { unsanitizeSiteConfigImageInputs } from '@/lib/site-image-urls'
import { persistCompatibilitySiteConfigValues } from '@/lib/site-settings-write'
import { getConfiguredSkillsMode, normalizeSkillsOauthTokenTtlMinutes } from '@/lib/skills-auth'
import {
  normalizeStatusCardCoverKey,
  normalizeStatusCardCoverRev,
  normalizeStatusCardSettings,
  parseStatusCardDimensionForWrite,
} from '@/lib/status-card-options'
import { normalizeCustomCss } from '@/lib/theme-css'
import { parseThemeCustomSurface } from '@/lib/theme-custom-surface'
import { normalizeTimezone } from '@/lib/timezone'

export { getSafeSiteConfig, LLM_DENIED_SITE_CONFIG_KEYS }

function normalizeMediaCoverMaxCount(value: unknown): number {
  const count = Number(value)
  if (!Number.isFinite(count)) return 50
  return Math.min(Math.max(Math.round(count), 0), 500)
}

function parseMediaCoverMaxCountForWrite(value: unknown): number {
  return parseIntegerInRangeForWrite(value, 0, 500, 'mediaCoverMaxCount')
}

export async function prepareSiteConfigValuesFromPayload(
  body: Record<string, unknown>,
  options?: { allowRestrictedFields?: boolean },
) {
  ensureJsonObject(body)
  assertAllowedLlmFields(body, options)

  const existing = await getNormalizedExistingSiteConfig()
  const normalizedBody = await storeSiteConfigInlineImageSources(
    unsanitizeSiteConfigImageInputs(body, existing),
  )

  const { has, strField, trimStr, strArr } = createSiteConfigFieldReaders(normalizedBody, existing)

  const pageTitle = strField('pageTitle', DEFAULT_PAGE_TITLE).slice(0, PAGE_TITLE_MAX_LEN)
  const siteIconUrl = normalizeSiteIconUrl(trimStr('siteIconUrl'))
  const userName = trimStr('userName')
  const userBio = trimStr('userBio')
  const avatarUrl = trimStr('avatarUrl')
  let avatarFetchByServerEnabled =
    isRemoteAvatarUrl(avatarUrl) && existing?.avatarFetchByServerEnabled === true
  if (
    normalizedBody.avatarFetchByServerEnabled !== undefined &&
    normalizedBody.avatarFetchByServerEnabled !== null
  ) {
    avatarFetchByServerEnabled =
      isRemoteAvatarUrl(avatarUrl) && Boolean(normalizedBody.avatarFetchByServerEnabled)
  }
  const userNote = trimStr('userNote')
  const themePreset = strField('themePreset', 'basic')
  const themeCustomSurface = parseThemeCustomSurface(
    has('themeCustomSurface') ? normalizedBody.themeCustomSurface : existing?.themeCustomSurface,
  )
  const publicFontOptionsEnabled = has('publicFontOptionsEnabled')
    ? Boolean(normalizedBody.publicFontOptionsEnabled)
    : existing?.publicFontOptionsEnabled === true
  const publicFontOptions = normalizePublicPageFontOptions(
    has('publicFontOptions') ? normalizedBody.publicFontOptions : existing?.publicFontOptions,
  )
  const customCss = normalizeCustomCss(
    has('customCss') ? normalizedBody.customCss : existing?.customCss,
  )
  const aiToolMode = normalizeAiToolMode(
    has('aiToolMode') ? normalizedBody.aiToolMode : existing?.aiToolMode,
  )
  const mcpThemeToolsEnabled =
    aiToolMode === 'mcp' &&
    (has('mcpThemeToolsEnabled')
      ? Boolean(normalizedBody.mcpThemeToolsEnabled)
      : Boolean(existing?.mcpThemeToolsEnabled))
  const openApiDocsEnabled = has('openApiDocsEnabled')
    ? Boolean(normalizedBody.openApiDocsEnabled)
    : existing?.openApiDocsEnabled !== false
  const skillsDebugEnabled = has('skillsDebugEnabled')
    ? Boolean(normalizedBody.skillsDebugEnabled)
    : existing?.skillsDebugEnabled === true
  const skillsAuthMode = has('skillsAuthMode')
    ? getConfiguredSkillsMode(normalizedBody.skillsAuthMode)
    : getConfiguredSkillsMode(existing?.skillsAuthMode)
  const skillsOauthTokenTtlMinutes = normalizeSkillsOauthTokenTtlMinutes(
    has('skillsOauthTokenTtlMinutes')
      ? normalizedBody.skillsOauthTokenTtlMinutes
      : existing?.skillsOauthTokenTtlMinutes,
  )
  const currentlyText = strField('currentlyText', '当前状态')
  const earlierText = strField('earlierText', '最近的随想录')
  const adminText = strField('adminText', 'admin')
  const pageLockEnabled = has('pageLockEnabled')
    ? Boolean(normalizedBody.pageLockEnabled)
    : Boolean(existing?.pageLockEnabled)
  const autoAcceptNewDevices = has('autoAcceptNewDevices')
    ? Boolean(normalizedBody.autoAcceptNewDevices)
    : Boolean(existing?.autoAcceptNewDevices)
  const rawPageLockPassword = has('pageLockPassword')
    ? String(normalizedBody.pageLockPassword ?? '')
    : ''
  const appMessageRules = has('appMessageRules')
    ? (Array.isArray(normalizedBody.appMessageRules) ? normalizedBody.appMessageRules : [])
    : (Array.isArray(existing?.appMessageRules) ? existing.appMessageRules : [])
  const appBlacklist = strArr('appBlacklist')
  const appWhitelist = strArr('appWhitelist')
  const appFilterModeRaw = has('appFilterMode')
    ? String(normalizedBody.appFilterMode ?? 'blacklist').trim().toLowerCase()
    : String(existing?.appFilterMode ?? 'blacklist').trim().toLowerCase()
  const appFilterMode = appFilterModeRaw === 'whitelist' ? 'whitelist' : 'blacklist'
  const appNameOnlyList = strArr('appNameOnlyList')
  const mediaPlaySourceBlocklist = strArr('mediaPlaySourceBlocklist')
  const mediaPlaySourceRules = normalizeMediaPlaySourceRules(
    has('mediaPlaySourceRules')
      ? normalizedBody.mediaPlaySourceRules
      : existing?.mediaPlaySourceRules,
    mediaPlaySourceBlocklist,
  )
  const historyWindowMinutes = has('historyWindowMinutes')
    ? parseIntegerInRangeForWrite(
        normalizedBody.historyWindowMinutes,
        SITE_CONFIG_HISTORY_WINDOW_MIN_MINUTES,
        SITE_CONFIG_HISTORY_WINDOW_MAX_MINUTES,
        'historyWindowMinutes',
      )
    : parseHistoryWindowMinutes(existing?.historyWindowMinutes)
  const processStaleSeconds = has('processStaleSeconds')
    ? parseIntegerInRangeForWrite(
        normalizedBody.processStaleSeconds,
        SITE_CONFIG_PROCESS_STALE_MIN_SECONDS,
        SITE_CONFIG_PROCESS_STALE_MAX_SECONDS,
        'processStaleSeconds',
      )
    : parseProcessStaleSeconds(existing?.processStaleSeconds)

  let captureReportedAppsEnabled = existing?.captureReportedAppsEnabled !== false
  if (
    normalizedBody.captureReportedAppsEnabled !== undefined &&
    normalizedBody.captureReportedAppsEnabled !== null
  ) {
    captureReportedAppsEnabled = Boolean(normalizedBody.captureReportedAppsEnabled)
  }
  const captureReportedAppTitleLimit = has('captureReportedAppTitleLimit')
    ? parseIntegerInRangeForWrite(
        normalizedBody.captureReportedAppTitleLimit,
        0,
        10,
        'captureReportedAppTitleLimit',
      )
    : normalizeReportedAppTitleLimit(existing?.captureReportedAppTitleLimit)

  let inspirationAllowedDeviceHashes: string[] | null = normalizeInspirationAllowedHashes(
    existing?.inspirationAllowedDeviceHashes ?? null,
  )
  if ('inspirationAllowedDeviceHashes' in normalizedBody) {
    if (normalizedBody.inspirationAllowedDeviceHashes === null) {
      inspirationAllowedDeviceHashes = null
    } else if (Array.isArray(normalizedBody.inspirationAllowedDeviceHashes)) {
      inspirationAllowedDeviceHashes =
        normalizeInspirationAllowedHashes(normalizedBody.inspirationAllowedDeviceHashes) ?? []
    }
  }

  let scheduleSlotMinutes =
    typeof existing?.scheduleSlotMinutes === 'number'
      ? existing.scheduleSlotMinutes
      : SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES
  const existingTemplateParsed = parseSchedulePeriodTemplateJson(
    existing?.schedulePeriodTemplate ?? null,
  )
  let schedulePeriodTemplate = existingTemplateParsed.ok
    ? existingTemplateParsed.data
    : defaultSchedulePeriodTemplate()
  if (normalizedBody.schedulePeriodTemplate !== undefined) {
    const parsedTemplate = parseSchedulePeriodTemplateJson(normalizedBody.schedulePeriodTemplate)
    if (!parsedTemplate.ok) {
      const error = new Error(parsedTemplate.error)
      ;(error as any).status = 400
      throw error
    }
    schedulePeriodTemplate = parsedTemplate.data
  }
  let scheduleGridByWeekday: unknown = existing?.scheduleGridByWeekday ?? null

  const slotInBody = normalizedBody.scheduleSlotMinutes !== undefined && normalizedBody.scheduleSlotMinutes !== null
  const gridInBody =
    normalizedBody.scheduleGridByWeekday !== undefined && normalizedBody.scheduleGridByWeekday !== null

  if (slotInBody) {
    const s = Number(normalizedBody.scheduleSlotMinutes)
    if (!isAllowedSlotMinutes(s)) {
      const error = new Error('Invalid schedule slot (use 15, 30, 45, or 60 minutes)')
      ;(error as any).status = 400
      throw error
    }
    scheduleSlotMinutes = s
  }

  if (gridInBody) {
    const normalized = normalizeScheduleGridByWeekday(
      normalizedBody.scheduleGridByWeekday,
      scheduleSlotMinutes,
    )
    if (!normalized.ok) {
      const error = new Error(normalized.error)
      ;(error as any).status = 400
      throw error
    }
    scheduleGridByWeekday = normalized.data
    scheduleSlotMinutes = minIntervalFromGrid(normalized.data)
  } else if (slotInBody) {
    scheduleGridByWeekday = defaultScheduleGridByWeekday(scheduleSlotMinutes)
  }

  let scheduleCoursesParsed = parseScheduleCoursesJson(existing?.scheduleCourses ?? null)
  if (!scheduleCoursesParsed.ok) {
    scheduleCoursesParsed = { ok: true, data: [] }
  }
  let scheduleCourses = scheduleCoursesParsed.data
  if (normalizedBody.scheduleCourses !== undefined) {
    const parsed = parseScheduleCoursesJson(normalizedBody.scheduleCourses)
    if (!parsed.ok) {
      const error = new Error(parsed.error)
      ;(error as any).status = 400
      throw error
    }
    scheduleCourses = parsed.data
  }
  const backfilled = backfillCoursePeriodIdsFromTemplate(scheduleCourses, schedulePeriodTemplate)
  scheduleCourses = backfilled.courses
  const periodValidation = validateCoursePeriodIdsAgainstTemplate(
    scheduleCourses,
    schedulePeriodTemplate,
  )
  if (!periodValidation.ok) {
    const error = new Error(periodValidation.error)
    ;(error as any).status = 400
    throw error
  }

  let scheduleIcs: string | null =
    typeof existing?.scheduleIcs === 'string' && existing.scheduleIcs.length > 0
      ? existing.scheduleIcs
      : null
  if (normalizedBody.scheduleIcs !== undefined) {
    const raw = normalizedBody.scheduleIcs === null || normalizedBody.scheduleIcs === undefined ? '' : String(normalizedBody.scheduleIcs)
    if (raw.length > MAX_SCHEDULE_ICS_BYTES) {
      const error = new Error(`scheduleIcs exceeds ${MAX_SCHEDULE_ICS_BYTES} bytes`)
      ;(error as any).status = 400
      throw error
    }
    scheduleIcs = raw.length > 0 ? raw : null
  }

  let scheduleInClassOnHome = Boolean(existing?.scheduleInClassOnHome)
  if (normalizedBody.scheduleInClassOnHome !== undefined && normalizedBody.scheduleInClassOnHome !== null) {
    scheduleInClassOnHome = Boolean(normalizedBody.scheduleInClassOnHome)
  }
  let scheduleHomeShowLocation = Boolean(existing?.scheduleHomeShowLocation)
  if (normalizedBody.scheduleHomeShowLocation !== undefined && normalizedBody.scheduleHomeShowLocation !== null) {
    scheduleHomeShowLocation = Boolean(normalizedBody.scheduleHomeShowLocation)
  }
  let scheduleHomeShowTeacher = Boolean(existing?.scheduleHomeShowTeacher)
  if (normalizedBody.scheduleHomeShowTeacher !== undefined && normalizedBody.scheduleHomeShowTeacher !== null) {
    scheduleHomeShowTeacher = Boolean(normalizedBody.scheduleHomeShowTeacher)
  }
  let scheduleHomeShowNextUpcoming = Boolean(existing?.scheduleHomeShowNextUpcoming)
  if (
    normalizedBody.scheduleHomeShowNextUpcoming !== undefined &&
    normalizedBody.scheduleHomeShowNextUpcoming !== null
  ) {
    scheduleHomeShowNextUpcoming = Boolean(normalizedBody.scheduleHomeShowNextUpcoming)
  }

  let scheduleHomeAfterClassesLabel = SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT
  const existingLabel = existing?.scheduleHomeAfterClassesLabel
  if (typeof existingLabel === 'string' && existingLabel.trim().length > 0) {
    scheduleHomeAfterClassesLabel = existingLabel
      .trim()
      .slice(0, SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN)
  }
  if (
    normalizedBody.scheduleHomeAfterClassesLabel !== undefined &&
    normalizedBody.scheduleHomeAfterClassesLabel !== null
  ) {
    const raw = String(normalizedBody.scheduleHomeAfterClassesLabel).trim()
    scheduleHomeAfterClassesLabel = (
      raw.length > 0 ? raw : SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT
    ).slice(0, SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN)
  }

  let appMessageRulesShowProcessName = existing?.appMessageRulesShowProcessName !== false
  if (
    normalizedBody.appMessageRulesShowProcessName !== undefined &&
    normalizedBody.appMessageRulesShowProcessName !== null
  ) {
    appMessageRulesShowProcessName = Boolean(normalizedBody.appMessageRulesShowProcessName)
  }

  let userNoteHitokotoEnabled = Boolean(existing?.userNoteHitokotoEnabled)
  if (normalizedBody.userNoteHitokotoEnabled !== undefined && normalizedBody.userNoteHitokotoEnabled !== null) {
    userNoteHitokotoEnabled = Boolean(normalizedBody.userNoteHitokotoEnabled)
  }
  let userNoteTypewriterEnabled = Boolean(existing?.userNoteTypewriterEnabled)
  if (normalizedBody.userNoteTypewriterEnabled !== undefined && normalizedBody.userNoteTypewriterEnabled !== null) {
    userNoteTypewriterEnabled = Boolean(normalizedBody.userNoteTypewriterEnabled)
  }
  let userNoteSignatureFontEnabled = Boolean(existing?.userNoteSignatureFontEnabled)
  if (
    normalizedBody.userNoteSignatureFontEnabled !== undefined &&
    normalizedBody.userNoteSignatureFontEnabled !== null
  ) {
    userNoteSignatureFontEnabled = Boolean(normalizedBody.userNoteSignatureFontEnabled)
  }
  let userNoteSignatureFontFamily =
    typeof existing?.userNoteSignatureFontFamily === 'string'
      ? existing.userNoteSignatureFontFamily.trim().slice(0, 160)
      : ''
  if (normalizedBody.userNoteSignatureFontFamily !== undefined && normalizedBody.userNoteSignatureFontFamily !== null) {
    userNoteSignatureFontFamily = String(normalizedBody.userNoteSignatureFontFamily).trim().slice(0, 160)
  }
  let pageLoadingEnabled = existing?.pageLoadingEnabled !== false
  if (normalizedBody.pageLoadingEnabled !== undefined && normalizedBody.pageLoadingEnabled !== null) {
    pageLoadingEnabled = Boolean(normalizedBody.pageLoadingEnabled)
  }
  let searchEngineIndexingEnabled = existing?.searchEngineIndexingEnabled !== false
  if (
    normalizedBody.searchEngineIndexingEnabled !== undefined &&
    normalizedBody.searchEngineIndexingEnabled !== null
  ) {
    searchEngineIndexingEnabled = Boolean(normalizedBody.searchEngineIndexingEnabled)
  }

  let userNoteHitokotoCategories = normalizeHitokotoCategories(
    existing?.userNoteHitokotoCategories ?? [],
  )
  if (normalizedBody.userNoteHitokotoCategories !== undefined) {
    userNoteHitokotoCategories = normalizeHitokotoCategories(normalizedBody.userNoteHitokotoCategories)
  }

  let userNoteHitokotoEncode = normalizeHitokotoEncode(existing?.userNoteHitokotoEncode)
  if (normalizedBody.userNoteHitokotoEncode !== undefined && normalizedBody.userNoteHitokotoEncode !== null) {
    userNoteHitokotoEncode = normalizeHitokotoEncode(normalizedBody.userNoteHitokotoEncode)
  }

  let userNoteHitokotoFallbackToNote = existing?.userNoteHitokotoFallbackToNote === true
  if (
    normalizedBody.userNoteHitokotoFallbackToNote !== undefined &&
    normalizedBody.userNoteHitokotoFallbackToNote !== null
  ) {
    userNoteHitokotoFallbackToNote = Boolean(normalizedBody.userNoteHitokotoFallbackToNote)
  }

  if (!userName || !userBio || !avatarUrl) {
    const error = new Error('请填写首页必填信息')
    ;(error as any).status = 400
    throw error
  }

  const pageLockPasswordHash =
    rawPageLockPassword.trim().length > 0
      ? await bcrypt.hash(rawPageLockPassword.trim(), 12)
      : existing?.pageLockPasswordHash ?? null

  if (pageLockEnabled && !pageLockPasswordHash) {
    const error = new Error('启用页面锁时请先设置访问密码')
    ;(error as any).status = 400
    throw error
  }

  let hcaptchaEnabled = Boolean(existing?.hcaptchaEnabled)
  if (normalizedBody.hcaptchaEnabled !== undefined && normalizedBody.hcaptchaEnabled !== null) {
    hcaptchaEnabled = Boolean(normalizedBody.hcaptchaEnabled)
  }
  let hcaptchaSiteKey: string | null = existing?.hcaptchaSiteKey ?? null
  if (normalizedBody.hcaptchaSiteKey !== undefined) {
    hcaptchaSiteKey =
      typeof normalizedBody.hcaptchaSiteKey === 'string' && normalizedBody.hcaptchaSiteKey.trim()
        ? normalizedBody.hcaptchaSiteKey.trim()
        : null
  }
  let hcaptchaSecretKey: string | null = existing?.hcaptchaSecretKey ?? null
  if (normalizedBody.hcaptchaSecretKey !== undefined) {
    hcaptchaSecretKey =
      typeof normalizedBody.hcaptchaSecretKey === 'string' && normalizedBody.hcaptchaSecretKey.trim()
        ? normalizedBody.hcaptchaSecretKey.trim()
        : null
  }

  if (hcaptchaEnabled && (!hcaptchaSiteKey || !hcaptchaSecretKey)) {
    const error = new Error('启用 hCaptcha 时请填写 Site Key 和 Secret Key')
    ;(error as any).status = 400
    throw error
  }

  let globalMouseTiltEnabled = existing?.globalMouseTiltEnabled === true
  if (normalizedBody.globalMouseTiltEnabled !== undefined && normalizedBody.globalMouseTiltEnabled !== null) {
    globalMouseTiltEnabled = Boolean(normalizedBody.globalMouseTiltEnabled)
  }

  let globalMouseTiltGyroEnabled = existing?.globalMouseTiltGyroEnabled === true
  if (normalizedBody.globalMouseTiltGyroEnabled !== undefined && normalizedBody.globalMouseTiltGyroEnabled !== null) {
    globalMouseTiltGyroEnabled = Boolean(normalizedBody.globalMouseTiltGyroEnabled)
  }

  let smoothScrollEnabled = existing?.smoothScrollEnabled === true
  if (normalizedBody.smoothScrollEnabled !== undefined && normalizedBody.smoothScrollEnabled !== null) {
    smoothScrollEnabled = Boolean(normalizedBody.smoothScrollEnabled)
  }

  let hideActivityMedia = existing?.hideActivityMedia === true
  if (normalizedBody.hideActivityMedia !== undefined && normalizedBody.hideActivityMedia !== null) {
    hideActivityMedia = Boolean(normalizedBody.hideActivityMedia)
  }
  const statusCardNormalized = normalizeStatusCardSettings(
    normalizedBody,
    existing ?? {},
    {
      parseDimension: (value, fallback, min, max, key) =>
        parseStatusCardDimensionForWrite(value, fallback, min, max, key),
    },
  )
  const {
    statusCardEnabled,
    statusCardVariant,
    statusCardTag,
    statusCardBackgroundKey,
    statusCardBackgroundRev,
    statusCardCoverKey,
    statusCardCoverRev,
    statusCardShowHeader,
    statusCardShowAvatar,
    statusCardShowName,
    statusCardShowBio,
    statusCardShowNote,
    statusCardPreferGame,
    statusCardShowInClassStatus,
    statusCardWidth,
    statusCardHeight,
    statusCardRadius,
    statusCardBg,
    statusCardSignatureBg,
    statusCardFg,
    statusCardMuted,
    statusCardAccent,
    statusCardBorder,
  } = statusCardNormalized
  let mediaDisplayShowSource = existing?.mediaDisplayShowSource === true
  if (normalizedBody.mediaDisplayShowSource !== undefined && normalizedBody.mediaDisplayShowSource !== null) {
    mediaDisplayShowSource = Boolean(normalizedBody.mediaDisplayShowSource)
  }
  let mediaDisplayShowCover = existing?.mediaDisplayShowCover === true
  if (normalizedBody.mediaDisplayShowCover !== undefined && normalizedBody.mediaDisplayShowCover !== null) {
    mediaDisplayShowCover = Boolean(normalizedBody.mediaDisplayShowCover)
  }
  let mediaDisplayShowAppIcon = existing?.mediaDisplayShowAppIcon === true
  if (normalizedBody.mediaDisplayShowAppIcon !== undefined && normalizedBody.mediaDisplayShowAppIcon !== null) {
    mediaDisplayShowAppIcon = Boolean(normalizedBody.mediaDisplayShowAppIcon)
  }
  let mediaDisplayShowNcmLink = existing?.mediaDisplayShowNcmLink === true
  if (normalizedBody.mediaDisplayShowNcmLink !== undefined && normalizedBody.mediaDisplayShowNcmLink !== null) {
    mediaDisplayShowNcmLink = Boolean(normalizedBody.mediaDisplayShowNcmLink)
  }
  let mediaCoverMaxCount = normalizeMediaCoverMaxCount(existing?.mediaCoverMaxCount)
  if (normalizedBody.mediaCoverMaxCount !== undefined && normalizedBody.mediaCoverMaxCount !== null) {
    mediaCoverMaxCount = parseMediaCoverMaxCountForWrite(normalizedBody.mediaCoverMaxCount)
  }

  let hideInspirationOnHome = existing?.hideInspirationOnHome === true
  if (normalizedBody.hideInspirationOnHome !== undefined && normalizedBody.hideInspirationOnHome !== null) {
    hideInspirationOnHome = Boolean(normalizedBody.hideInspirationOnHome)
  }

  let disableFrontendDeviceAnimation = existing?.disableFrontendDeviceAnimation === true
  if (normalizedBody.disableFrontendDeviceAnimation !== undefined && normalizedBody.disableFrontendDeviceAnimation !== null) {
    disableFrontendDeviceAnimation = Boolean(normalizedBody.disableFrontendDeviceAnimation)
  }

  let displayTimezone = existing?.displayTimezone ?? 'Asia/Shanghai'
  if (normalizedBody.displayTimezone !== undefined && normalizedBody.displayTimezone !== null) {
    displayTimezone = normalizeTimezone(normalizedBody.displayTimezone)
  }
  let forceDisplayTimezone = existing?.forceDisplayTimezone === true
  if (normalizedBody.forceDisplayTimezone !== undefined && normalizedBody.forceDisplayTimezone !== null) {
    forceDisplayTimezone = Boolean(normalizedBody.forceDisplayTimezone)
  }

  let activityUpdateMode = existing?.activityUpdateMode ?? 'sse'
  if (normalizedBody.activityUpdateMode !== undefined && normalizedBody.activityUpdateMode !== null) {
    activityUpdateMode = normalizeActivityUpdateMode(normalizedBody.activityUpdateMode)
  }
  let useNoSqlAsCacheRedis = existing?.useNoSqlAsCacheRedis === true
  if (normalizedBody.useNoSqlAsCacheRedis !== undefined && normalizedBody.useNoSqlAsCacheRedis !== null) {
    useNoSqlAsCacheRedis = Boolean(normalizedBody.useNoSqlAsCacheRedis)
  }
  if (isRedisCacheForcedOnServerless()) {
    useNoSqlAsCacheRedis = true
  }
  let redisCacheTtlSeconds = parseRedisCacheTtlSeconds(
    existing?.redisCacheTtlSeconds ?? REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
  )
  if (normalizedBody.redisCacheTtlSeconds !== undefined && normalizedBody.redisCacheTtlSeconds !== null) {
    redisCacheTtlSeconds = parseIntegerInRangeForWrite(
      normalizedBody.redisCacheTtlSeconds,
      1,
      REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS,
      'redisCacheTtlSeconds',
    )
  }

  let steamEnabled = existing?.steamEnabled ?? false
  if (normalizedBody.steamEnabled !== undefined) {
    steamEnabled = Boolean(normalizedBody.steamEnabled)
  }
  let steamId = existing?.steamId ?? null
  if (normalizedBody.steamId !== undefined) {
    steamId = normalizedBody.steamId ? String(normalizedBody.steamId).trim() : null
  }

  const STEAM_API_KEY_MAX_LEN = 128
  let steamApiKey: string | null = existing?.steamApiKey ?? null
  if (normalizedBody.steamApiKey !== undefined) {
    steamApiKey =
      typeof normalizedBody.steamApiKey === 'string' && normalizedBody.steamApiKey.trim()
        ? normalizedBody.steamApiKey.trim().slice(0, STEAM_API_KEY_MAX_LEN)
        : null
  }

  let activityRejectLockappSleep = existing?.activityRejectLockappSleep === true
  if (normalizedBody.activityRejectLockappSleep !== undefined && normalizedBody.activityRejectLockappSleep !== null) {
    activityRejectLockappSleep = Boolean(normalizedBody.activityRejectLockappSleep)
  }

  const {
    profileOnlineAccentColor,
    profileOnlinePulseEnabled,
    adminThemeColor,
    adminBackgroundColor,
  } = resolveColorSettings(normalizedBody, existing)
  const {
    todayStatusEmoji,
    todayStatusText,
    todayStatusExpiresAt,
    todayStatusBusy,
  } = resolveTodayStatusSettings(normalizedBody, existing)

  const siteConfigValues = {
    adminThemeColor,
    adminBackgroundColor,
    pageTitle,
    siteIconUrl,
    userName,
    userBio,
    avatarUrl,
    avatarFetchByServerEnabled,
    profileOnlineAccentColor,
    profileOnlinePulseEnabled,
    todayStatusEmoji,
    todayStatusText,
    todayStatusExpiresAt,
    todayStatusBusy,
    userNote,
    userNoteHitokotoEnabled,
    userNoteTypewriterEnabled,
    userNoteSignatureFontEnabled,
    userNoteSignatureFontFamily,
    pageLoadingEnabled,
    searchEngineIndexingEnabled,
    userNoteHitokotoCategories,
    userNoteHitokotoEncode,
    userNoteHitokotoFallbackToNote,
    themePreset,
    themeCustomSurface,
    publicFontOptionsEnabled,
    publicFontOptions,
    customCss,
    mcpThemeToolsEnabled,
    openApiDocsEnabled,
    skillsDebugEnabled,
    skillsAuthMode,
    skillsOauthTokenTtlMinutes,
    aiToolMode,
    historyWindowMinutes,
    appMessageRules,
    appMessageRulesShowProcessName,
    appBlacklist,
    appWhitelist,
    appFilterMode,
    appNameOnlyList,
    captureReportedAppsEnabled,
    captureReportedAppTitleLimit,
    mediaPlaySourceRules,
    mediaPlaySourceBlocklist: mediaPlaySourceBlocklistFromRules(mediaPlaySourceRules),
    processStaleSeconds,
    pageLockEnabled,
    pageLockPasswordHash,
    currentlyText,
    earlierText,
    adminText,
    autoAcceptNewDevices,
    inspirationAllowedDeviceHashes,
    scheduleSlotMinutes,
    schedulePeriodTemplate,
    scheduleGridByWeekday,
    scheduleCourses,
    scheduleIcs,
    scheduleInClassOnHome,
    scheduleHomeShowLocation,
    scheduleHomeShowTeacher,
    scheduleHomeShowNextUpcoming,
    scheduleHomeAfterClassesLabel,
    globalMouseTiltEnabled,
    globalMouseTiltGyroEnabled,
    smoothScrollEnabled,
    hideActivityMedia,
    statusCardEnabled,
    statusCardVariant,
    statusCardTag,
    statusCardBackgroundKey,
    statusCardBackgroundRev,
    statusCardCoverKey,
    statusCardCoverRev,
    statusCardShowHeader,
    statusCardShowAvatar,
    statusCardShowName,
    statusCardShowBio,
    statusCardShowNote,
    statusCardPreferGame,
    statusCardShowInClassStatus,
    statusCardWidth,
    statusCardHeight,
    statusCardRadius,
    statusCardBg,
    statusCardSignatureBg,
    statusCardFg,
    statusCardMuted,
    statusCardAccent,
    statusCardBorder,
    mediaDisplayShowSource,
    mediaDisplayShowCover,
    mediaDisplayShowAppIcon,
    mediaDisplayShowNcmLink,
    mediaCoverMaxCount,
    hideInspirationOnHome,
    disableFrontendDeviceAnimation,
    hcaptchaEnabled,
    hcaptchaSiteKey,
    hcaptchaSecretKey,
    displayTimezone,
    forceDisplayTimezone,
    activityUpdateMode,
    useNoSqlAsCacheRedis,
    redisCacheTtlSeconds,
    steamEnabled,
    steamId,
    steamApiKey,
    activityRejectLockappSleep,
  }

  return siteConfigValues
}

export async function updateSiteConfigFromPayload(
  body: Record<string, unknown>,
  options?: { allowRestrictedFields?: boolean },
) {
  const siteConfigValues = await prepareSiteConfigValuesFromPayload(body, options)
  return persistCompatibilitySiteConfigValues(siteConfigValues, body)
}
