import 'server-only'

import { createHash } from 'node:crypto'

import { eq } from 'drizzle-orm'

import { clearActivityFeedDataCache } from '@/lib/activity-feed'
import { ADMIN_LIST_DEFAULT_PAGE_SIZE, ADMIN_LIST_MAX_PAGE_SIZE } from '@/lib/admin-list-constants'
import {
  createAppMessageRuleGroupId,
  createAppMessageTitleRuleId,
  normalizeAppMessageRules,
  prepareAppMessageRulesForSave,
  stripAppMessageRuleIds,
} from '@/lib/app-message-rules'
import { db } from '@/lib/db'
import { siteConfig } from '@/lib/drizzle-schema'
import { safeSiteConfigUpsert } from '@/lib/safe-site-config-upsert'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { normalizeSiteConfigShape } from '@/lib/site-config-normalize'
import type {
  AppMessageRuleGroup,
  AppMessageTitleRule,
  RuleToolsConfigData,
  RuleToolsExportPayload,
  RuleToolsListKey,
  RuleToolsListResponse,
  RuleToolsRuleItem,
  RuleToolsRulesResponse,
  RuleToolsSummary,
} from '@/types/rule-tools'

export const RULE_TOOLS_LIST_KEYS = [
  'appBlacklist',
  'appWhitelist',
  'appNameOnlyList',
  'mediaPlaySourceBlocklist',
] as const satisfies readonly RuleToolsListKey[]

export const RULE_TOOLS_SITE_CONFIG_KEYS = [
  'appMessageRules',
  'appMessageRulesShowProcessName',
  'appFilterMode',
  'appBlacklist',
  'appWhitelist',
  'appNameOnlyList',
  'captureReportedAppsEnabled',
  'mediaPlaySourceBlocklist',
] as const

type RuleToolsState = {
  appMessageRules: AppMessageRuleGroup[]
  appBlacklist: string[]
  appWhitelist: string[]
  appNameOnlyList: string[]
  mediaPlaySourceBlocklist: string[]
  config: RuleToolsConfigData
}

function shaRevision(scope: string, value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify({ scope, value }))
    .digest('hex')
}

function normalizeFilterMode(raw: unknown): 'blacklist' | 'whitelist' {
  return String(raw ?? '').trim().toLowerCase() === 'whitelist' ? 'whitelist' : 'blacklist'
}

function normalizeListValue(listKey: RuleToolsListKey, raw: unknown): string {
  const base = String(raw ?? '').trim()
  return listKey === 'mediaPlaySourceBlocklist' ? base.toLowerCase() : base
}

function normalizeRuleToolsList(listKey: RuleToolsListKey, raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const items: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const value = normalizeListValue(listKey, item)
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    items.push(value)
  }
  return items
}

function cloneRules(rules: AppMessageRuleGroup[]): AppMessageRuleGroup[] {
  return rules.map((rule) => ({
    ...rule,
    titleRules: Array.isArray(rule.titleRules)
      ? rule.titleRules.map((titleRule) => ({ ...titleRule }))
      : [],
  }))
}

function buildRuleToolsSummary(state: RuleToolsState): RuleToolsSummary {
  return {
    ...state.config,
    ruleGroupCount: state.appMessageRules.length,
    appBlacklistCount: state.appBlacklist.length,
    appWhitelistCount: state.appWhitelist.length,
    appNameOnlyListCount: state.appNameOnlyList.length,
    mediaPlaySourceBlocklistCount: state.mediaPlaySourceBlocklist.length,
  }
}

function getConfigRevision(config: RuleToolsConfigData): string {
  return shaRevision('config', config)
}

function getRulesRevision(rules: AppMessageRuleGroup[]): string {
  return shaRevision('rules', rules)
}

function getListRevision(listKey: RuleToolsListKey, items: string[]): string {
  return shaRevision(`list:${listKey}`, items)
}

