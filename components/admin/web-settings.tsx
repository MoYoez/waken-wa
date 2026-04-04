'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { ImageCropDialog } from '@/components/admin/image-crop-dialog'
import { UnsavedChangesBar } from '@/components/admin/unsaved-changes-bar'
import { WebSettingsActivityPanel } from '@/components/admin/web-settings-activity-panel'
import { WebSettingsBasicPanel } from '@/components/admin/web-settings-basic-panel'
import { WebSettingsCustomSurface } from '@/components/admin/web-settings-custom-surface'
import { WebSettingsHitokotoPanel } from '@/components/admin/web-settings-hitokoto-panel'
import { WebSettingsOpenApiPanel } from '@/components/admin/web-settings-openapi-panel'
import { WebSettingsRuleTools } from '@/components/admin/web-settings-rule-tools'
import { WebSettingsSecurityPanel } from '@/components/admin/web-settings-security-panel'
import { WebSettingsSkillsPanel } from '@/components/admin/web-settings-skills-panel'
import type {
  SiteConfig,
  SkillsAiAuthorizationItem,
  SkillsEditableConfig,
} from '@/components/admin/web-settings-types'
import {
  emptyThemeCustomSurfaceForm,
  normalizeSkillsAiAuthorizations,
  normalizeSkillsEditableConfig,
  parseExportPayload,
  themeCustomSurfaceFromApi,
  webPayloadToFormPatch,
} from '@/components/admin/web-settings-utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
  REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS,
} from '@/lib/activity-api-constants'
import {
  DEFAULT_ACTIVITY_UPDATE_MODE,
  normalizeActivityUpdateMode,
} from '@/lib/activity-update-mode'
import { DEFAULT_PAGE_TITLE } from '@/lib/default-page-title'
import {
  normalizeHitokotoCategories,
  normalizeHitokotoEncode,
  type UserNoteHitokotoEncode,
} from '@/lib/hitokoto'
import { normalizeProfileOnlineAccentColor } from '@/lib/profile-online-accent-color'
import {
  isAllowedSlotMinutes,
  resolveSchedulePeriodTemplate,
  type ScheduleCourse,
  type SchedulePeriodTemplateItem,
} from '@/lib/schedule-courses'
import {
  resolveScheduleGridByWeekday,
  type ScheduleDayGrid,
} from '@/lib/schedule-grid-by-weekday'
import {
  clampSiteConfigHistoryWindowMinutes,
  clampSiteConfigProcessStaleSeconds,
  SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
  SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
  SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
} from '@/lib/site-config-constants'
import { DEFAULT_TIMEZONE, normalizeTimezone } from '@/lib/timezone'

