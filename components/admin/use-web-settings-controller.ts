'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAtom } from 'jotai'
import { useT } from 'next-i18next/client'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'

import {
  exportAdminSettings,
  fetchAdminDeviceSummaries,
  fetchAdminSettings,
  fetchAdminSkills,
} from '@/components/admin/admin-query-fetchers'
import { adminQueryKeys } from '@/components/admin/admin-query-keys'
import {
  importAdminRuleTools,
  patchAdminSettings,
  patchAdminSkills,
} from '@/components/admin/admin-query-mutations'
import {
  webSettingsBaselineFormAtom,
  webSettingsBaselineSkillsConfigAtom,
  webSettingsCropDialogOpenAtom,
  webSettingsCropSourceUrlAtom,
  webSettingsCropTargetAtom,
  webSettingsFormAtom,
  webSettingsImportConfigDialogOpenAtom,
  webSettingsImportConfigInputAtom,
  webSettingsInspirationDevicesAtom,
  webSettingsLegacyMcpConfiguredAtom,
  webSettingsLegacyMcpGeneratedApiKeyAtom,
  webSettingsLoadingAtom,
  webSettingsPublicOriginAtom,
  webSettingsRedisCacheServerlessForcedAtom,
  webSettingsSavingAtom,
  webSettingsSkillsAiAuthorizationsAtom,
  webSettingsSkillsApiKeyConfiguredAtom,
  webSettingsSkillsAuthModeAtom,
  webSettingsSkillsEnabledAtom,
  webSettingsSkillsGeneratedApiKeyAtom,
  webSettingsSkillsOauthConfiguredAtom,
  webSettingsSkillsOauthTokenTtlMinutesAtom,
  webSettingsSkillsRevokingAiClientIdAtom,
  webSettingsSkillsSavingAtom,
} from '@/components/admin/web-settings-store'
import type { SiteConfig, SkillsEditableConfig } from '@/components/admin/web-settings-types'
import {
  extractRuleToolsImportFromWebPayload,
  normalizeSkillsAiAuthorizations,
  normalizeSkillsEditableConfig,
  parseExportPayload,
  publicPageFontOptionsFromApi,
  themeCustomSurfaceFromApi,
  webPayloadToFormPatch,
} from '@/components/admin/web-settings-utils'
import {
  REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
  REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS,
} from '@/lib/activity-api-constants'
import { normalizeActivityUpdateMode } from '@/lib/activity-update-mode'
import {
  normalizeAdminThemeColor,
  writeAdminBackgroundColor,
  writeAdminThemeColor,
} from '@/lib/admin-theme-color'
import { isRemoteAvatarUrl } from '@/lib/avatar-url'
import { DEFAULT_PAGE_TITLE } from '@/lib/default-page-title'
import { normalizeHitokotoCategories, normalizeHitokotoEncode } from '@/lib/hitokoto'
import { normalizeProfileOnlineAccentColor } from '@/lib/profile-online-accent-color'
import { isAllowedSlotMinutes, resolveSchedulePeriodTemplate, type ScheduleCourse } from '@/lib/schedule-courses'
import { resolveScheduleGridByWeekday } from '@/lib/schedule-grid-by-weekday'
import {
  SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
  SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
  SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
} from '@/lib/site-config-constants'
import { normalizeSiteIconUrl } from '@/lib/site-icon'
import { normalizeTimezone } from '@/lib/timezone'