async function readRuleToolsState(): Promise<RuleToolsState> {
  const raw = await getSiteConfigMemoryFirst()
  if (!raw || typeof raw !== 'object') {
    const error = new Error('未找到网页配置，请先完成初始化配置')
    ;(error as { status?: number }).status = 400
    throw error
  }

  const normalized = normalizeSiteConfigShape(raw as Record<string, unknown>)
  return {
    appMessageRules: normalizeAppMessageRules(normalized.appMessageRules),
    appBlacklist: normalizeRuleToolsList('appBlacklist', normalized.appBlacklist),
    appWhitelist: normalizeRuleToolsList('appWhitelist', normalized.appWhitelist),
    appNameOnlyList: normalizeRuleToolsList('appNameOnlyList', normalized.appNameOnlyList),
    mediaPlaySourceBlocklist: normalizeRuleToolsList(
      'mediaPlaySourceBlocklist',
      normalized.mediaPlaySourceBlocklist,
    ),
    config: {
      appMessageRulesShowProcessName:
        (normalized as Record<string, unknown>).appMessageRulesShowProcessName !== false,
      appFilterMode: normalizeFilterMode((normalized as Record<string, unknown>).appFilterMode),
      captureReportedAppsEnabled:
        (normalized as Record<string, unknown>).captureReportedAppsEnabled !== false,
    },
  }
}

async function persistRuleToolsValues(values: Record<string, unknown>): Promise<void> {
  const [row] = await db.select().from(siteConfig).where(eq(siteConfig.id, 1)).limit(1)
  if (!row || typeof row !== 'object') {
    const error = new Error('未找到网页配置，请先完成初始化配置')
    ;(error as { status?: number }).status = 400
    throw error
  }
  const existing = normalizeSiteConfigShape(row as Record<string, unknown>)

  await safeSiteConfigUpsert({
    where: { id: 1 },
    update: values,
    create: {
      ...(existing as Record<string, unknown>),
      ...values,
    },
  })

  await clearActivityFeedDataCache()
}

function findGroupIndex(rules: AppMessageRuleGroup[], groupId: string): number {
  return rules.findIndex((rule) => rule.id === groupId)
}

function findTitleRuleIndex(group: AppMessageRuleGroup, titleRuleId: string): number {
  return group.titleRules.findIndex((rule) => rule.id === titleRuleId)
}

function assertRevisionMatch(current: string, received: unknown): void {
  if (typeof received !== 'string' || !received.trim()) {
    const error = new Error('缺少 revision')
    ;(error as { status?: number }).status = 400
    throw error
  }
  if (current !== received.trim()) {
    const error = new Error('配置已被其他操作更新，请刷新后重试')
    ;(error as { status?: number }).status = 409
    throw error
  }
}

function createDraftGroup(input: unknown): AppMessageRuleGroup {
  const normalized = normalizeAppMessageRules([input])
  return (
    normalized[0] ?? {
      id: createAppMessageRuleGroupId(),
      processMatch: '',
      defaultText: undefined,
      titleRules: [],
    }
  )
}

function createDraftTitleRule(input: unknown): AppMessageTitleRule {
  const container = createDraftGroup({
    id: createAppMessageRuleGroupId(),
    processMatch: '',
    titleRules: [input],
  })
  return (
    container.titleRules[0] ?? {
      id: createAppMessageTitleRuleId(),
      mode: 'plain',
      pattern: '',
      text: '',
    }
  )
}

function firstRegexErrorMessage(
  rules: AppMessageRuleGroup[],
): { message: string; groupIndex: number; titleRuleIndex: number } | null {
  const prepared = prepareAppMessageRulesForSave(rules)
  if (prepared.errors.length === 0) return null
  const firstError = prepared.errors[0]
  return {
    message: firstError.message,
    groupIndex: firstError.groupIndex,
    titleRuleIndex: firstError.titleRuleIndex,
  }
}

