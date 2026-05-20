import { toast } from 'sonner'

import { adminQueryKeys } from '@/components/admin/admin-query-keys'
import {
  clearAdminLegacySettingsData,
  importAdminRuleTools,
  migrateAdminSettings,
  patchAdminSettingsCore,
  patchAdminSettingsSchedule,
  patchAdminSettingsTheme,
  patchAdminSkills,
} from '@/components/admin/admin-query-mutations'
import { formatNumberRange, parseIntegerInRange } from '@/components/admin/number-setting-input'
import {
  areValuesEqual,
  normalizeCorePayloadForComparison,
  uploadImportedImageSources,
} from '@/components/admin/web-settings-controller-utils'
import {
  extractRuleToolsImportFromWebPayload,
  normalizeSkillsAiAuthorizations,
  normalizeSkillsEditableConfig,
  normalizeStringListImport,
  parseExportPayload,
  webPayloadToFormPatch,
} from '@/components/admin/web-settings-utils'
import {
  REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS,
} from '@/constants/activity-api'
import {
  SITE_CONFIG_HISTORY_WINDOW_MAX_MINUTES,
  SITE_CONFIG_HISTORY_WINDOW_MIN_MINUTES,
  SITE_CONFIG_PROCESS_STALE_MAX_SECONDS,
  SITE_CONFIG_PROCESS_STALE_MIN_SECONDS,
} from '@/constants/site-config'
import { SITE_SETTINGS_SCHEDULE_CATEGORY_KEYS, SITE_SETTINGS_THEME_CATEGORY_KEYS } from '@/constants/site-settings'
import { normalizeAdminThemeColor } from '@/lib/admin-theme-color'
import { isRemoteAvatarUrl } from '@/lib/avatar-url'
import { normalizeProfileOnlineAccentColor } from '@/lib/profile-online-accent-color'
import { omitRecordKeys, pickRecordKeys } from '@/lib/site-settings-record'
import {
  normalizeTodayStatusBusy,
  normalizeTodayStatusEmoji,
  normalizeTodayStatusExpiresAt,
  normalizeTodayStatusText,
} from '@/lib/today-status'
import type { SkillsEditableConfig } from '@/types/web-settings'
import type {
  WebSettingsImportContext as ImportContext,
  WebSettingsMigrationContext as MigrationContext,
  WebSettingsSaveContext as SaveSettingsContext,
  WebSettingsSetString as SetString,
  WebSettingsSkillsSaveContext as SkillsSaveContext,
  WebSettingsTranslateFn as TranslateFn,
} from '@/types/web-settings-actions'

function ValidateRange(
  t: TranslateFn,
  label: string,
  raw: unknown,
  min: number,
  max: number,
): number | null {
  const value = parseIntegerInRange(raw, min, max)
  if (value !== null) return value
  toast.error(`${label}: ${t('common.numberRange', { range: formatNumberRange(min, max) })}`)
  return null
}

function NormalizeSkillsResponse(json: Record<string, any>): SkillsEditableConfig {
  return normalizeSkillsEditableConfig({
    enabled: json.enabled === true,
    authMode:
      json.authMode === 'oauth' || json.authMode === 'apikey'
        ? json.authMode
        : '',
    oauthTokenTtlMinutes: Number(json.oauthTokenTtlMinutes),
  })
}

async function SaveSkillsResponse(
  context: SkillsSaveContext,
  json: Record<string, any>,
  options?: { successMessage?: string | null },
) {
  const serverSkills = NormalizeSkillsResponse(json)
  context.setSkillsEnabled(serverSkills.enabled)
  context.setSkillsAuthMode(serverSkills.authMode)
  context.setSkillsOauthTokenTtlMinutes(serverSkills.oauthTokenTtlMinutes)
  context.setSkillsApiKeyConfigured(json.apiKeyConfigured === true)
  context.setSkillsOauthConfigured(json.oauthConfigured === true)
  context.setSkillsGeneratedApiKey(typeof json.generatedApiKey === 'string' ? json.generatedApiKey : '')
  context.setLegacyMcpConfigured(json.legacyMcpConfigured === true)
  context.setLegacyMcpGeneratedApiKey(
    typeof json.generatedLegacyMcpApiKey === 'string' ? json.generatedLegacyMcpApiKey : '',
  )
  context.setSkillsAiAuthorizations(normalizeSkillsAiAuthorizations(json.aiAuthorizations))
  void context.queryClient.invalidateQueries({ queryKey: adminQueryKeys.skills.settings() })
  if (options?.successMessage !== null) {
    toast.success(options?.successMessage || context.t('webSettingsSkills.toasts.saved'))
  }
  return serverSkills
}

