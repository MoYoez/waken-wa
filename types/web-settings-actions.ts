import type { QueryClient } from '@tanstack/react-query'

import type {
  SiteConfig,
  SkillsAiAuthorizationItem,
  SkillsEditableConfig,
} from '@/types/web-settings'

export type WebSettingsTranslateFn = (
  key: string,
  options?: Record<string, unknown>,
) => string

export type WebSettingsSetString = (value: string) => void
export type WebSettingsSetBoolean = (value: boolean) => void
export type WebSettingsSetNumber = (value: number | string) => void
export type WebSettingsSetSkillsAuthMode = (value: SkillsEditableConfig['authMode']) => void
export type WebSettingsSetSkillsAuthorizations = (
  value: SkillsAiAuthorizationItem[],
) => void
export type WebSettingsSetSkillsConfig = (value: SkillsEditableConfig) => void
export type WebSettingsSetFormState = (
  value: SiteConfig | ((prev: SiteConfig) => SiteConfig),
) => void

export type WebSettingsSaveContext = {
  baselineForm: SiteConfig | null
  form: SiteConfig
  hasLockedLegacyChanges: boolean
  queryClient: QueryClient
  refreshSettingsData: () => Promise<Record<string, any>>
  scheduleSettingsDirty: boolean
  setBaselineSkillsConfig: WebSettingsSetSkillsConfig
  setLegacyMcpConfigured: WebSettingsSetBoolean
  setSaving: WebSettingsSetBoolean
  setSkillsAiAuthorizations: WebSettingsSetSkillsAuthorizations
  setSkillsApiKeyConfigured: WebSettingsSetBoolean
  setSkillsAuthMode: WebSettingsSetSkillsAuthMode
  setSkillsEnabled: WebSettingsSetBoolean
  setSkillsOauthConfigured: WebSettingsSetBoolean
  setSkillsOauthTokenTtlMinutes: WebSettingsSetNumber
  skillsAuthMode: SkillsEditableConfig['authMode']
  skillsEnabled: boolean
  skillsOauthTokenTtlMinutes: number | string
  syncPartiallySavedSettings: (
    data: Record<string, any>,
    formSnapshot: SiteConfig,
    unsavedKeys: readonly string[],
  ) => void
  t: WebSettingsTranslateFn
  themeSettingsDirty: boolean
}

export type WebSettingsSkillsSaveContext = {
  queryClient: QueryClient
  setLegacyMcpConfigured: WebSettingsSetBoolean
  setLegacyMcpGeneratedApiKey: WebSettingsSetString
  setSkillsAiAuthorizations: WebSettingsSetSkillsAuthorizations
  setSkillsApiKeyConfigured: WebSettingsSetBoolean
  setSkillsAuthMode: WebSettingsSetSkillsAuthMode
  setSkillsEnabled: WebSettingsSetBoolean
  setSkillsGeneratedApiKey: WebSettingsSetString
  setSkillsOauthConfigured: WebSettingsSetBoolean
  setSkillsOauthTokenTtlMinutes: WebSettingsSetNumber
  setSkillsSaving: WebSettingsSetBoolean
  t: WebSettingsTranslateFn
}

export type WebSettingsMigrationContext = {
  queryClient: QueryClient
  refreshMigrationData: () => Promise<Record<string, any>>
  refreshSettingsData: () => Promise<Record<string, any>>
  setMigrationActionPending: WebSettingsSetBoolean
  t: WebSettingsTranslateFn
}

export type WebSettingsImportContext = {
  importConfigInput: string
  queryClient: QueryClient
  setForm: WebSettingsSetFormState
  setImportConfigDialogOpen: WebSettingsSetBoolean
  t: WebSettingsTranslateFn
}
