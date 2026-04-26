export type AppTitleRuleMode = 'plain' | 'regex'

export type AppMessageTitleRule = {
  id: string
  mode: AppTitleRuleMode
  pattern: string
  text: string
}

export type AppMessageRuleGroup = {
  id: string
  processMatch: string
  defaultText?: string
  titleRules: AppMessageTitleRule[]
}

export type ExportableAppMessageTitleRule = {
  mode: AppTitleRuleMode
  pattern: string
  text: string
}

export type ExportableAppMessageRuleGroup = {
  processMatch: string
  defaultText?: string
  titleRules: ExportableAppMessageTitleRule[]
}

export type RuleToolsListKey =
  | 'appBlacklist'
  | 'appWhitelist'
  | 'appNameOnlyList'
  | 'mediaPlaySourceBlocklist'

export type RuleToolsConfigData = {
  appMessageRulesShowProcessName: boolean
  appFilterMode: 'blacklist' | 'whitelist'
  captureReportedAppsEnabled: boolean
}

export type RuleToolsSummary = RuleToolsConfigData & {
  ruleGroupCount: number
  appBlacklistCount: number
  appWhitelistCount: number
  appNameOnlyListCount: number
  mediaPlaySourceBlocklistCount: number
}

export type RuleToolsRuleItem = AppMessageRuleGroup & {
  position: number
}

export type RuleToolsListItem = {
  value: string
  position: number
}

export type RuleToolsConfigResponse = RuleToolsConfigData & {
  revision: string
}

export type RuleToolsRulesResponse = {
  items: RuleToolsRuleItem[]
  total: number
  revision: string
  limit: number
  offset: number
}

export type RuleToolsListResponse = {
  items: RuleToolsListItem[]
  total: number
  revision: string
  limit: number
  offset: number
}

export type RuleToolsExportPayload = RuleToolsConfigData & {
  appMessageRules: AppMessageRuleGroup[]
  appBlacklist: string[]
  appWhitelist: string[]
  appNameOnlyList: string[]
  mediaPlaySourceBlocklist: string[]
}