export async function SaveWebSettingsSkillsConfig(
  context: SkillsSaveContext,
  patch: {
    enabled?: boolean
    authMode?: 'oauth' | 'apikey'
    rotateApiKey?: boolean
    rotateLegacyMcpKey?: boolean
    revokeOauthForAiClientId?: string
    oauthTokenTtlMinutes?: number
  },
  options?: { successMessage?: string | null },
) {
  context.setSkillsSaving(true)
  try {
    const json = await patchAdminSkills(patch)
    await SaveSkillsResponse(context, json, options)
  } catch (error) {
    console.error(error)
    toast.error(context.t('mutation.saveFailed'))
  } finally {
    context.setSkillsSaving(false)
  }
}

export async function RevokeWebSettingsSkillsOauthByAiClientId(
  context: SkillsSaveContext & { setSkillsRevokingAiClientId: SetString },
  aiClientId: string,
) {
  const normalized = String(aiClientId ?? '').trim().toLowerCase()
  if (!normalized) return
  context.setSkillsRevokingAiClientId(normalized)
  try {
    await SaveWebSettingsSkillsConfig(
      context,
      { revokeOauthForAiClientId: normalized },
      { successMessage: null },
    )
    toast.success(context.t('webSettingsSkills.toasts.revoked', { value: normalized }))
  } finally {
    context.setSkillsRevokingAiClientId('')
  }
}

export async function RunWebSettingsMigration(context: MigrationContext) {
  context.setMigrationActionPending(true)
  try {
    await migrateAdminSettings()
    await Promise.all([
      context.refreshSettingsData(),
      context.refreshMigrationData(),
      context.queryClient.invalidateQueries({ queryKey: adminQueryKeys.ruleTools.summary() }),
      context.queryClient.invalidateQueries({ queryKey: adminQueryKeys.ruleTools.config() }),
      context.queryClient.invalidateQueries({ queryKey: adminQueryKeys.ruleTools.rulesPreview() }),
      context.queryClient.invalidateQueries({ queryKey: ['admin', 'rule-tools', 'rules'] }),
      context.queryClient.invalidateQueries({ queryKey: ['admin', 'rule-tools', 'list'] }),
    ])
    toast.success(context.t('webSettingsMigration.toasts.migrated'))
  } catch (error) {
    toast.error(error instanceof Error ? error.message : context.t('common.networkErrorRetry'))
  } finally {
    context.setMigrationActionPending(false)
  }
}

export async function ClearWebSettingsLegacyData(context: MigrationContext) {
  context.setMigrationActionPending(true)
  try {
    await clearAdminLegacySettingsData()
    await Promise.all([context.refreshSettingsData(), context.refreshMigrationData()])
    toast.success(context.t('webSettingsMigration.toasts.legacyDataCleared'))
  } catch (error) {
    toast.error(error instanceof Error ? error.message : context.t('common.networkErrorRetry'))
  } finally {
    context.setMigrationActionPending(false)
  }
}