function finalizeRulesOrThrow(rules: AppMessageRuleGroup[]): AppMessageRuleGroup[] {
  const prepared = prepareAppMessageRulesForSave(rules)
  if (prepared.errors.length > 0) {
    const firstError = prepared.errors[0]
    const error = new Error(
      `Invalid regex in group ${firstError.groupIndex + 1}, rule ${firstError.titleRuleIndex + 1}: ${firstError.message}`,
    )
    ;(error as { status?: number }).status = 400
    throw error
  }
  return prepared.data
}

export function isRuleToolsListKey(value: string): value is RuleToolsListKey {
  return (RULE_TOOLS_LIST_KEYS as readonly string[]).includes(value)
}

export function omitRuleToolsFields(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if ((RULE_TOOLS_SITE_CONFIG_KEYS as readonly string[]).includes(key)) continue
    next[key] = value
  }
  return next
}

export function assertNoRuleToolsFields(body: Record<string, unknown>): void {
  const deniedKeys = Object.keys(body).filter((key) =>
    (RULE_TOOLS_SITE_CONFIG_KEYS as readonly string[]).includes(key),
  )
  if (deniedKeys.length === 0) return
  const error = new Error(`Rule tools fields must be updated through dedicated APIs: ${deniedKeys.join(', ')}`)
  ;(error as { status?: number }).status = 400
  throw error
}

export async function getRuleToolsSummary(): Promise<RuleToolsSummary> {
  return buildRuleToolsSummary(await readRuleToolsState())
}

export async function getRuleToolsConfig(): Promise<RuleToolsConfigData & { revision: string }> {
  const state = await readRuleToolsState()
  return {
    ...state.config,
    revision: getConfigRevision(state.config),
  }
}

export async function patchRuleToolsConfig(
  body: Record<string, unknown>,
): Promise<RuleToolsConfigData & { revision: string }> {
  const state = await readRuleToolsState()
  assertRevisionMatch(getConfigRevision(state.config), body.revision)

  const next: RuleToolsConfigData = {
    appMessageRulesShowProcessName:
      'appMessageRulesShowProcessName' in body
        ? body.appMessageRulesShowProcessName !== false
        : state.config.appMessageRulesShowProcessName,
    appFilterMode:
      'appFilterMode' in body
        ? normalizeFilterMode(body.appFilterMode)
        : state.config.appFilterMode,
    captureReportedAppsEnabled:
      'captureReportedAppsEnabled' in body
        ? body.captureReportedAppsEnabled !== false
        : state.config.captureReportedAppsEnabled,
  }

  await persistRuleToolsValues(next)
  return {
    ...next,
    revision: getConfigRevision(next),
  }
}

function filterRuleItems(items: RuleToolsRuleItem[], q: string): RuleToolsRuleItem[] {
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

export async function getRuleToolsRulesPage(input: {
  q?: string
  limit?: number
  offset?: number
}): Promise<RuleToolsRulesResponse> {
  const state = await readRuleToolsState()
  const limit = Number.isFinite(input.limit) ? Math.max(1, Math.min(ADMIN_LIST_MAX_PAGE_SIZE, Math.round(input.limit as number))) : ADMIN_LIST_DEFAULT_PAGE_SIZE
  const offset = Number.isFinite(input.offset) ? Math.max(0, Math.round(input.offset as number)) : 0
  const items = state.appMessageRules.map<RuleToolsRuleItem>((rule, position) => ({
    ...rule,
    position,
  }))
  const filtered = filterRuleItems(items, String(input.q ?? ''))
  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
    revision: getRulesRevision(state.appMessageRules),
    limit,
    offset,
  }
}

