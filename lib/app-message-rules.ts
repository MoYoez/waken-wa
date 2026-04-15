import { parseJsonString } from '@/lib/json-parse'

export type AppTitleRuleMode = 'plain' | 'regex'

export type AppMessageTitleRule = {
  mode: AppTitleRuleMode
  pattern: string
  text: string
}

export type AppMessageRuleGroup = {
  processMatch: string
  defaultText?: string
  titleRules: AppMessageTitleRule[]
}

type LegacyAppMessageRule = {
  match?: unknown
  text?: unknown
}

type RawAppMessageRuleGroup = {
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

function normalizeTitleRule(raw: unknown): AppMessageTitleRule | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const rule = raw as { mode?: unknown; pattern?: unknown; text?: unknown }
  const mode = String(rule.mode ?? '').trim().toLowerCase() === 'regex' ? 'regex' : 'plain'
  const pattern = String(rule.pattern ?? '').trim()
  const text = String(rule.text ?? '').trim()
  if (!pattern || !text) return null
  return { mode, pattern, text }
}

function normalizeRuleGroup(raw: unknown): AppMessageRuleGroup | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const group = raw as RawAppMessageRuleGroup
  const processMatch = String(group.processMatch ?? '').trim()
  if (processMatch) {
    const defaultText = String(group.defaultText ?? '').trim()
    const titleRules = Array.isArray(group.titleRules)
      ? group.titleRules
          .map((item) => normalizeTitleRule(item))
          .filter((item): item is AppMessageTitleRule => item !== null)
      : []
    return {
      processMatch,
      defaultText: defaultText || undefined,
      titleRules,
    }
  }

  const legacy = raw as LegacyAppMessageRule
  const match = String(legacy.match ?? '').trim()
  const text = String(legacy.text ?? '').trim()
  if (!match || !text) return null
  return {
    processMatch: match,
    defaultText: text,
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
    const processMatch = String(rule?.processMatch ?? '').trim()
    if (!processMatch) return

    const defaultText = String(rule?.defaultText ?? '').trim()
    const titleRules: AppMessageTitleRule[] = []
    const rawTitleRules = Array.isArray(rule?.titleRules) ? rule.titleRules : []

    rawTitleRules.forEach((titleRule, titleRuleIndex) => {
      const mode = String(titleRule?.mode ?? '').trim().toLowerCase() === 'regex' ? 'regex' : 'plain'
      const pattern = String(titleRule?.pattern ?? '').trim()
      const text = String(titleRule?.text ?? '').trim()
      if (!pattern || !text) return
      if (mode === 'regex') {
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
      titleRules.push({ mode, pattern, text })
    })

    if (!defaultText && titleRules.length === 0) return

    data.push({
      processMatch,
      defaultText: defaultText || undefined,
      titleRules,
    })
  })

  return { data, errors }
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