export async function SaveWebSettings(context: SaveSettingsContext) {
  context.setSaving(true)
  try {
    const poTrim = context.form.profileOnlineAccentColor.trim()
    if (poTrim && !normalizeProfileOnlineAccentColor(poTrim)) {
      toast.error(context.t('webSettingsActivity.profileOnlineAccentInvalid'))
      return
    }
    if (context.hasLockedLegacyChanges) {
      toast.error(context.t('webSettingsMigration.lockedToast'))
      return
    }

    const adminThemeColor = normalizeAdminThemeColor(context.form.adminThemeColor)
    const adminBackgroundColor = normalizeAdminThemeColor(context.form.adminBackgroundColor)

    const {
      adminThemeColor: _formAdminThemeColor,
      adminBackgroundColor: _formAdminBackgroundColor,
      inspirationDeviceRestrictionEnabled,
      inspirationAllowedDeviceHashes: inspirationHashSelection,
      hcaptchaSecretKey: hcaptchaSecretKeyForm,
      steamApiKey: steamApiKeyForm,
      ...formRest
    } = context.form

    const normalizedHistoryWindowMinutes = ValidateRange(
      context.t,
      context.t('webSettingsActivity.historyWindowLabel'),
      formRest.historyWindowMinutes,
      SITE_CONFIG_HISTORY_WINDOW_MIN_MINUTES,
      SITE_CONFIG_HISTORY_WINDOW_MAX_MINUTES,
    )
    const normalizedProcessStaleSeconds = ValidateRange(
      context.t,
      context.t('webSettingsActivity.processStaleLabel'),
      formRest.processStaleSeconds,
      SITE_CONFIG_PROCESS_STALE_MIN_SECONDS,
      SITE_CONFIG_PROCESS_STALE_MAX_SECONDS,
    )
    const normalizedMediaCoverMaxCount = ValidateRange(
      context.t,
      context.t('webSettingsActivity.mediaCoverMaxCountLabel'),
      formRest.mediaCoverMaxCount,
      0,
      500,
    )
    const normalizedRedisTtl = ValidateRange(
      context.t,
      context.t('webSettingsActivity.redisCacheTtlLabel'),
      formRest.redisCacheTtlSeconds,
      1,
      REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS,
    )
    const normalizedStatusCardWidth =
      typeof formRest.statusCardWidth === 'string' &&
      formRest.statusCardWidth.trim().toLowerCase() === 'auto'
        ? 'auto'
        : ValidateRange(
            context.t,
            context.t('webSettingsActivity.statusCard.widthLabel'),
            formRest.statusCardWidth,
            280,
            1200,
          )
    const normalizedStatusCardHeight =
      typeof formRest.statusCardHeight === 'string' &&
      formRest.statusCardHeight.trim().toLowerCase() === 'auto'
        ? 'auto'
        : ValidateRange(
            context.t,
            context.t('webSettingsActivity.statusCard.heightLabel'),
            formRest.statusCardHeight,
            1,
            720,
          )
    const normalizedStatusCardRadius = ValidateRange(
      context.t,
      context.t('webSettingsActivity.statusCard.radiusLabel'),
      formRest.statusCardRadius,
      0,
      80,
    )
    const normalizedSkillsOauthTokenTtlMinutes = ValidateRange(
      context.t,
      context.t('webSettingsSkills.oauthTtlTitle'),
      context.skillsOauthTokenTtlMinutes,
      5,
      1440,
    )
    if (
      normalizedHistoryWindowMinutes === null ||
      normalizedProcessStaleSeconds === null ||
      normalizedMediaCoverMaxCount === null ||
      normalizedRedisTtl === null ||
      normalizedStatusCardWidth === null ||
      normalizedStatusCardHeight === null ||
      normalizedStatusCardRadius === null ||
      normalizedSkillsOauthTokenTtlMinutes === null
    ) {
      return
    }

    const hcaptchaPatch: Record<string, unknown> = {
      hcaptchaEnabled: formRest.hcaptchaEnabled,
      hcaptchaSiteKey: formRest.hcaptchaSiteKey || null,
    }
    if (hcaptchaSecretKeyForm.trim()) {
      hcaptchaPatch.hcaptchaSecretKey = hcaptchaSecretKeyForm.trim()
    }

    const steamPatch: Record<string, unknown> = {}
    if (steamApiKeyForm.trim()) {
      steamPatch.steamApiKey = steamApiKeyForm.trim()
    }

    const settingsPayload = {
      ...formRest,
      adminThemeColor,
      adminBackgroundColor,
      avatarFetchByServerEnabled:
        isRemoteAvatarUrl(formRest.avatarUrl) && formRest.avatarFetchByServerEnabled === true,
      todayStatusEmoji: normalizeTodayStatusEmoji(formRest.todayStatusEmoji) || null,
      todayStatusText: normalizeTodayStatusText(formRest.todayStatusText) || null,
      todayStatusExpiresAt: normalizeTodayStatusExpiresAt(formRest.todayStatusExpiresAt) || null,
      todayStatusBusy: normalizeTodayStatusBusy(formRest.todayStatusBusy),
      historyWindowMinutes: normalizedHistoryWindowMinutes,
      processStaleSeconds: normalizedProcessStaleSeconds,
      mcpThemeToolsEnabled: context.form.mcpThemeToolsEnabled,
      redisCacheTtlSeconds: normalizedRedisTtl,
      mediaCoverMaxCount: normalizedMediaCoverMaxCount,
      statusCardWidth: normalizedStatusCardWidth,
      statusCardHeight: normalizedStatusCardHeight,
      statusCardRadius: normalizedStatusCardRadius,
      profileOnlineAccentColor: normalizeProfileOnlineAccentColor(poTrim || '') ?? null,
      inspirationAllowedDeviceHashes: inspirationDeviceRestrictionEnabled
      ? normalizeStringListImport(inspirationHashSelection)
        : null,
      ...hcaptchaPatch,
      ...steamPatch,
    } satisfies Record<string, unknown>

    const formSnapshot = structuredClone(context.form)
    const themePayload = pickRecordKeys(settingsPayload, SITE_SETTINGS_THEME_CATEGORY_KEYS)
    const schedulePayload = pickRecordKeys(settingsPayload, SITE_SETTINGS_SCHEDULE_CATEGORY_KEYS)
    const corePayload = omitRecordKeys(settingsPayload, [
      ...SITE_SETTINGS_THEME_CATEGORY_KEYS,
      ...SITE_SETTINGS_SCHEDULE_CATEGORY_KEYS,
    ])
    const coreKeys = Object.keys(corePayload)
    const coreDiff = !context.baselineForm
      ? true
      : !areValuesEqual(
          corePayload,
          normalizeCorePayloadForComparison(context.baselineForm as unknown as Record<string, unknown>),
        )

    const settingsSaveSteps: Array<{
      keys: readonly string[]
      run: () => Promise<Record<string, any>>
    }> = []

    if (context.themeSettingsDirty) {
      settingsSaveSteps.push({
        keys: SITE_SETTINGS_THEME_CATEGORY_KEYS,
        run: () => patchAdminSettingsTheme(themePayload),
      })
    }
    if (context.scheduleSettingsDirty) {
      settingsSaveSteps.push({
        keys: SITE_SETTINGS_SCHEDULE_CATEGORY_KEYS,
        run: () => patchAdminSettingsSchedule(schedulePayload),
      })
    }
    if (coreDiff) {
      settingsSaveSteps.push({
        keys: coreKeys,
        run: () => patchAdminSettingsCore(corePayload),
      })
    }

    let lastSavedSettingsData: Record<string, any> | null = null
    let lastSuccessfulSettingsStepIndex = -1

    try {
      for (const [index, step] of settingsSaveSteps.entries()) {
        lastSavedSettingsData = await step.run()
        lastSuccessfulSettingsStepIndex = index
      }

      const skillsPatch = normalizeSkillsEditableConfig({
        enabled: context.skillsEnabled,
        authMode: context.skillsAuthMode,
        oauthTokenTtlMinutes: normalizedSkillsOauthTokenTtlMinutes,
      })
      const skillsJson = await patchAdminSkills({
        enabled: skillsPatch.enabled,
        authMode: skillsPatch.authMode || undefined,
        oauthTokenTtlMinutes: normalizedSkillsOauthTokenTtlMinutes,
      })

      const serverSkills = NormalizeSkillsResponse(skillsJson)
      context.setSkillsEnabled(serverSkills.enabled)
      context.setSkillsAuthMode(serverSkills.authMode)
      context.setSkillsOauthTokenTtlMinutes(serverSkills.oauthTokenTtlMinutes)
      context.setSkillsApiKeyConfigured(skillsJson.apiKeyConfigured === true)
      context.setSkillsOauthConfigured(skillsJson.oauthConfigured === true)
      context.setLegacyMcpConfigured(skillsJson.legacyMcpConfigured === true)
      context.setSkillsAiAuthorizations(normalizeSkillsAiAuthorizations(skillsJson.aiAuthorizations))
      context.setBaselineSkillsConfig(structuredClone(serverSkills))
      void context.queryClient.invalidateQueries({ queryKey: adminQueryKeys.skills.settings() })
    } catch (error) {
      if (lastSavedSettingsData) {
        const unsavedKeys = settingsSaveSteps
          .slice(lastSuccessfulSettingsStepIndex + 1)
          .flatMap((step) => step.keys)

        context.syncPartiallySavedSettings(lastSavedSettingsData, formSnapshot, unsavedKeys)
        toast.error(
          error instanceof Error
            ? `${error.message} ${context.t('webSettings.toasts.partialSavedHint')}`
            : context.t('webSettings.toasts.partialSavedHint'),
        )
        return
      }

      throw error
    }

    await context.refreshSettingsData()
    toast.success(context.t('webSettings.toasts.saved'))
  } catch (error) {
    toast.error(error instanceof Error ? error.message : context.t('common.networkErrorRetry'))
  } finally {
    context.setSaving(false)
  }
}