export async function patchRuleToolsRules(
  body: Record<string, unknown>,
): Promise<{ revision: string; total: number; groupId?: string; titleRuleId?: string }> {
  const state = await readRuleToolsState()
  assertRevisionMatch(getRulesRevision(state.appMessageRules), body.revision)

  const action = String(body.action ?? '').trim().toLowerCase()
  const nextRules = cloneRules(state.appMessageRules)
  let createdGroupId: string | undefined
  let createdTitleRuleId: string | undefined

  switch (action) {
    case 'create_group': {
      const indexRaw = Number(body.index)
      const index = Number.isFinite(indexRaw)
        ? Math.max(0, Math.min(nextRules.length, Math.round(indexRaw)))
        : nextRules.length
      const group = createDraftGroup(body.group)
      createdGroupId = group.id
      nextRules.splice(index, 0, group)
      break
    }
    case 'update_group': {
      const groupId = String(body.groupId ?? '').trim()
      const index = findGroupIndex(nextRules, groupId)
      if (index < 0) {
        const error = new Error('规则组不存在')
        ;(error as { status?: number }).status = 404
        throw error
      }
      const patch = body.patch && typeof body.patch === 'object' && !Array.isArray(body.patch)
        ? (body.patch as Record<string, unknown>)
        : {}
      const current = nextRules[index]
      nextRules[index] = {
        ...current,
        processMatch:
          'processMatch' in patch ? String(patch.processMatch ?? '') : current.processMatch,
        defaultText:
          'defaultText' in patch
            ? (String(patch.defaultText ?? '') || undefined)
            : current.defaultText,
      }
      break
    }
    case 'delete_group': {
      const groupId = String(body.groupId ?? '').trim()
      const index = findGroupIndex(nextRules, groupId)
      if (index < 0) {
        const error = new Error('规则组不存在')
        ;(error as { status?: number }).status = 404
        throw error
      }
      nextRules.splice(index, 1)
      break
    }
    case 'move_group': {
      const groupId = String(body.groupId ?? '').trim()
      const index = findGroupIndex(nextRules, groupId)
      if (index < 0) {
        const error = new Error('规则组不存在')
        ;(error as { status?: number }).status = 404
        throw error
      }
      const toIndexRaw = Number(body.toIndex)
      if (!Number.isFinite(toIndexRaw)) {
        const error = new Error('缺少有效的 toIndex')
        ;(error as { status?: number }).status = 400
        throw error
      }
      const toIndex = Math.max(0, Math.min(nextRules.length - 1, Math.round(toIndexRaw)))
      const [group] = nextRules.splice(index, 1)
      nextRules.splice(toIndex, 0, group)
      break
    }
    case 'create_title_rule': {
      const groupId = String(body.groupId ?? '').trim()
      const groupIndex = findGroupIndex(nextRules, groupId)
      if (groupIndex < 0) {
        const error = new Error('规则组不存在')
        ;(error as { status?: number }).status = 404
        throw error
      }
      const group = nextRules[groupIndex]
      const indexRaw = Number(body.index)
      const index = Number.isFinite(indexRaw)
        ? Math.max(0, Math.min(group.titleRules.length, Math.round(indexRaw)))
        : group.titleRules.length
      const titleRule = createDraftTitleRule(body.rule)
      createdTitleRuleId = titleRule.id
      group.titleRules.splice(index, 0, titleRule)
      break
    }
    case 'update_title_rule': {
      const groupId = String(body.groupId ?? '').trim()
      const titleRuleId = String(body.titleRuleId ?? '').trim()
      const groupIndex = findGroupIndex(nextRules, groupId)
      if (groupIndex < 0) {
        const error = new Error('规则组不存在')
        ;(error as { status?: number }).status = 404
        throw error
      }
      const titleRuleIndex = findTitleRuleIndex(nextRules[groupIndex], titleRuleId)
      if (titleRuleIndex < 0) {
        const error = new Error('标题规则不存在')
        ;(error as { status?: number }).status = 404
        throw error
      }
      const patch = body.patch && typeof body.patch === 'object' && !Array.isArray(body.patch)
        ? (body.patch as Record<string, unknown>)
        : {}
      const current = nextRules[groupIndex].titleRules[titleRuleIndex]
      nextRules[groupIndex].titleRules[titleRuleIndex] = {
        ...current,
        mode:
          'mode' in patch && String(patch.mode ?? '').trim().toLowerCase() === 'regex'
            ? 'regex'
            : 'mode' in patch
              ? 'plain'
              : current.mode,
        pattern: 'pattern' in patch ? String(patch.pattern ?? '') : current.pattern,
        text: 'text' in patch ? String(patch.text ?? '') : current.text,
      }
      break
    }
    case 'delete_title_rule': {
      const groupId = String(body.groupId ?? '').trim()
      const titleRuleId = String(body.titleRuleId ?? '').trim()
      const groupIndex = findGroupIndex(nextRules, groupId)
      if (groupIndex < 0) {
        const error = new Error('规则组不存在')
        ;(error as { status?: number }).status = 404
        throw error
      }
      const titleRuleIndex = findTitleRuleIndex(nextRules[groupIndex], titleRuleId)
      if (titleRuleIndex < 0) {
        const error = new Error('标题规则不存在')
        ;(error as { status?: number }).status = 404
        throw error
      }
      nextRules[groupIndex].titleRules.splice(titleRuleIndex, 1)
      break
    }
    case 'move_title_rule': {
      const groupId = String(body.groupId ?? '').trim()
      const titleRuleId = String(body.titleRuleId ?? '').trim()
      const groupIndex = findGroupIndex(nextRules, groupId)
      if (groupIndex < 0) {
        const error = new Error('规则组不存在')
        ;(error as { status?: number }).status = 404
        throw error
      }
      const titleRuleIndex = findTitleRuleIndex(nextRules[groupIndex], titleRuleId)
      if (titleRuleIndex < 0) {
        const error = new Error('标题规则不存在')
        ;(error as { status?: number }).status = 404
        throw error
      }
      const toIndexRaw = Number(body.toIndex)
      if (!Number.isFinite(toIndexRaw)) {
        const error = new Error('缺少有效的 toIndex')
        ;(error as { status?: number }).status = 400
        throw error
      }
      const titleRules = nextRules[groupIndex].titleRules
      const toIndex = Math.max(0, Math.min(titleRules.length - 1, Math.round(toIndexRaw)))
      const [titleRule] = titleRules.splice(titleRuleIndex, 1)
      titleRules.splice(toIndex, 0, titleRule)
      break
    }
    default: {
      const error = new Error('不支持的规则操作')
      ;(error as { status?: number }).status = 400
      throw error
    }
  }

  const finalizedRules = finalizeRulesOrThrow(nextRules)
  await persistRuleToolsValues({ appMessageRules: finalizedRules })
  return {
    revision: getRulesRevision(finalizedRules),
    total: finalizedRules.length,
    groupId: createdGroupId,
    titleRuleId: createdTitleRuleId,
  }
}