export function useWebSettingsController() {
  const { t } = useT('admin')
  const queryClient = useQueryClient()
  const [loading, setLoading] = useAtom(webSettingsLoadingAtom)
  const [saving, setSaving] = useAtom(webSettingsSavingAtom)
  const [, setSkillsSaving] = useAtom(webSettingsSkillsSavingAtom)
  const [skillsEnabled, setSkillsEnabled] = useAtom(webSettingsSkillsEnabledAtom)
  const [skillsAuthMode, setSkillsAuthMode] = useAtom(webSettingsSkillsAuthModeAtom)
  const [, setSkillsApiKeyConfigured] = useAtom(webSettingsSkillsApiKeyConfiguredAtom)
  const [, setSkillsOauthConfigured] = useAtom(webSettingsSkillsOauthConfiguredAtom)
  const [skillsOauthTokenTtlMinutes, setSkillsOauthTokenTtlMinutes] = useAtom(
    webSettingsSkillsOauthTokenTtlMinutesAtom,
  )
  const [, setSkillsAiAuthorizations] = useAtom(webSettingsSkillsAiAuthorizationsAtom)
  const [, setSkillsRevokingAiClientId] = useAtom(webSettingsSkillsRevokingAiClientIdAtom)
  const [, setSkillsGeneratedApiKey] = useAtom(webSettingsSkillsGeneratedApiKeyAtom)
  const [, setLegacyMcpConfigured] = useAtom(webSettingsLegacyMcpConfiguredAtom)
  const [, setLegacyMcpGeneratedApiKey] = useAtom(webSettingsLegacyMcpGeneratedApiKeyAtom)
  const [, setPublicOrigin] = useAtom(webSettingsPublicOriginAtom)
  const [importConfigDialogOpen, setImportConfigDialogOpen] = useAtom(
    webSettingsImportConfigDialogOpenAtom,
  )
  const [importConfigInput, setImportConfigInput] = useAtom(webSettingsImportConfigInputAtom)
  const [cropSourceUrl, setCropSourceUrl] = useAtom(webSettingsCropSourceUrlAtom)
  const [cropDialogOpen, setCropDialogOpen] = useAtom(webSettingsCropDialogOpenAtom)
  const [cropTarget, setCropTarget] = useAtom(webSettingsCropTargetAtom)
  const [, setInspirationDevices] = useAtom(webSettingsInspirationDevicesAtom)
  const [baselineForm, setBaselineForm] = useAtom(webSettingsBaselineFormAtom)
  const [baselineSkillsConfig, setBaselineSkillsConfig] = useAtom(
    webSettingsBaselineSkillsConfigAtom,
  )
  const [, setRedisCacheServerlessForced] = useAtom(webSettingsRedisCacheServerlessForcedAtom)
  const [form, setForm] = useAtom(webSettingsFormAtom)
  const baselineAppearanceRef = useRef({
    adminThemeColor: '',
    adminBackgroundColor: '',
  })
  const webSettingsDirtyRef = useRef(false)

  const inspirationDevicesQuery = useQuery({
    queryKey: adminQueryKeys.devices.list({ limit: 200 }),
    queryFn: () => fetchAdminDeviceSummaries({ limit: 200 }),
  })

  const skillsQuery = useQuery({
    queryKey: adminQueryKeys.skills.settings(),
    queryFn: fetchAdminSkills,
  })

  const applySkillsConfigData = useCallback((
    skillsData: Awaited<ReturnType<typeof fetchAdminSkills>>,
    options?: {
      updateBaseline?: boolean
      preserveGeneratedKeys?: boolean
    },
  ) => {
    const loadedSkills = normalizeSkillsEditableConfig({
      enabled: skillsData.enabled === true,
      authMode:
        skillsData.authMode === 'oauth' || skillsData.authMode === 'apikey'
          ? skillsData.authMode
          : '',
      oauthTokenTtlMinutes: Number(skillsData.oauthTokenTtlMinutes),
    })
    setSkillsEnabled(loadedSkills.enabled)
    setSkillsAuthMode(loadedSkills.authMode)
    setSkillsApiKeyConfigured(skillsData.apiKeyConfigured === true)
    setSkillsOauthConfigured(skillsData.oauthConfigured === true)
    setSkillsOauthTokenTtlMinutes(loadedSkills.oauthTokenTtlMinutes)
    setSkillsAiAuthorizations(normalizeSkillsAiAuthorizations(skillsData.aiAuthorizations))
    setLegacyMcpConfigured(skillsData.legacyMcpConfigured === true)
    if (!options?.preserveGeneratedKeys) {
      setSkillsGeneratedApiKey(
        typeof skillsData.generatedApiKey === 'string' ? skillsData.generatedApiKey : '',
      )
      setLegacyMcpGeneratedApiKey(
        typeof skillsData.generatedLegacyMcpApiKey === 'string'
          ? skillsData.generatedLegacyMcpApiKey
          : '',
      )
    }
    if (options?.updateBaseline) {
      setBaselineSkillsConfig(structuredClone(loadedSkills))
    }
  }, [
    setBaselineSkillsConfig,
    setLegacyMcpConfigured,
    setLegacyMcpGeneratedApiKey,
    setSkillsAiAuthorizations,
    setSkillsApiKeyConfigured,
    setSkillsAuthMode,
    setSkillsEnabled,
    setSkillsGeneratedApiKey,
    setSkillsOauthConfigured,
    setSkillsOauthTokenTtlMinutes,
  ])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPublicOrigin(window.location.origin)
    }
  }, [setPublicOrigin])

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchAdminSettings()

        if (data) {
          const loaded: SiteConfig = {
            adminThemeColor:
              typeof data.adminThemeColor === 'string'
                ? (normalizeAdminThemeColor(data.adminThemeColor) ?? '')
                : '',
            adminBackgroundColor:
              typeof data.adminBackgroundColor === 'string'
                ? (normalizeAdminThemeColor(data.adminBackgroundColor) ?? '')
                : '',
            pageTitle: data.pageTitle ?? DEFAULT_PAGE_TITLE,
            siteIconUrl:
              typeof data.siteIconUrl === 'string'
                ? (normalizeSiteIconUrl(data.siteIconUrl) ?? '')
                : '',
            userName: data.userName ?? '',
            userBio: data.userBio ?? '',
            avatarUrl: data.avatarUrl ?? '',
            avatarFetchByServerEnabled:
              isRemoteAvatarUrl(data.avatarUrl) && data.avatarFetchByServerEnabled === true,
            profileOnlineAccentColor:
              normalizeProfileOnlineAccentColor(
                typeof data.profileOnlineAccentColor === 'string'
                  ? data.profileOnlineAccentColor
                  : '',
              ) ?? '',
            profileOnlinePulseEnabled: data.profileOnlinePulseEnabled !== false,
            userNote: data.userNote ?? '',
            userNoteHitokotoEnabled: Boolean(data.userNoteHitokotoEnabled),
            userNoteTypewriterEnabled: Boolean(data.userNoteTypewriterEnabled),
            userNoteSignatureFontEnabled: Boolean(data.userNoteSignatureFontEnabled),
            userNoteSignatureFontFamily:
              typeof data.userNoteSignatureFontFamily === 'string'
                ? data.userNoteSignatureFontFamily.trim()
                : '',
            pageLoadingEnabled: data.pageLoadingEnabled !== false,
            searchEngineIndexingEnabled: data.searchEngineIndexingEnabled !== false,
            userNoteHitokotoCategories: normalizeHitokotoCategories(
              data.userNoteHitokotoCategories,
            ),
            userNoteHitokotoEncode: normalizeHitokotoEncode(data.userNoteHitokotoEncode),
            userNoteHitokotoFallbackToNote: Boolean(data.userNoteHitokotoFallbackToNote),
            themePreset: data.themePreset ?? 'basic',
            themeCustomSurface: themeCustomSurfaceFromApi(data.themeCustomSurface),
            publicFontOptionsEnabled: data.publicFontOptionsEnabled === true,
            publicFontOptions: publicPageFontOptionsFromApi(data.publicFontOptions),
            customCss: data.customCss ?? '',
            mcpThemeToolsEnabled: data.mcpThemeToolsEnabled === true,
            openApiDocsEnabled: data.openApiDocsEnabled !== false,
            aiToolMode:
              String(data.aiToolMode ?? '').trim().toLowerCase() === 'mcp'
                ? 'mcp'
                : 'skills',
            historyWindowMinutes: Number(
              data.historyWindowMinutes ?? SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
            ),
            processStaleSeconds: Number(
              data.processStaleSeconds ?? SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
            ),
            pageLockEnabled: Boolean(data.pageLockEnabled),
            pageLockPassword: '',
            hcaptchaEnabled: Boolean(data.hcaptchaEnabled),
            hcaptchaSiteKey: data.hcaptchaSiteKey ?? '',
            hcaptchaSecretKey: '',
            currentlyText:
              typeof data.currentlyText === 'string' && data.currentlyText.trim().length > 0
                ? data.currentlyText
                : t('webSettingsBasic.currentlyTextDefault'),
            earlierText:
              typeof data.earlierText === 'string' && data.earlierText.trim().length > 0
                ? data.earlierText
                : t('webSettingsBasic.earlierTextDefault'),
            adminText: data.adminText ?? 'admin',
            autoAcceptNewDevices: Boolean(data.autoAcceptNewDevices),
            inspirationDeviceRestrictionEnabled: Array.isArray(
              data.inspirationAllowedDeviceHashes,
            ),
            inspirationAllowedDeviceHashes: Array.isArray(data.inspirationAllowedDeviceHashes)
              ? (data.inspirationAllowedDeviceHashes as unknown[])
                  .map((item) => String(item ?? '').trim())
                  .filter((item) => item.length > 0)
              : [],
            scheduleSlotMinutes: isAllowedSlotMinutes(Number(data.scheduleSlotMinutes))
              ? Number(data.scheduleSlotMinutes)
              : SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
            schedulePeriodTemplate: resolveSchedulePeriodTemplate(data.schedulePeriodTemplate),
            scheduleGridByWeekday: resolveScheduleGridByWeekday(
              data.scheduleGridByWeekday,
              isAllowedSlotMinutes(Number(data.scheduleSlotMinutes))
                ? Number(data.scheduleSlotMinutes)
                : SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
            ),
            scheduleCourses: Array.isArray(data.scheduleCourses)
              ? (data.scheduleCourses as ScheduleCourse[])
              : [],
            scheduleIcs: typeof data.scheduleIcs === 'string' ? data.scheduleIcs : '',
            scheduleInClassOnHome: Boolean(data.scheduleInClassOnHome),
            scheduleHomeShowLocation: Boolean(data.scheduleHomeShowLocation),
            scheduleHomeShowTeacher: Boolean(data.scheduleHomeShowTeacher),
            scheduleHomeShowNextUpcoming: Boolean(data.scheduleHomeShowNextUpcoming),
            scheduleHomeAfterClassesLabel:
              typeof data.scheduleHomeAfterClassesLabel === 'string' &&
              data.scheduleHomeAfterClassesLabel.trim().length > 0
                ? data.scheduleHomeAfterClassesLabel.trim().slice(
                    0,
                    SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
                  )
                : SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
            globalMouseTiltEnabled: data.globalMouseTiltEnabled === true,
            globalMouseTiltGyroEnabled: data.globalMouseTiltGyroEnabled === true,
            smoothScrollEnabled: data.smoothScrollEnabled === true,
            hideActivityMedia: data.hideActivityMedia === true,
            hideInspirationOnHome: data.hideInspirationOnHome === true,
            activityRejectLockappSleep: data.activityRejectLockappSleep === true,
            displayTimezone: normalizeTimezone(data.displayTimezone),
            forceDisplayTimezone: data.forceDisplayTimezone === true,
            activityUpdateMode: normalizeActivityUpdateMode(data.activityUpdateMode),
            useNoSqlAsCacheRedis:
              data.useNoSqlAsCacheRedis === undefined
                ? true
                : data.useNoSqlAsCacheRedis === true,
            redisCacheTtlSeconds: Number(
              data.redisCacheTtlSeconds ?? REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
            ),
            steamEnabled: Boolean(data.steamEnabled),
            steamId: String(data.steamId ?? ''),
            steamApiKey: '',
          }
          setRedisCacheServerlessForced(data.redisCacheServerlessForced === true)
          setForm(loaded)
          setBaselineForm(structuredClone(loaded))
        }
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [
    setBaselineForm,
    setForm,
    setLoading,
    setRedisCacheServerlessForced,
    t,
  ])

  useEffect(() => {
    baselineAppearanceRef.current = {
      adminThemeColor: baselineForm?.adminThemeColor ?? '',
      adminBackgroundColor: baselineForm?.adminBackgroundColor ?? '',
    }
  }, [baselineForm])

  useEffect(() => {
    if (!baselineForm) return
    writeAdminThemeColor(form.adminThemeColor || null)
    writeAdminBackgroundColor(form.adminBackgroundColor || null)
  }, [
    baselineForm,
    form.adminBackgroundColor,
    form.adminThemeColor,
  ])

  useEffect(() => {
    return () => {
      if (!webSettingsDirtyRef.current) return
      writeAdminThemeColor(baselineAppearanceRef.current.adminThemeColor || null)
      writeAdminBackgroundColor(baselineAppearanceRef.current.adminBackgroundColor || null)
    }
  }, [])

  useEffect(() => {
    if (!skillsQuery.data) return
    applySkillsConfigData(skillsQuery.data, {
      updateBaseline: true,
      preserveGeneratedKeys: true,
    })
  }, [applySkillsConfigData, skillsQuery.data])

  useEffect(() => {
    if (!skillsQuery.error) return
    toast.error(
      skillsQuery.error instanceof Error
        ? skillsQuery.error.message
        : t('query.loadSkillsFailed', { status: 'unknown' }),
    )
  }, [skillsQuery.error, t])

  useEffect(() => {
    setInspirationDevices(inspirationDevicesQuery.data ?? [])
  }, [inspirationDevicesQuery.data, setInspirationDevices])

  const saveSkillsConfig = async (
    patch: {
      enabled?: boolean
      authMode?: 'oauth' | 'apikey'
      rotateApiKey?: boolean
      rotateLegacyMcpKey?: boolean
      revokeOauthForAiClientId?: string
      oauthTokenTtlMinutes?: number
    },
    options?: { successMessage?: string | null },
  ) => {
    setSkillsSaving(true)
    try {
      const json = await patchAdminSkills(patch)
      setSkillsEnabled(json.enabled === true)
      setSkillsAuthMode(
        json.authMode === 'oauth' || json.authMode === 'apikey'
          ? json.authMode
          : '',
      )
      setSkillsApiKeyConfigured(json.apiKeyConfigured === true)
      setSkillsOauthConfigured(json.oauthConfigured === true)
      setSkillsOauthTokenTtlMinutes(
        Number.isFinite(Number(json.oauthTokenTtlMinutes))
          ? Number(json.oauthTokenTtlMinutes)
          : 60,
      )
      setSkillsAiAuthorizations(normalizeSkillsAiAuthorizations(json.aiAuthorizations))
      setSkillsGeneratedApiKey(
        typeof json.generatedApiKey === 'string' ? json.generatedApiKey : '',
      )
      setLegacyMcpConfigured(json.legacyMcpConfigured === true)
      setLegacyMcpGeneratedApiKey(
        typeof json.generatedLegacyMcpApiKey === 'string'
          ? json.generatedLegacyMcpApiKey
          : '',
      )
      void queryClient.invalidateQueries({ queryKey: adminQueryKeys.skills.settings() })
      if (options?.successMessage !== null) {
        toast.success(options?.successMessage || t('webSettingsSkills.toasts.saved'))
      }
    } catch (error) {
      console.error(error)
      toast.error(t('mutation.saveFailed'))
    } finally {
      setSkillsSaving(false)
    }
  }

  const revokeSkillsOauthByAiClientId = async (aiClientId: string) => {
    const normalized = String(aiClientId ?? '').trim().toLowerCase()
    if (!normalized) return
    setSkillsRevokingAiClientId(normalized)
    try {
      await saveSkillsConfig({ revokeOauthForAiClientId: normalized }, { successMessage: null })
      toast.success(t('webSettingsSkills.toasts.revoked', { value: normalized }))
    } finally {
      setSkillsRevokingAiClientId('')
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const normalizeStringList = (items: string[]) => {
        const output: string[] = []
        const seen = new Set<string>()
        for (const raw of items) {
          const value = String(raw ?? '').trim()
          if (!value) continue
          const key = value.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)
          output.push(value)
        }
        return output
      }

      const poTrim = form.profileOnlineAccentColor.trim()
      if (poTrim && !normalizeProfileOnlineAccentColor(poTrim)) {
        toast.error(t('webSettingsActivity.profileOnlineAccentInvalid'))
        setSaving(false)
        return
      }

      const adminThemeColor = normalizeAdminThemeColor(form.adminThemeColor)
      const adminBackgroundColor = normalizeAdminThemeColor(form.adminBackgroundColor)

      const {
        adminThemeColor: _formAdminThemeColor,
        adminBackgroundColor: _formAdminBackgroundColor,
        inspirationDeviceRestrictionEnabled,
        inspirationAllowedDeviceHashes: inspirationHashSelection,
        hcaptchaSecretKey: hcaptchaSecretKeyForm,
        steamApiKey: steamApiKeyForm,
        ...formRest
      } = form

      const normalizedRedisTtl = Number.isFinite(formRest.redisCacheTtlSeconds)
        ? Math.min(
            REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS,
            Math.max(1, Math.round(formRest.redisCacheTtlSeconds)),
          )
        : REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS

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

      const data = await patchAdminSettings({
          ...formRest,
          adminThemeColor,
          adminBackgroundColor,
          avatarFetchByServerEnabled:
            isRemoteAvatarUrl(formRest.avatarUrl) && formRest.avatarFetchByServerEnabled === true,
          mcpThemeToolsEnabled: form.mcpThemeToolsEnabled,
          redisCacheTtlSeconds: normalizedRedisTtl,
          profileOnlineAccentColor: normalizeProfileOnlineAccentColor(poTrim || '') ?? null,
          inspirationAllowedDeviceHashes: inspirationDeviceRestrictionEnabled
            ? normalizeStringList(inspirationHashSelection)
            : null,
          ...hcaptchaPatch,
          ...steamPatch,
      })

      const skillsPatch = normalizeSkillsEditableConfig({
        enabled: skillsEnabled,
        authMode: skillsAuthMode,
        oauthTokenTtlMinutes: skillsOauthTokenTtlMinutes,
      })
      const skillsJson = await patchAdminSkills({
        enabled: skillsPatch.enabled,
        authMode: skillsPatch.authMode || undefined,
        oauthTokenTtlMinutes: skillsPatch.oauthTokenTtlMinutes,
      })

      const serverSkills = normalizeSkillsEditableConfig({
        enabled: skillsJson.enabled === true,
        authMode:
          skillsJson.authMode === 'oauth' || skillsJson.authMode === 'apikey'
            ? skillsJson.authMode
            : '',
        oauthTokenTtlMinutes: Number(skillsJson.oauthTokenTtlMinutes),
      })
      setSkillsEnabled(serverSkills.enabled)
      setSkillsAuthMode(serverSkills.authMode)
      setSkillsOauthTokenTtlMinutes(serverSkills.oauthTokenTtlMinutes)
      setSkillsApiKeyConfigured(skillsJson.apiKeyConfigured === true)
      setSkillsOauthConfigured(skillsJson.oauthConfigured === true)
      setLegacyMcpConfigured(skillsJson.legacyMcpConfigured === true)
      setSkillsAiAuthorizations(normalizeSkillsAiAuthorizations(skillsJson.aiAuthorizations))
      setBaselineSkillsConfig(structuredClone(serverSkills))
      void queryClient.invalidateQueries({ queryKey: adminQueryKeys.skills.settings() })

      toast.success(t('webSettings.toasts.saved'))
      setRedisCacheServerlessForced(data?.redisCacheServerlessForced === true)
      const nextForm = {
        ...form,
        ...(typeof data.adminThemeColor === 'string' || data.adminThemeColor === null
          ? {
              adminThemeColor:
                typeof data.adminThemeColor === 'string'
                  ? (normalizeAdminThemeColor(data.adminThemeColor) ?? '')
                  : '',
            }
          : {}),
        ...(typeof data.adminBackgroundColor === 'string' || data.adminBackgroundColor === null
          ? {
              adminBackgroundColor:
                typeof data.adminBackgroundColor === 'string'
                  ? (normalizeAdminThemeColor(data.adminBackgroundColor) ?? '')
                  : '',
            }
          : {}),
        ...(typeof data.useNoSqlAsCacheRedis === 'boolean'
          ? { useNoSqlAsCacheRedis: data.useNoSqlAsCacheRedis === true }
          : {}),
        ...(typeof data.siteIconUrl === 'string' || data.siteIconUrl === null
          ? {
              siteIconUrl:
                typeof data.siteIconUrl === 'string'
                  ? (normalizeSiteIconUrl(data.siteIconUrl) ?? '')
                  : '',
            }
          : {}),
        ...(typeof data.avatarFetchByServerEnabled === 'boolean'
          ? {
              avatarFetchByServerEnabled:
                isRemoteAvatarUrl(data.avatarUrl ?? form.avatarUrl) &&
                data.avatarFetchByServerEnabled === true,
            }
          : {}),
      }
      setForm(nextForm)
      setBaselineForm(structuredClone(nextForm))
    } catch {
      toast.error(t('common.networkErrorRetry'))
    } finally {
      setSaving(false)
    }
  }

  const revertUnsavedWebSettings = () => {
    if (!baselineForm) return
    setForm(structuredClone(baselineForm))
    if (baselineSkillsConfig) {
      setSkillsEnabled(baselineSkillsConfig.enabled)
      setSkillsAuthMode(baselineSkillsConfig.authMode)
      setSkillsOauthTokenTtlMinutes(baselineSkillsConfig.oauthTokenTtlMinutes)
    }
  }

  const copyExportConfig = async () => {
    try {
      const encoded = await exportAdminSettings()
      await navigator.clipboard.writeText(encoded)
      toast.success(t('webSettings.importExport.copied'))
    } catch {
      toast.error(t('common.copyFailedBrowserPermission'))
    }
  }

  const applyImportConfig = async () => {
    let raw = ''
    try {
      raw = (await navigator.clipboard.readText()).trim()
    } catch {
      raw = ''
    }
    setImportConfigInput(raw)
    setImportConfigDialogOpen(true)
  }

  const confirmImportConfig = async () => {
    const raw = importConfigInput.trim()
    if (!raw) {
      toast.error(t('webSettings.importDialog.empty'))
      return
    }
    const compact = raw.replace(/\s+/g, '')
    const parsed = parseExportPayload(compact)
    if (!parsed) {
      toast.error(t('webSettings.importDialog.invalid'))
      return
    }
    const partial = webPayloadToFormPatch(parsed.web)
    const ruleToolsPayload = extractRuleToolsImportFromWebPayload(parsed.web)
    setForm((prev) => ({
      ...prev,
      ...partial,
      pageLockPassword: '',
    }))
    if (ruleToolsPayload) {
      try {
        await importAdminRuleTools(ruleToolsPayload)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: adminQueryKeys.ruleTools.summary() }),
          queryClient.invalidateQueries({ queryKey: adminQueryKeys.ruleTools.config() }),
          queryClient.invalidateQueries({ queryKey: adminQueryKeys.ruleTools.rulesPreview() }),
          queryClient.invalidateQueries({ queryKey: ['admin', 'rule-tools', 'rules'] }),
          queryClient.invalidateQueries({ queryKey: ['admin', 'rule-tools', 'list'] }),
        ])
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t('common.networkErrorRetry'),
        )
        return
      }
    }
    setImportConfigDialogOpen(false)
    toast.success(t('webSettings.importDialog.applied'))
  }

  const copyPlainText = async (value: string, successText: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(successText)
    } catch {
      toast.error(t('common.copyFailedBrowserPermission'))
    }
  }

  const webSettingsDirty = useMemo(() => {
    if (!baselineForm || !baselineSkillsConfig) return false
    try {
      const formDirty = JSON.stringify(form) !== JSON.stringify(baselineForm)
      if (formDirty) return true
      const currentSkills = normalizeSkillsEditableConfig({
        enabled: skillsEnabled,
        authMode: skillsAuthMode,
        oauthTokenTtlMinutes: skillsOauthTokenTtlMinutes,
      })
      return JSON.stringify(currentSkills) !== JSON.stringify(baselineSkillsConfig)
    } catch {
      return true
    }
  }, [
    form,
    baselineForm,
    baselineSkillsConfig,
    skillsEnabled,
    skillsAuthMode,
    skillsOauthTokenTtlMinutes,
  ])

  useEffect(() => {
    webSettingsDirtyRef.current = webSettingsDirty
  }, [webSettingsDirty])

  return {
    baselineForm,
    confirmImportConfig,
    copyExportConfig,
    copyPlainText,
    cropDialogOpen,
    cropSourceUrl,
    cropTarget,
    form,
    importConfigDialogOpen,
    importConfigInput,
    loading,
    revertUnsavedWebSettings,
    save,
    saveSkillsConfig,
    saving,
    setCropDialogOpen,
    setCropSourceUrl,
    setCropTarget,
    setForm,
    setImportConfigDialogOpen,
    setImportConfigInput,
    applyImportConfig,
    revokeSkillsOauthByAiClientId,
    webSettingsDirty,
  }
}