export async function ConfirmWebSettingsImport(context: ImportContext) {
  const raw = context.importConfigInput.trim()
  if (!raw) {
    toast.error(context.t('webSettings.importDialog.empty'))
    return
  }
  const compact = raw.replace(/\s+/g, '')
  const parsed = parseExportPayload(compact)
  if (!parsed) {
    toast.error(context.t('webSettings.importDialog.invalid'))
    return
  }
  const partial = await uploadImportedImageSources(webPayloadToFormPatch(parsed.web))
  const ruleToolsPayload = extractRuleToolsImportFromWebPayload(parsed.web)
  context.setForm((prev) => ({
    ...prev,
    ...partial,
    pageLockPassword: '',
  }))
  if (ruleToolsPayload) {
    try {
      await importAdminRuleTools(ruleToolsPayload)
      await Promise.all([
        context.queryClient.invalidateQueries({ queryKey: adminQueryKeys.ruleTools.summary() }),
        context.queryClient.invalidateQueries({ queryKey: adminQueryKeys.ruleTools.config() }),
        context.queryClient.invalidateQueries({ queryKey: adminQueryKeys.ruleTools.rulesPreview() }),
        context.queryClient.invalidateQueries({ queryKey: ['admin', 'rule-tools', 'rules'] }),
        context.queryClient.invalidateQueries({ queryKey: ['admin', 'rule-tools', 'list'] }),
      ])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : context.t('common.networkErrorRetry'))
      return
    }
  }
  context.setImportConfigDialogOpen(false)
  toast.success(context.t('webSettings.importDialog.applied'))
}