function filterListItems(items: string[], q: string): string[] {
  const normalized = q.trim().toLowerCase()
  if (!normalized) return items
  return items.filter((item) => item.toLowerCase().includes(normalized))
}

export async function getRuleToolsListPage(input: {
  listKey: RuleToolsListKey
  q?: string
  limit?: number
  offset?: number
}): Promise<RuleToolsListResponse> {
  const state = await readRuleToolsState()
  const source = state[input.listKey]
  const limit = Number.isFinite(input.limit) ? Math.max(1, Math.min(ADMIN_LIST_MAX_PAGE_SIZE, Math.round(input.limit as number))) : ADMIN_LIST_DEFAULT_PAGE_SIZE
  const offset = Number.isFinite(input.offset) ? Math.max(0, Math.round(input.offset as number)) : 0
  const filtered = filterListItems(source, String(input.q ?? ''))
  return {
    items: filtered.slice(offset, offset + limit).map((value) => ({
      value,
      position: source.findIndex((item) => item.toLowerCase() === value.toLowerCase()),
    })),
    total: filtered.length,
    revision: getListRevision(input.listKey, source),
    limit,
    offset,
  }
}

export async function patchRuleToolsList(
  listKey: RuleToolsListKey,
  body: Record<string, unknown>,
): Promise<{ revision: string; total: number }> {
  const state = await readRuleToolsState()
  const current = [...state[listKey]]
  assertRevisionMatch(getListRevision(listKey, current), body.revision)

  const action = String(body.action ?? '').trim().toLowerCase()
  const currentValueKey = String(body.currentValue ?? '').trim().toLowerCase()
  const currentIndex = current.findIndex((item) => item.toLowerCase() === currentValueKey)

  switch (action) {
    case 'create': {
      const value = normalizeListValue(listKey, body.value)
      if (!value) {
        const error = new Error('条目内容不能为空')
        ;(error as { status?: number }).status = 400
        throw error
      }
      if (current.some((item) => item.toLowerCase() === value.toLowerCase())) {
        const error = new Error('条目已存在')
        ;(error as { status?: number }).status = 409
        throw error
      }
      current.push(value)
      break
    }
    case 'update': {
      if (currentIndex < 0) {
        const error = new Error('条目不存在')
        ;(error as { status?: number }).status = 404
        throw error
      }
      const nextValue = normalizeListValue(listKey, body.nextValue)
      if (!nextValue) {
        const error = new Error('条目内容不能为空')
        ;(error as { status?: number }).status = 400
        throw error
      }
      if (
        current.some(
          (item, index) => index !== currentIndex && item.toLowerCase() === nextValue.toLowerCase(),
        )
      ) {
        const error = new Error('条目已存在')
        ;(error as { status?: number }).status = 409
        throw error
      }
      current[currentIndex] = nextValue
      break
    }
    case 'delete': {
      if (currentIndex < 0) {
        const error = new Error('条目不存在')
        ;(error as { status?: number }).status = 404
        throw error
      }
      current.splice(currentIndex, 1)
      break
    }
    default: {
      const error = new Error('不支持的列表操作')
      ;(error as { status?: number }).status = 400
      throw error
    }
  }

  const normalized = normalizeRuleToolsList(listKey, current)
  await persistRuleToolsValues({ [listKey]: normalized })
  return {
    revision: getListRevision(listKey, normalized),
    total: normalized.length,
  }
}

