import {
  type AppMessageTitleRule,
  prepareAppMessageRulesForSave,
} from '@/lib/app-message-rules'
import type {
  AppMessageRuleGroup,
  RuleToolsExportPayload,
  RuleToolsListItem,
  RuleToolsListKey,
  RuleToolsRuleItem,
  RuleToolsSummary,
} from '@/types/rule-tools'

export type ListEditingState = {
  listKey: RuleToolsListKey
  currentValue: string
  draftValue: string
}

export function summarizeAppRuleGroup(
  rule: AppMessageRuleGroup,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const process = rule.processMatch.trim() || t('webSettingsRuleTools.appRules.matchEmpty')
  const fallback = String(rule.defaultText ?? '').trim()
  const titleRuleCount = Array.isArray(rule.titleRules) ? rule.titleRules.length : 0
  if (fallback) {
    return t('webSettingsRuleTools.appRules.groupSummaryWithDefault', { process, text: fallback })
  }
  if (titleRuleCount > 0) {
    return t('webSettingsRuleTools.appRules.groupSummaryWithTitleRules', {
      process,
      count: titleRuleCount,
    })
  }
  return process
}

export function cloneRuleToolsPayload(payload: RuleToolsExportPayload): RuleToolsExportPayload {
  return {
    appMessageRules: payload.appMessageRules.map((rule) => ({
      ...rule,
      titleRules: rule.titleRules.map((titleRule) => ({ ...titleRule })),
    })),
    appMessageRulesShowProcessName: payload.appMessageRulesShowProcessName !== false,
    appFilterMode: payload.appFilterMode === 'whitelist' ? 'whitelist' : 'blacklist',
    appBlacklist: [...payload.appBlacklist],
    appWhitelist: [...payload.appWhitelist],
    appNameOnlyList: [...payload.appNameOnlyList],
    captureReportedAppsEnabled: payload.captureReportedAppsEnabled !== false,
    mediaPlaySourceBlocklist: [...payload.mediaPlaySourceBlocklist],
  }
}

export function buildRuleToolsSummary(payload: RuleToolsExportPayload): RuleToolsSummary {
  return {
    appMessageRulesShowProcessName: payload.appMessageRulesShowProcessName !== false,
    appFilterMode: payload.appFilterMode === 'whitelist' ? 'whitelist' : 'blacklist',
    captureReportedAppsEnabled: payload.captureReportedAppsEnabled !== false,
    ruleGroupCount: payload.appMessageRules.length,
    appBlacklistCount: payload.appBlacklist.length,
    appWhitelistCount: payload.appWhitelist.length,
    appNameOnlyListCount: payload.appNameOnlyList.length,
    mediaPlaySourceBlocklistCount: payload.mediaPlaySourceBlocklist.length,
  }
}

export function buildRuleItems(payload: RuleToolsExportPayload): RuleToolsRuleItem[] {
  return payload.appMessageRules.map((rule, position) => ({
    ...rule,
    position,
  }))
}

export function filterRuleItems(items: RuleToolsRuleItem[], q: string): RuleToolsRuleItem[] {
  const normalized = q.trim().toLowerCase()
  if (!normalized) return items
  return items.filter((item) => {
    const haystacks = [
      item.processMatch,
      item.defaultText ?? '',
      ...item.titleRules.flatMap((titleRule) => [titleRule.pattern, titleRule.text]),
    ]
    return haystacks.some((value) => String(value).toLowerCase().includes(normalized))
  })
}

export function filterListValues(values: string[], q: string): RuleToolsListItem[] {
  const normalized = q.trim().toLowerCase()
  return values
    .map((value, position) => ({ value, position }))
    .filter(
      (item) => item.value.length > 0 && (normalized ? item.value.toLowerCase().includes(normalized) : true),
    )
}

export function normalizeDraftListValue(listKey: RuleToolsListKey, raw: string): string {
  const base = raw.trim()
  return listKey === 'mediaPlaySourceBlocklist' ? base.toLowerCase() : base
}

export function dedupeDraftList(listKey: RuleToolsListKey, values: string[]): string[] {
  const next: string[] = []
  const seen = new Set<string>()
  for (const raw of values) {
    const value = normalizeDraftListValue(listKey, raw)
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    next.push(value)
  }
  return next
}

export function normalizePayloadForSave(
  payload: RuleToolsExportPayload,
): { data: RuleToolsExportPayload; error: { group: number; rule: number; message: string } | null } {
  const preparedRules = prepareAppMessageRulesForSave(payload.appMessageRules)
  if (preparedRules.errors.length > 0) {
    const first = preparedRules.errors[0]
    return {
      data: cloneRuleToolsPayload(payload),
      error: {
        group: first.groupIndex + 1,
        rule: first.titleRuleIndex + 1,
        message: first.message,
      },
    }
  }

  return {
    data: {
      appMessageRules: preparedRules.data,
      appMessageRulesShowProcessName: payload.appMessageRulesShowProcessName !== false,
      appFilterMode: payload.appFilterMode === 'whitelist' ? 'whitelist' : 'blacklist',
      appBlacklist: dedupeDraftList('appBlacklist', payload.appBlacklist),
      appWhitelist: dedupeDraftList('appWhitelist', payload.appWhitelist),
      appNameOnlyList: dedupeDraftList('appNameOnlyList', payload.appNameOnlyList),
      captureReportedAppsEnabled: payload.captureReportedAppsEnabled !== false,
      mediaPlaySourceBlocklist: dedupeDraftList(
        'mediaPlaySourceBlocklist',
        payload.mediaPlaySourceBlocklist,
      ),
    },
    error: null,
  }
}

export function areRuleToolsPayloadEqual(
  left: RuleToolsExportPayload | null,
  right: RuleToolsExportPayload | null,
): boolean {
  if (!left || !right) return left === right
  return JSON.stringify(left) === JSON.stringify(right)
}

export function moveItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return [...items]
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  if (typeof item === "undefined") return next
  next.splice(toIndex, 0, item)
  return next
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

export function getTitleRuleRegexErrorMessage(
  titleRule: AppMessageTitleRule,
  groupIndex: number,
  titleRuleIndex: number,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  if (titleRule.mode !== 'regex' || !titleRule.pattern.trim()) return null
  try {
    new RegExp(titleRule.pattern, 'i')
    return null
  } catch (error) {
    return t('webSettingsRuleTools.appRules.invalidRegex', {
      group: groupIndex + 1,
      rule: titleRuleIndex + 1,
      message: error instanceof Error ? error.message : 'Invalid regular expression',
    })
  }
}