export function WebSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [skillsSaving, setSkillsSaving] = useState(false)
  const [skillsEnabled, setSkillsEnabled] = useState(false)
  const [skillsAuthMode, setSkillsAuthMode] = useState<'oauth' | 'apikey' | ''>('')
  const [skillsApiKeyConfigured, setSkillsApiKeyConfigured] = useState(false)
  const [skillsOauthConfigured, setSkillsOauthConfigured] = useState(false)
  const [skillsOauthTokenTtlMinutes, setSkillsOauthTokenTtlMinutes] = useState(60)
  const [skillsAiAuthorizations, setSkillsAiAuthorizations] = useState<SkillsAiAuthorizationItem[]>([])
  const [skillsRevokingAiClientId, setSkillsRevokingAiClientId] = useState('')
  const [skillsGeneratedApiKey, setSkillsGeneratedApiKey] = useState('')
  const [legacyMcpConfigured, setLegacyMcpConfigured] = useState(false)
  const [legacyMcpGeneratedApiKey, setLegacyMcpGeneratedApiKey] = useState('')
  const [publicOrigin, setPublicOrigin] = useState('')
  const [importConfigDialogOpen, setImportConfigDialogOpen] = useState(false)
  const [importConfigInput, setImportConfigInput] = useState('')
  const [historyApps, setHistoryApps] = useState<string[]>([])
  const [historyPlaySources, setHistoryPlaySources] = useState<string[]>([])
  // 裁剪弹窗状态
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [inspirationDevices, setInspirationDevices] = useState<
    Array<{ id: number; displayName: string; generatedHashKey: string; status: string }>
  >([])

  const [baselineForm, setBaselineForm] = useState<SiteConfig | null>(null)
  const [baselineSkillsConfig, setBaselineSkillsConfig] = useState<SkillsEditableConfig | null>(null)
  /** Vercel + Redis: serverless forces activity-feed Redis cache on; switch is read-only. */
  const [redisCacheServerlessForced, setRedisCacheServerlessForced] = useState(false)

  const [form, setForm] = useState<SiteConfig>({
    pageTitle: DEFAULT_PAGE_TITLE,
    userName: '',
    userBio: '',
    avatarUrl: '',
    profileOnlineAccentColor: '',
    profileOnlinePulseEnabled: true,
    userNote: '',
    userNoteHitokotoEnabled: false,
    pageLoadingEnabled: true,
    searchEngineIndexingEnabled: true,
    userNoteHitokotoCategories: [],
    userNoteHitokotoEncode: 'json',
    userNoteHitokotoFallbackToNote: false,
    themePreset: 'basic',
    themeCustomSurface: emptyThemeCustomSurfaceForm(),
    customCss: '',
    mcpThemeToolsEnabled: false,
    openApiDocsEnabled: true,
    aiToolMode: 'skills',
    historyWindowMinutes: SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
    processStaleSeconds: SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
    appMessageRules: [],
    appMessageRulesShowProcessName: true,
    appFilterMode: 'blacklist',
    appBlacklist: [],
    appWhitelist: [],
    appNameOnlyList: [],
    captureReportedAppsEnabled: true,
    mediaPlaySourceBlocklist: [],
    pageLockEnabled: false,
    pageLockPassword: '',
    hcaptchaEnabled: false,
    hcaptchaSiteKey: '',
    hcaptchaSecretKey: '',
    currentlyText: '当前状态',
    earlierText: '最近的随想录',
    adminText: 'admin',
    autoAcceptNewDevices: false,
    inspirationDeviceRestrictionEnabled: false,
    inspirationAllowedDeviceHashes: [],
    scheduleSlotMinutes: SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
    schedulePeriodTemplate: resolveSchedulePeriodTemplate(null),
    scheduleGridByWeekday: resolveScheduleGridByWeekday(null, SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES),
    scheduleCourses: [],
    scheduleIcs: '',
    scheduleInClassOnHome: false,
    scheduleHomeShowLocation: false,
    scheduleHomeShowTeacher: false,
    scheduleHomeShowNextUpcoming: false,
    scheduleHomeAfterClassesLabel: SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
    globalMouseTiltEnabled: false,
    globalMouseTiltGyroEnabled: false,
    hideActivityMedia: false,
    activityRejectLockappSleep: false,
    displayTimezone: DEFAULT_TIMEZONE,
    activityUpdateMode: DEFAULT_ACTIVITY_UPDATE_MODE,
    useNoSqlAsCacheRedis: true,
    redisCacheTtlSeconds: REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
    steamEnabled: false,
    steamId: '',
    steamApiKey: '',
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPublicOrigin(window.location.origin)
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, skillsRes] = await Promise.all([
          fetch('/api/admin/settings'),
          fetch('/api/admin/skills'),
        ])
        const [data, skillsData] = await Promise.all([
          settingsRes.json().catch(() => null),
          skillsRes.json().catch(() => null),
        ])

        if (skillsData?.success && skillsData?.data) {
          const loadedSkills = normalizeSkillsEditableConfig({
            enabled: skillsData.data.enabled === true,
            authMode:
              skillsData.data.authMode === 'oauth' || skillsData.data.authMode === 'apikey'
                ? skillsData.data.authMode
                : '',
            oauthTokenTtlMinutes: skillsData.data.oauthTokenTtlMinutes,
          })
          setSkillsEnabled(loadedSkills.enabled)
          setSkillsAuthMode(loadedSkills.authMode)
          setSkillsApiKeyConfigured(skillsData.data.apiKeyConfigured === true)
          setSkillsOauthConfigured(skillsData.data.oauthConfigured === true)
          setSkillsOauthTokenTtlMinutes(loadedSkills.oauthTokenTtlMinutes)
          setBaselineSkillsConfig(structuredClone(loadedSkills))
          setSkillsAiAuthorizations(normalizeSkillsAiAuthorizations(skillsData.data.aiAuthorizations))
          setSkillsGeneratedApiKey('')
          setLegacyMcpConfigured(skillsData.data.legacyMcpConfigured === true)
          setLegacyMcpGeneratedApiKey('')
        } else if (skillsData !== null) {
          toast.error('加载 Skills 配置失败')
        }

        if (data?.success && data?.data) {
          const rules = Array.isArray(data.data.appMessageRules) ? data.data.appMessageRules : []
          const blacklist = Array.isArray(data.data.appBlacklist)
            ? data.data.appBlacklist
                .map((item: unknown) => String(item ?? '').trim())
                .filter((item: string) => item.length > 0)
            : []
          const whitelist = Array.isArray(data.data.appWhitelist)
            ? data.data.appWhitelist
                .map((item: unknown) => String(item ?? '').trim())
                .filter((item: string) => item.length > 0)
            : []
          const filterModeRaw = String(data.data.appFilterMode ?? 'blacklist').toLowerCase()
          const appFilterMode = filterModeRaw === 'whitelist' ? 'whitelist' : 'blacklist'
          const nameOnlyList = Array.isArray(data.data.appNameOnlyList)
            ? data.data.appNameOnlyList
                .map((item: unknown) => String(item ?? '').trim())
                .filter((item: string) => item.length > 0)
            : []
          const loaded: SiteConfig = {
            pageTitle: data.data.pageTitle ?? DEFAULT_PAGE_TITLE,
            userName: data.data.userName ?? '',
            userBio: data.data.userBio ?? '',
            avatarUrl: data.data.avatarUrl ?? '',
            profileOnlineAccentColor:
              normalizeProfileOnlineAccentColor(
                typeof data.data.profileOnlineAccentColor === 'string'
                  ? data.data.profileOnlineAccentColor
                  : '',
              ) ?? '',
            profileOnlinePulseEnabled: data.data.profileOnlinePulseEnabled !== false,
            userNote: data.data.userNote ?? '',
            userNoteHitokotoEnabled: Boolean(data.data.userNoteHitokotoEnabled),
            pageLoadingEnabled: data.data.pageLoadingEnabled !== false,
            searchEngineIndexingEnabled: data.data.searchEngineIndexingEnabled !== false,
            userNoteHitokotoCategories: normalizeHitokotoCategories(
              data.data.userNoteHitokotoCategories,
            ),
            userNoteHitokotoEncode: normalizeHitokotoEncode(data.data.userNoteHitokotoEncode),
            userNoteHitokotoFallbackToNote: Boolean(
              data.data.userNoteHitokotoFallbackToNote,
            ),
            themePreset: data.data.themePreset ?? 'basic',
            themeCustomSurface: themeCustomSurfaceFromApi(data.data.themeCustomSurface),
            customCss: data.data.customCss ?? '',
            mcpThemeToolsEnabled: data.data.mcpThemeToolsEnabled === true,
            openApiDocsEnabled: data.data.openApiDocsEnabled !== false,
            aiToolMode: String(data.data.aiToolMode ?? '').trim().toLowerCase() === 'mcp' ? 'mcp' : 'skills',
            historyWindowMinutes: Number(
              data.data.historyWindowMinutes ?? SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
            ),
            processStaleSeconds: Number(
              data.data.processStaleSeconds ?? SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
            ),
            appMessageRules: rules,
            appMessageRulesShowProcessName: data.data.appMessageRulesShowProcessName !== false,
            appFilterMode,
            appBlacklist: blacklist,
            appWhitelist: whitelist,
            appNameOnlyList: nameOnlyList,
            captureReportedAppsEnabled: data.data.captureReportedAppsEnabled !== false,
            mediaPlaySourceBlocklist: Array.isArray(data.data.mediaPlaySourceBlocklist)
              ? (data.data.mediaPlaySourceBlocklist as unknown[])
                  .map((item) => String(item ?? '').trim().toLowerCase())
                  .filter((item) => item.length > 0)
              : [],
            pageLockEnabled: Boolean(data.data.pageLockEnabled),
            pageLockPassword: '',
            hcaptchaEnabled: Boolean(data.data.hcaptchaEnabled),
            hcaptchaSiteKey: data.data.hcaptchaSiteKey ?? '',
            hcaptchaSecretKey: '',
            currentlyText: data.data.currentlyText ?? '当前状态',
            earlierText: data.data.earlierText ?? '最近的随想录',
            adminText: data.data.adminText ?? 'admin',
            autoAcceptNewDevices: Boolean(data.data.autoAcceptNewDevices),
            inspirationDeviceRestrictionEnabled: Array.isArray(
              data.data.inspirationAllowedDeviceHashes,
            ),
            inspirationAllowedDeviceHashes: Array.isArray(data.data.inspirationAllowedDeviceHashes)
              ? (data.data.inspirationAllowedDeviceHashes as unknown[])
                  .map((item) => String(item ?? '').trim())
                  .filter((item) => item.length > 0)
              : [],
            scheduleSlotMinutes: isAllowedSlotMinutes(Number(data.data.scheduleSlotMinutes))
              ? Number(data.data.scheduleSlotMinutes)
              : SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
            schedulePeriodTemplate: resolveSchedulePeriodTemplate(data.data.schedulePeriodTemplate),
            scheduleGridByWeekday: resolveScheduleGridByWeekday(
              data.data.scheduleGridByWeekday,
              isAllowedSlotMinutes(Number(data.data.scheduleSlotMinutes))
                ? Number(data.data.scheduleSlotMinutes)
                : SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
            ),
            scheduleCourses: Array.isArray(data.data.scheduleCourses)
              ? (data.data.scheduleCourses as ScheduleCourse[])
              : [],
            scheduleIcs: typeof data.data.scheduleIcs === 'string' ? data.data.scheduleIcs : '',
            scheduleInClassOnHome: Boolean(data.data.scheduleInClassOnHome),
            scheduleHomeShowLocation: Boolean(data.data.scheduleHomeShowLocation),
            scheduleHomeShowTeacher: Boolean(data.data.scheduleHomeShowTeacher),
            scheduleHomeShowNextUpcoming: Boolean(data.data.scheduleHomeShowNextUpcoming),
            scheduleHomeAfterClassesLabel:
              typeof data.data.scheduleHomeAfterClassesLabel === 'string' &&
              data.data.scheduleHomeAfterClassesLabel.trim().length > 0
                ? data.data.scheduleHomeAfterClassesLabel.trim().slice(
                    0,
                    SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
                  )
                : SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
            globalMouseTiltEnabled: data.data.globalMouseTiltEnabled === true,
            globalMouseTiltGyroEnabled: data.data.globalMouseTiltGyroEnabled === true,
            hideActivityMedia: data.data.hideActivityMedia === true,
            activityRejectLockappSleep: data.data.activityRejectLockappSleep === true,
            displayTimezone: normalizeTimezone(data.data.displayTimezone),
            activityUpdateMode: normalizeActivityUpdateMode(data.data.activityUpdateMode),
            useNoSqlAsCacheRedis:
              data.data.useNoSqlAsCacheRedis === undefined
                ? true
                : data.data.useNoSqlAsCacheRedis === true,
            redisCacheTtlSeconds: Number(
              data.data.redisCacheTtlSeconds ?? REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
            ),
            steamEnabled: Boolean(data.data.steamEnabled),
            steamId: String(data.data.steamId ?? ''),
            steamApiKey: '',
          }
          setRedisCacheServerlessForced(data.data.redisCacheServerlessForced === true)
          setForm(loaded)
          setBaselineForm(structuredClone(loaded))
        }
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const saveSkillsConfig = async (
    patch: {
      enabled?: boolean
      authMode?: 'oauth' | 'apikey'
      rotateApiKey?: boolean
      rotateLegacyMcpKey?: boolean
      revokeOauthForAiClientId?: string
      oauthTokenTtlMinutes?: number
    },
    options?: {
      successMessage?: string | null
    },
  ) => {
    setSkillsSaving(true)
    try {
      const res = await fetch('/api/admin/skills', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json().catch(() => null)
      if (!json?.success) {
        toast.error(json?.error || `保存失败（HTTP ${res.status}）`)
        return
      }
      setSkillsEnabled(json.data?.enabled === true)
      setSkillsAuthMode(
        json.data?.authMode === 'oauth' || json.data?.authMode === 'apikey' ? json.data.authMode : '',
      )
      setSkillsApiKeyConfigured(json.data?.apiKeyConfigured === true)
      setSkillsOauthConfigured(json.data?.oauthConfigured === true)
      setSkillsOauthTokenTtlMinutes(
        Number.isFinite(Number(json.data?.oauthTokenTtlMinutes))
          ? Number(json.data.oauthTokenTtlMinutes)
          : 60,
      )
      setSkillsAiAuthorizations(normalizeSkillsAiAuthorizations(json.data?.aiAuthorizations))
      setSkillsGeneratedApiKey(typeof json.data?.generatedApiKey === 'string' ? json.data.generatedApiKey : '')
      setLegacyMcpConfigured(json.data?.legacyMcpConfigured === true)
      setLegacyMcpGeneratedApiKey(
        typeof json.data?.generatedLegacyMcpApiKey === 'string' ? json.data.generatedLegacyMcpApiKey : '',
      )
      if (options?.successMessage !== null) {
        toast.success(options?.successMessage || '已保存 Skills 设置')
      }
    } catch (e) {
      console.error(e)
      toast.error('保存失败')
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
      toast.success(`已撤销 AI ${normalized} 的 OAuth 授权`)
    } finally {
      setSkillsRevokingAiClientId('')
    }
  }

  useEffect(() => {
    if (!form.captureReportedAppsEnabled) {
      setHistoryApps([])
      setHistoryPlaySources([])
      return
    }
    void (async () => {
      try {
        const [appsRes, playSourcesRes] = await Promise.all([
          fetch('/api/admin/activity/history/apps?limit=200'),
          fetch('/api/admin/activity/history/play-sources?limit=200'),
        ])
        const [appsData, playSourcesData] = await Promise.all([
          appsRes.json().catch(() => null),
          playSourcesRes.json().catch(() => null),
        ])
        if (appsData?.success && Array.isArray(appsData.data)) {
          const apps = (appsData.data as Array<{ processName?: unknown }>)
            .map((x) => String(x?.processName ?? '').trim())
            .filter((x) => x.length > 0)
          setHistoryApps(apps)
        }
        if (playSourcesData?.success && Array.isArray(playSourcesData.data)) {
          const playSources = (playSourcesData.data as Array<{ playSource?: unknown }>)
            .map((x) => String(x?.playSource ?? '').trim().toLowerCase())
            .filter((x) => x.length > 0)
          setHistoryPlaySources(playSources)
        }
      } catch {
        // ignore
      }
    })()
  }, [form.captureReportedAppsEnabled])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/devices?limit=200')
        const data = await res.json()
        if (data?.success && Array.isArray(data.data)) {
          setInspirationDevices(data.data)
        }
      } catch {
        // ignore
      }
    })()
  }, [])

  const patch = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const onFileSelected = (file?: File) => {
    if (!file) return
    if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl)
    const objectUrl = URL.createObjectURL(file)
    setCropSourceUrl(objectUrl)
    setCropDialogOpen(true)
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

      const normalizeRules = (rules: Array<{ match: string; text: string }>) => {
        return rules
          .map((r) => ({
            match: String(r?.match ?? '').trim(),
            text: String(r?.text ?? '').trim(),
          }))
          .filter((r) => r.match.length > 0 && r.text.length > 0)
      }

      const parsedRules = normalizeRules(form.appMessageRules)
      const parsedBlacklist = normalizeStringList(form.appBlacklist)
      const parsedWhitelist = normalizeStringList(form.appWhitelist)
      const parsedNameOnlyList = normalizeStringList(form.appNameOnlyList)
      const parsedMediaSourceBlocklist = normalizeStringList(form.mediaPlaySourceBlocklist).map((s) =>
        s.toLowerCase(),
      )

      const poTrim = form.profileOnlineAccentColor.trim()
      if (poTrim && !normalizeProfileOnlineAccentColor(poTrim)) {
        toast.error('头像在线色格式无效，请使用 #RRGGBB 或留空')
        setSaving(false)
        return
      }

      const {
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

      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formRest,
          mcpThemeToolsEnabled: form.mcpThemeToolsEnabled,
          redisCacheTtlSeconds: normalizedRedisTtl,
          profileOnlineAccentColor: normalizeProfileOnlineAccentColor(poTrim || '') ?? null,
          appMessageRules: parsedRules,
          appBlacklist: parsedBlacklist,
          appWhitelist: parsedWhitelist,
          appNameOnlyList: parsedNameOnlyList,
          captureReportedAppsEnabled: form.captureReportedAppsEnabled,
          mediaPlaySourceBlocklist: parsedMediaSourceBlocklist,
          inspirationAllowedDeviceHashes: inspirationDeviceRestrictionEnabled
            ? normalizeStringList(inspirationHashSelection)
            : null,
          ...hcaptchaPatch,
          ...steamPatch,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        toast.error(data?.error || '保存失败')
        return
      }
      const skillsPatch = normalizeSkillsEditableConfig({
        enabled: skillsEnabled,
        authMode: skillsAuthMode,
        oauthTokenTtlMinutes: skillsOauthTokenTtlMinutes,
      })
      const skillsRes = await fetch('/api/admin/skills', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: skillsPatch.enabled,
          authMode: skillsPatch.authMode || undefined,
          oauthTokenTtlMinutes: skillsPatch.oauthTokenTtlMinutes,
        }),
      })
      const skillsJson = await skillsRes.json().catch(() => null)
      if (!skillsRes.ok || !skillsJson?.success) {
        toast.error(skillsJson?.error || 'Skills 设置保存失败，请重试')
        return
      }

      const serverSkills = normalizeSkillsEditableConfig({
        enabled: skillsJson.data?.enabled === true,
        authMode:
          skillsJson.data?.authMode === 'oauth' || skillsJson.data?.authMode === 'apikey'
            ? skillsJson.data.authMode
            : '',
        oauthTokenTtlMinutes: skillsJson.data?.oauthTokenTtlMinutes,
      })
      setSkillsEnabled(serverSkills.enabled)
      setSkillsAuthMode(serverSkills.authMode)
      setSkillsOauthTokenTtlMinutes(serverSkills.oauthTokenTtlMinutes)
      setSkillsApiKeyConfigured(skillsJson.data?.apiKeyConfigured === true)
      setSkillsOauthConfigured(skillsJson.data?.oauthConfigured === true)
      setLegacyMcpConfigured(skillsJson.data?.legacyMcpConfigured === true)
      setSkillsAiAuthorizations(normalizeSkillsAiAuthorizations(skillsJson.data?.aiAuthorizations))
      setBaselineSkillsConfig(structuredClone(serverSkills))

      toast.success('保存成功，主页刷新后生效')
      setRedisCacheServerlessForced(data?.data?.redisCacheServerlessForced === true)
      const nextForm =
        data?.data && typeof data.data.useNoSqlAsCacheRedis === 'boolean'
          ? { ...form, useNoSqlAsCacheRedis: data.data.useNoSqlAsCacheRedis === true }
          : form
      setForm(nextForm)
      setBaselineForm(structuredClone(nextForm))
    } catch {
      toast.error('网络异常，请重试')
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
      const res = await fetch('/api/admin/settings/export')
      const data = await res.json()
      if (!res.ok || !data?.success || !data?.data?.encoded) {
        toast.error(typeof data?.error === 'string' ? data.error : '导出失败')
        return
      }

      await navigator.clipboard.writeText(data.data.encoded)
      toast.success('已复制接入配置到剪贴板')
    } catch {
      toast.error('复制失败，请重试')
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

  const confirmImportConfig = () => {
    const raw = importConfigInput.trim()
    if (!raw) {
      toast.error('请先粘贴 Base64 接入配置')
      return
    }
    const compact = raw.replace(/\s+/g, '')
    const parsed = parseExportPayload(compact)
    if (!parsed) {
      toast.error('格式无效：请确认是本站「一键复制接入配置」导出的 Base64 全文')
      return
    }
    const partial = webPayloadToFormPatch(parsed.web)
    setForm((prev) => ({
      ...prev,
      ...partial,
      pageLockPassword: '',
    }))
    setImportConfigDialogOpen(false)
    toast.success('已写入网页配置，请记得保存')
  }

  const copyPlainText = async (value: string, successText: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(successText)
    } catch {
      toast.error('复制失败，请重试')
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

  if (loading) {
    return <div className="text-sm text-muted-foreground">加载配置中...</div>
  }

  return (
    <>
    <div className="rounded-xl border bg-card p-6 space-y-5">
      <Tabs defaultValue="basic" className="space-y-5">
        <TabsList>
          <TabsTrigger value="basic">基础设置</TabsTrigger>
          <TabsTrigger value="advanced">进阶设置</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-5">
          <WebSettingsBasicPanel
            form={form}
            patch={patch}
            cropSourceUrl={cropSourceUrl}
            onFileSelected={onFileSelected}
            onOpenCropDialog={() => setCropDialogOpen(true)}
          />
        </TabsContent>

        <TabsContent value="advanced" className="space-y-5">
          <section className="space-y-4 rounded-xl border border-border/60 bg-muted/5 p-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold tracking-wide text-foreground">平台与访问</h3>
              <p className="text-xs text-muted-foreground">
                控制调试能力、开发者文档与后台访问验证。
              </p>
            </div>

            <WebSettingsSkillsPanel
              skillsSaving={skillsSaving}
              skillsEnabled={skillsEnabled}
              skillsAuthMode={skillsAuthMode}
              skillsApiKeyConfigured={skillsApiKeyConfigured}
              skillsOauthConfigured={skillsOauthConfigured}
              skillsOauthTokenTtlMinutes={skillsOauthTokenTtlMinutes}
              skillsAiAuthorizations={skillsAiAuthorizations}
              skillsRevokingAiClientId={skillsRevokingAiClientId}
              skillsGeneratedApiKey={skillsGeneratedApiKey}
              legacyMcpConfigured={legacyMcpConfigured}
              legacyMcpGeneratedApiKey={legacyMcpGeneratedApiKey}
              publicOrigin={publicOrigin}
              aiToolMode={form.aiToolMode}
              mcpThemeToolsEnabled={form.mcpThemeToolsEnabled}
              onSkillsEnabledChange={setSkillsEnabled}
              onSkillsAuthModeChange={setSkillsAuthMode}
              onSkillsOauthTokenTtlMinutesChange={setSkillsOauthTokenTtlMinutes}
              onAiToolModeChange={(mode) =>
                setForm((prev) => ({
                  ...prev,
                  aiToolMode: mode,
                  mcpThemeToolsEnabled: mode === 'mcp' ? prev.mcpThemeToolsEnabled : false,
                }))
              }
              onMcpThemeToolsEnabledChange={(enabled) => patch('mcpThemeToolsEnabled', enabled)}
              onSaveSkillsConfig={(options) => saveSkillsConfig(options)}
              onRevokeSkillsOauthByAiClientId={revokeSkillsOauthByAiClientId}
              onCopyPlainText={copyPlainText}
            />

            <div className="grid gap-4 xl:grid-cols-2">
              <WebSettingsOpenApiPanel form={form} patch={patch} />
              <WebSettingsSecurityPanel form={form} patch={patch} />
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-border/60 bg-muted/5 p-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold tracking-wide text-foreground">前台展示</h3>
              <p className="text-xs text-muted-foreground">
                调整首页观感、文案来源、主题细节与自定义样式。
              </p>
            </div>

            <WebSettingsHitokotoPanel
              form={form}
              patch={patch}
              onCategoriesChange={(next) =>
                setForm((prev) => ({ ...prev, userNoteHitokotoCategories: next }))
              }
            />

            {form.themePreset === 'customSurface' ? (
              <WebSettingsCustomSurface
                value={form.themeCustomSurface}
                onChange={(nextThemeCustomSurface) =>
                  setForm((prev) => ({ ...prev, themeCustomSurface: nextThemeCustomSurface }))
                }
              />
            ) : null}

            <div className="space-y-2">
              <Label>自定义 CSS 覆写（主界面）</Label>
              <textarea
                rows={8}
                value={form.customCss}
                onChange={(e) => patch('customCss', e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                placeholder="示例：:root { --primary: oklch(0.5 0.2 30); }"
              />
              <p className="text-xs text-muted-foreground">
                保存后会注入页面并覆盖默认样式，可用于快速主题定制。
              </p>
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-border/60 bg-muted/5 p-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold tracking-wide text-foreground">运行与采集</h3>
              <p className="text-xs text-muted-foreground">
                控制活动流、缓存、设备接入和前台状态展示行为。
              </p>
            </div>

            <WebSettingsActivityPanel
              form={form}
              patch={patch}
              redisCacheServerlessForced={redisCacheServerlessForced}
              inspirationDevices={inspirationDevices}
            />

            <WebSettingsRuleTools
              form={form}
              patch={patch}
              historyApps={historyApps}
              historyPlaySources={historyPlaySources}
            />
          </section>

          <section className="space-y-4 rounded-xl border border-dashed border-border/60 bg-background/40 p-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold tracking-wide text-foreground">导入导出</h3>
              <p className="text-xs text-muted-foreground">
                用于迁移或快速接入当前网页配置，不影响底部的统一保存流程。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => void copyExportConfig()}>
                一键复制接入配置（Base64）
              </Button>
              <Button type="button" variant="outline" onClick={() => void applyImportConfig()}>
                一键写入配置
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              「一键写入配置」会尝试从剪贴板读取 Base64，并在弹窗中确认。仅合并导出包中的网页字段到本页表单，不包含 Token；
              写入后请用底部悬浮条保存。
            </p>
          </section>
        </TabsContent>
      </Tabs>

      <ImageCropDialog
        open={cropDialogOpen}
        onOpenChange={(open) => {
          setCropDialogOpen(open)
          if (!open) {
            setCropSourceUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev)
              return null
            })
          }
        }}
        sourceUrl={cropSourceUrl}
        aspectMode="square"
        outputSize={128}
        title="裁剪头像"
        description="拖动选区或边角调整范围，确认后生成 128×128 头像。"
        onComplete={(dataUrl) => patch('avatarUrl', dataUrl)}
      />
    </div>
    <Dialog open={importConfigDialogOpen} onOpenChange={setImportConfigDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>导入网页配置</DialogTitle>
          <DialogDescription>
            将用导入包中的「网页配置」覆盖当前表单（不含页面锁密码、不含 API Token）。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="import-config-input">Base64 接入配置</Label>
          <Input
            id="import-config-input"
            value={importConfigInput}
            onChange={(e) => setImportConfigInput(e.target.value)}
            placeholder="粘贴「一键复制接入配置」导出的 Base64 全文"
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">导入时会自动忽略空格与换行。</p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setImportConfigDialogOpen(false)}
          >
            取消
          </Button>
          <Button type="button" onClick={confirmImportConfig}>
            导入并覆盖网页配置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <UnsavedChangesBar
      open={webSettingsDirty}
      saving={saving}
      onSave={save}
      onRevert={revertUnsavedWebSettings}
      saveLabel="保存配置"
      revertLabel="撤销"
    />
    </>
  )
}