export async function getRuleToolsExportPayload(): Promise<RuleToolsExportPayload> {
  const state = await readRuleToolsState()
  return {
    ...state.config,
    appMessageRules: stripAppMessageRuleIds(state.appMessageRules),
    appBlacklist: [...state.appBlacklist],
    appWhitelist: [...state.appWhitelist],
    appNameOnlyList: [...state.appNameOnlyList],
    mediaPlaySourceBlocklist: [...state.mediaPlaySourceBlocklist],
  }
}

export async function importRuleToolsPayload(
  body: Record<string, unknown>,
): Promise<RuleToolsSummary> {
  const appMessageRules = finalizeRulesOrThrow(normalizeAppMessageRules(body.appMessageRules))
  const nextState: RuleToolsState = {
    appMessageRules,
    appBlacklist: normalizeRuleToolsList('appBlacklist', body.appBlacklist),
    appWhitelist: normalizeRuleToolsList('appWhitelist', body.appWhitelist),
    appNameOnlyList: normalizeRuleToolsList('appNameOnlyList', body.appNameOnlyList),
    mediaPlaySourceBlocklist: normalizeRuleToolsList(
      'mediaPlaySourceBlocklist',
      body.mediaPlaySourceBlocklist,
    ),
    config: {
      appMessageRulesShowProcessName: body.appMessageRulesShowProcessName !== false,
      appFilterMode: normalizeFilterMode(body.appFilterMode),
      captureReportedAppsEnabled: body.captureReportedAppsEnabled !== false,
    },
  }

  await persistRuleToolsValues({
    appMessageRules: nextState.appMessageRules,
    appMessageRulesShowProcessName: nextState.config.appMessageRulesShowProcessName,
    appFilterMode: nextState.config.appFilterMode,
    appBlacklist: nextState.appBlacklist,
    appWhitelist: nextState.appWhitelist,
    appNameOnlyList: nextState.appNameOnlyList,
    captureReportedAppsEnabled: nextState.config.captureReportedAppsEnabled,
    mediaPlaySourceBlocklist: nextState.mediaPlaySourceBlocklist,
  })

  return buildRuleToolsSummary(nextState)
}
