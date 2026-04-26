import { parseJsonString } from '@/lib/json-parse'
import type {
  AppMessageRuleGroup,
  AppMessageTitleRule,
  AppTitleRuleMode,
  ExportableAppMessageRuleGroup,
} from '@/types/rule-tools'

export type {
  AppMessageRuleGroup,
  AppMessageTitleRule,
  AppTitleRuleMode,
  ExportableAppMessageRuleGroup,
} from '@/types/rule-tools'

type LegacyAppMessageRule = {
  match?: unknown
  text?: unknown
}

type RawAppMessageTitleRule = {
  id?: unknown
  mode?: unknown
  pattern?: unknown
  text?: unknown
}

type RawAppMessageRuleGroup = {
  id?: unknown
  processMatch?: unknown
  defaultText?: unknown
  titleRules?: unknown
}

export type AppMessageRuleValidationError = {
  type: 'invalid_regex'
  groupIndex: number
  titleRuleIndex: number
  pattern: string
  message: string
}

function createRuntimeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`
  }
  const fallback = Math.random().toString(36).slice(2, 12)
  return `${prefix}_${Date.now().toString(36)}${fallback}`
}

export function createAppMessageRuleGroupId(): string {
  return createRuntimeId('arg')
}

export function createAppMessageTitleRuleId(): string {
  return createRuntimeId('atr')
}

function normalizeTitleRule(raw: unknown): AppMessageTitleRule | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const rule = raw as RawAppMessageTitleRule
  const mode = String(rule.mode ?? '').trim().toLowerCase() === 'regex' ? 'regex' : 'plain'
  return {
    id:
      typeof rule.id === 'string' && rule.id.trim().length > 0
        ? rule.id.trim()
        : createAppMessageTitleRuleId(),
    mode,
    pattern: String(rule.pattern ?? ''),
    text: String(rule.text ?? ''),
  }
}

function normalizeRuleGroup(raw: unknown): AppMessageRuleGroup | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const group = raw as RawAppMessageRuleGroup
  const titleRules = Array.isArray(group.titleRules)
    ? group.titleRules
        .map((item) => normalizeTitleRule(item))
        .filter((item): item is AppMessageTitleRule => item !== null)
    : []
  const processMatch = String(group.processMatch ?? '')
  const defaultText = String(group.defaultText ?? '')

  if (processMatch || defaultText || titleRules.length > 0 || typeof group.id === 'string') {
    return {
      id:
        typeof group.id === 'string' && group.id.trim().length > 0
          ? group.id.trim()
          : createAppMessageRuleGroupId(),
      processMatch,
      defaultText: defaultText || undefined,
      titleRules,
    }
  }

  const legacy = raw as LegacyAppMessageRule
  const match = String(legacy.match ?? '')
  const text = String(legacy.text ?? '')
  if (!match && !text) return null
  return {
    id: createAppMessageRuleGroupId(),
    processMatch: match,
    defaultText: text || undefined,
    titleRules: [],
  }
}

export function normalizeAppMessageRules(raw: unknown): AppMessageRuleGroup[] {
  const parsed = parseJsonString(raw)
  if (!Array.isArray(parsed)) return []
  return parsed
    .map((item) => normalizeRuleGroup(item))
    .filter((item): item is AppMessageRuleGroup => item !== null)
}

export function prepareAppMessageRulesForSave(rules: AppMessageRuleGroup[]): {
  data: AppMessageRuleGroup[]
  errors: AppMessageRuleValidationError[]
} {
  const data: AppMessageRuleGroup[] = []
  const errors: AppMessageRuleValidationError[] = []

  rules.forEach((rule, groupIndex) => {
    const processMatch = String(rule?.processMatch ?? '')
    const defaultText = String(rule?.defaultText ?? '')
    const titleRules: AppMessageTitleRule[] = []
    const rawTitleRules = Array.isArray(rule?.titleRules) ? rule.titleRules : []

    rawTitleRules.forEach((titleRule, titleRuleIndex) => {
      const mode = String(titleRule?.mode ?? '').trim().toLowerCase() === 'regex' ? 'regex' : 'plain'
      const pattern = String(titleRule?.pattern ?? '')
      const text = String(titleRule?.text ?? '')
      if (mode === 'regex' && pattern.trim()) {
        try {
          new RegExp(pattern, 'i')
        } catch (error) {
          errors.push({
            type: 'invalid_regex',
            groupIndex,
            titleRuleIndex,
            pattern,
            message: error instanceof Error ? error.message : 'Invalid regular expression',
          })
          return
        }
      }
      titleRules.push({
        id:
          typeof titleRule?.id === 'string' && titleRule.id.trim().length > 0
            ? titleRule.id.trim()
            : createAppMessageTitleRuleId(),
        mode,
        pattern,
        text,
      })
    })

    data.push({
      id:
        typeof rule?.id === 'string' && rule.id.trim().length > 0
          ? rule.id.trim()
          : createAppMessageRuleGroupId(),
      processMatch,
      defaultText: defaultText || undefined,
      titleRules,
    })
  })

  return { data, errors }
}

export function stripAppMessageRuleIds(
  rules: AppMessageRuleGroup[],
): ExportableAppMessageRuleGroup[] {
  return rules.map((rule) => ({
    processMatch: String(rule.processMatch ?? ''),
    defaultText: String(rule.defaultText ?? '') || undefined,
    titleRules: Array.isArray(rule.titleRules)
      ? rule.titleRules.map((titleRule) => ({
          mode: titleRule.mode === 'regex' ? 'regex' : 'plain',
          pattern: String(titleRule.pattern ?? ''),
          text: String(titleRule.text ?? ''),
        }))
      : [],
  }))
}

export function renderAppMessageRuleText(
  template: string,
  processName: string,
  processTitle: string | null,
): string {
  return template
    .replaceAll('{process}', processName)
    .replaceAll('{title}', processTitle || '')
}
