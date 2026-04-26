'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAtom } from 'jotai'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useT } from 'next-i18next/client'
import { useDeferredValue, useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  getAdminPanelTransition,
  getAdminSectionVariants,
} from '@/components/admin/admin-motion'
import {
  exportAdminActivityApps,
  exportAdminRuleTools,
  fetchActivityHistoryApps,
  fetchActivityHistoryPlaySources,
} from '@/components/admin/admin-query-fetchers'
import { adminQueryKeys } from '@/components/admin/admin-query-keys'
import { importAdminRuleTools } from '@/components/admin/admin-query-mutations'
import { UnsavedChangesBar } from '@/components/admin/unsaved-changes-bar'
import {
  WebSettingsInset,
  WebSettingsRow,
  WebSettingsRows,
} from '@/components/admin/web-settings-layout'
import {
  listMaxPage,
  ListPaginationBar,
  SETTINGS_APP_LIST_PAGE_SIZE,
  SETTINGS_RULES_PAGE_SIZE,
} from '@/components/admin/web-settings-paging'
import { webSettingsMigrationAtom } from '@/components/admin/web-settings-store'
import { exportAppRulesJson, parseAppRulesJson } from '@/components/admin/web-settings-utils'
import { Autocomplete } from '@/components/ui/autocomplete'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  type AppMessageTitleRule,
  type AppTitleRuleMode,
  createAppMessageRuleGroupId,
  createAppMessageTitleRuleId,
  prepareAppMessageRulesForSave,
} from '@/lib/app-message-rules'
import { cn } from '@/lib/utils'
import type {
  AppMessageRuleGroup,
  RuleToolsExportPayload,
  RuleToolsListItem,
  RuleToolsListKey,
  RuleToolsRuleItem,
  RuleToolsSummary,
} from '@/types/rule-tools'

type ListEditingState = {
  listKey: RuleToolsListKey
  currentValue: string
  draftValue: string
}

function summarizeAppRuleGroup(
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

function cloneRuleToolsPayload(payload: RuleToolsExportPayload): RuleToolsExportPayload {
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

function buildRuleToolsSummary(payload: RuleToolsExportPayload): RuleToolsSummary {
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

function buildRuleItems(payload: RuleToolsExportPayload): RuleToolsRuleItem[] {
  return payload.appMessageRules.map((rule, position) => ({
    ...rule,
    position,
  }))
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

function filterListValues(values: string[], q: string): RuleToolsListItem[] {
  const normalized = q.trim().toLowerCase()
  return values
    .map((value, position) => ({ value, position }))
    .filter(
      (item) => item.value.length > 0 && (normalized ? item.value.toLowerCase().includes(normalized) : true),
    )
}

function normalizeDraftListValue(listKey: RuleToolsListKey, raw: string): string {
  const base = raw.trim()
  return listKey === 'mediaPlaySourceBlocklist' ? base.toLowerCase() : base
}

function dedupeDraftList(listKey: RuleToolsListKey, values: string[]): string[] {
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

function normalizePayloadForSave(
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

function areRuleToolsPayloadEqual(
  left: RuleToolsExportPayload | null,
  right: RuleToolsExportPayload | null,
): boolean {
  if (!left || !right) return left === right
  return JSON.stringify(left) === JSON.stringify(right)
}

function moveItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return [...items]
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  if (typeof item === "undefined") return next
  next.splice(toIndex, 0, item)
  return next
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

function getTitleRuleRegexErrorMessage(
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

function useHistoryAppSuggestions(query: string, enabled: boolean) {
  const deferredQuery = useDeferredValue(query)
  return useQuery({
    queryKey: adminQueryKeys.activity.historyApps({ q: deferredQuery, limit: 20 }),
    queryFn: () => fetchActivityHistoryApps({ q: deferredQuery, limit: 20 }),
    enabled,
  })
}

function useHistoryPlaySourceSuggestions(query: string, enabled: boolean) {
  const deferredQuery = useDeferredValue(query)
  return useQuery({
    queryKey: adminQueryKeys.activity.historyPlaySources({ q: deferredQuery, limit: 20 }),
    queryFn: () => fetchActivityHistoryPlaySources({ q: deferredQuery, limit: 20 }),
    enabled,
  })
}

function ListDialogEditor({
  description,
  emptyText,
  inputId,
  placeholder,
  suggestions,
  suggestionsEnabled,
  inputValue,
  onInputValueChange,
  onAdd,
  items,
  total,
  page,
  onPageChange,
  savedSearchValue,
  onSavedSearchValueChange,
  loading,
  refreshing,
  busy,
  editingItem,
  onEditingValueChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRemove,
  inputClassName,
}: {
  description: string
  emptyText: string
  inputId: string
  placeholder: string
  suggestions: string[]
  suggestionsEnabled: boolean
  inputValue: string
  onInputValueChange: (value: string) => void
  onAdd: () => Promise<void> | void
  items: RuleToolsListItem[]
  total: number
  page: number
  onPageChange: (page: number) => void
  savedSearchValue: string
  onSavedSearchValueChange: (value: string) => void
  loading: boolean
  refreshing: boolean
  busy: boolean
  editingItem: { currentValue: string; draftValue: string } | null
  onEditingValueChange: (value: string) => void
  onStartEdit: (value: string) => void
  onCancelEdit: () => void
  onSaveEdit: () => Promise<void> | void
  onRemove: (value: string) => Promise<void> | void
  inputClassName?: string
}) {
  const { t } = useT('admin')
  const prefersReducedMotion = Boolean(useReducedMotion())
  const sectionTransition = getAdminPanelTransition(prefersReducedMotion)
  const sectionVariants = getAdminSectionVariants(prefersReducedMotion, {
    enterY: 10,
    exitY: 8,
    scale: 0.996,
  })
  const hasSavedSearch = savedSearchValue.trim().length > 0

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="shrink-0 space-y-3">
        <p className="text-xs text-muted-foreground">{description}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Autocomplete
            id={inputId}
            items={suggestions}
            value={inputValue}
            onValueChange={onInputValueChange}
            placeholder={placeholder}
            inputClassName={inputClassName}
            showClear={false}
            emptyText={
              suggestionsEnabled
                ? t('webSettingsRuleTools.appNameListEditor.noMatchingHistory')
                : t('webSettingsRuleTools.appNameListEditor.historyDisabled')
            }
          />
          <Button
            type="button"
            className="shrink-0"
            disabled={busy || inputValue.trim().length === 0}
            onClick={() => void onAdd()}
          >
            {t('webSettingsRuleTools.appNameListEditor.add')}
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${inputId}-saved-search`}>{t('common.search')}</Label>
          <Input
            id={`${inputId}-saved-search`}
            value={savedSearchValue}
            onChange={(event) => onSavedSearchValueChange(event.target.value)}
            placeholder={t('webSettingsRuleTools.appNameListEditor.savedSearchPlaceholder')}
          />
          {refreshing ? (
            <p className="text-xs text-muted-foreground">{t('common.refreshing')}</p>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {loading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/30 px-6 py-8 text-center">
            <p className="text-xs text-muted-foreground">{t('webSettings.loading')}</p>
          </div>
        ) : total === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/30 px-6 py-8 text-center">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {hasSavedSearch
                ? t('webSettingsRuleTools.appNameListEditor.noSavedResults')
                : emptyText}
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
            <p className="shrink-0 text-xs text-muted-foreground">
              {t('webSettingsRuleTools.appNameListEditor.savedItemsPaged')}
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border/60 bg-background/20 p-3">
              <motion.ul className="space-y-3" layout>
                <AnimatePresence initial={false}>
                  {items.map((item) => {
                    const isEditing =
                      editingItem?.currentValue.toLowerCase() === item.value.toLowerCase()
                    return (
                      <motion.li
                        key={item.value.toLowerCase()}
                        className="rounded-md border bg-background/50 px-3 py-2.5"
                        variants={sectionVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={sectionTransition}
                        layout
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <Input
                              value={editingItem?.draftValue ?? ''}
                              onChange={(event) => onEditingValueChange(event.target.value)}
                              className={inputClassName}
                              placeholder={t('webSettingsRuleTools.appNameListEditor.renamePlaceholder')}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={busy || !(editingItem?.draftValue.trim() ?? '')}
                                onClick={() => void onSaveEdit()}
                              >
                                {t('common.save')}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={onCancelEdit}
                              >
                                {t('common.cancel')}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm break-all text-foreground">{item.value}</span>
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => onStartEdit(item.value)}
                              >
                                {t('common.edit')}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => void onRemove(item.value)}
                              >
                                {t('common.delete')}
                              </Button>
                            </div>
                          </div>
                        )}
                      </motion.li>
                    )
                  })}
                </AnimatePresence>
              </motion.ul>
            </div>
            <ListPaginationBar
              page={page}
              pageSize={SETTINGS_APP_LIST_PAGE_SIZE}
              total={total}
              onPageChange={onPageChange}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function WebSettingsRuleTools() {
  const { t } = useT('admin')
  const queryClient = useQueryClient()
  const [migration] = useAtom(webSettingsMigrationAtom)
  const prefersReducedMotion = Boolean(useReducedMotion())
  const sectionTransition = getAdminPanelTransition(prefersReducedMotion)
  const sectionVariants = getAdminSectionVariants(prefersReducedMotion, {
    enterY: 10,
    exitY: 8,
    scale: 0.996,
  })

  const [blacklistInput, setBlacklistInput] = useState('')
  const [whitelistInput, setWhitelistInput] = useState('')
  const [nameOnlyListInput, setNameOnlyListInput] = useState('')
  const [mediaSourceInput, setMediaSourceInput] = useState('')
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)
  const [groupListPage, setGroupListPage] = useState(0)
  const [ruleSearchInput, setRuleSearchInput] = useState('')
  const [blacklistListPage, setBlacklistListPage] = useState(0)
  const [blacklistSearchInput, setBlacklistSearchInput] = useState('')
  const [whitelistListPage, setWhitelistListPage] = useState(0)
  const [whitelistSearchInput, setWhitelistSearchInput] = useState('')
  const [nameOnlyListPage, setNameOnlyListPage] = useState(0)
  const [nameOnlyListSearchInput, setNameOnlyListSearchInput] = useState('')
  const [mediaSourceListPage, setMediaSourceListPage] = useState(0)
  const [mediaSourceSearchInput, setMediaSourceSearchInput] = useState('')
  const [dialogAppRulesOpen, setDialogAppRulesOpen] = useState(false)
  const [dialogAppRuleEditorOpen, setDialogAppRuleEditorOpen] = useState(false)
  const [dialogAppFilterOpen, setDialogAppFilterOpen] = useState(false)
  const [dialogNameOnlyOpen, setDialogNameOnlyOpen] = useState(false)
  const [dialogMediaSourceOpen, setDialogMediaSourceOpen] = useState(false)
  const [importRulesDialogOpen, setImportRulesDialogOpen] = useState(false)
  const [importRulesInput, setImportRulesInput] = useState('')
  const [editingListItem, setEditingListItem] = useState<ListEditingState | null>(null)
  const [savedPayload, setSavedPayload] = useState<RuleToolsExportPayload | null>(null)
  const [draftPayload, setDraftPayload] = useState<RuleToolsExportPayload | null>(null)

  const ruleToolsQuery = useQuery({
    queryKey: adminQueryKeys.ruleTools.export(),
    queryFn: exportAdminRuleTools,
  })
  const saveDraftMutation = useMutation({
    mutationFn: (payload: RuleToolsExportPayload) =>
      importAdminRuleTools(payload as Record<string, unknown>),
    onError: (error) => {
      toast.error(getErrorMessage(error, t('common.networkErrorRetry')))
    },
  })

  const committedPayload = savedPayload ?? ruleToolsQuery.data ?? null
  const draftDirty = useMemo(
    () => !areRuleToolsPayloadEqual(draftPayload ?? committedPayload, committedPayload),
    [committedPayload, draftPayload],
  )

  const currentPayload = draftPayload ?? committedPayload
  const currentSummary = useMemo(
    () => (currentPayload ? buildRuleToolsSummary(currentPayload) : null),
    [currentPayload],
  )
  const captureReportedAppsEnabled = currentPayload?.captureReportedAppsEnabled !== false
  const appFilterMode =
    currentPayload?.appFilterMode === 'whitelist' ? 'whitelist' : 'blacklist'
  const currentFilterModeLabel =
    appFilterMode === 'blacklist'
      ? t('webSettingsRuleTools.appFilter.blacklistMode')
      : t('webSettingsRuleTools.appFilter.whitelistMode')
  const heavyEditingLocked = migration?.heavyEditingLocked === true
  const busy = heavyEditingLocked || saveDraftMutation.isPending

  const ruleItems = useMemo(
    () => (currentPayload ? buildRuleItems(currentPayload) : []),
    [currentPayload],
  )
  const filteredRuleItems = useMemo(
    () => filterRuleItems(ruleItems, ruleSearchInput),
    [ruleItems, ruleSearchInput],
  )
  const resolvedGroupListPage = Math.min(
    groupListPage,
    listMaxPage(filteredRuleItems.length, SETTINGS_RULES_PAGE_SIZE),
  )
  const pagedRuleItems = useMemo(
    () =>
      filteredRuleItems.slice(
        resolvedGroupListPage * SETTINGS_RULES_PAGE_SIZE,
        (resolvedGroupListPage + 1) * SETTINGS_RULES_PAGE_SIZE,
      ),
    [filteredRuleItems, resolvedGroupListPage],
  )
  const previewItems = useMemo(() => ruleItems.slice(0, 3), [ruleItems])
  const previewTotal = currentSummary?.ruleGroupCount ?? 0
  const previewOverflow = Math.max(0, previewTotal - previewItems.length)

  const activeSelectedRuleId = useMemo(
    () =>
      selectedRuleId && ruleItems.some((item) => item.id === selectedRuleId)
        ? selectedRuleId
        : (ruleItems[0]?.id ?? null),
    [ruleItems, selectedRuleId],
  )
  const selectedRule = useMemo(
    () => ruleItems.find((item) => item.id === activeSelectedRuleId) ?? null,
    [activeSelectedRuleId, ruleItems],
  )

  const currentFilterListKey: RuleToolsListKey =
    appFilterMode === 'blacklist' ? 'appBlacklist' : 'appWhitelist'
  const currentFilterValues = useMemo(
    () => currentPayload?.[currentFilterListKey] ?? [],
    [currentFilterListKey, currentPayload],
  )
  const currentFilterSearchInput =
    currentFilterListKey === 'appBlacklist' ? blacklistSearchInput : whitelistSearchInput
  const currentFilterPageRaw =
    currentFilterListKey === 'appBlacklist' ? blacklistListPage : whitelistListPage
  const filteredCurrentFilterItems = useMemo(
    () => filterListValues(currentFilterValues, currentFilterSearchInput),
    [currentFilterSearchInput, currentFilterValues],
  )
  const currentFilterPage = Math.min(
    currentFilterPageRaw,
    listMaxPage(filteredCurrentFilterItems.length, SETTINGS_APP_LIST_PAGE_SIZE),
  )
  const pagedCurrentFilterItems = useMemo(
    () =>
      filteredCurrentFilterItems.slice(
        currentFilterPage * SETTINGS_APP_LIST_PAGE_SIZE,
        (currentFilterPage + 1) * SETTINGS_APP_LIST_PAGE_SIZE,
      ),
    [currentFilterPage, filteredCurrentFilterItems],
  )
  const filteredNameOnlyItems = useMemo(
    () => filterListValues(currentPayload?.appNameOnlyList ?? [], nameOnlyListSearchInput),
    [currentPayload?.appNameOnlyList, nameOnlyListSearchInput],
  )
  const resolvedNameOnlyListPage = Math.min(
    nameOnlyListPage,
    listMaxPage(filteredNameOnlyItems.length, SETTINGS_APP_LIST_PAGE_SIZE),
  )
  const pagedNameOnlyItems = useMemo(
    () =>
      filteredNameOnlyItems.slice(
        resolvedNameOnlyListPage * SETTINGS_APP_LIST_PAGE_SIZE,
        (resolvedNameOnlyListPage + 1) * SETTINGS_APP_LIST_PAGE_SIZE,
      ),
    [filteredNameOnlyItems, resolvedNameOnlyListPage],
  )
  const filteredMediaSourceItems = useMemo(
    () =>
      filterListValues(currentPayload?.mediaPlaySourceBlocklist ?? [], mediaSourceSearchInput),
    [currentPayload?.mediaPlaySourceBlocklist, mediaSourceSearchInput],
  )
  const resolvedMediaSourceListPage = Math.min(
    mediaSourceListPage,
    listMaxPage(filteredMediaSourceItems.length, SETTINGS_APP_LIST_PAGE_SIZE),
  )
  const pagedMediaSourceItems = useMemo(
    () =>
      filteredMediaSourceItems.slice(
        resolvedMediaSourceListPage * SETTINGS_APP_LIST_PAGE_SIZE,
        (resolvedMediaSourceListPage + 1) * SETTINGS_APP_LIST_PAGE_SIZE,
      ),
    [filteredMediaSourceItems, resolvedMediaSourceListPage],
  )

  const blacklistSuggestionsQuery = useHistoryAppSuggestions(
    blacklistInput,
    captureReportedAppsEnabled && dialogAppFilterOpen && appFilterMode === 'blacklist',
  )
  const whitelistSuggestionsQuery = useHistoryAppSuggestions(
    whitelistInput,
    captureReportedAppsEnabled && dialogAppFilterOpen && appFilterMode === 'whitelist',
  )
  const nameOnlySuggestionsQuery = useHistoryAppSuggestions(
    nameOnlyListInput,
    captureReportedAppsEnabled && dialogNameOnlyOpen,
  )
  const mediaSourceSuggestionsQuery = useHistoryPlaySourceSuggestions(
    mediaSourceInput,
    captureReportedAppsEnabled && dialogMediaSourceOpen,
  )
  const ruleProcessSuggestionsQuery = useHistoryAppSuggestions(
    selectedRule?.processMatch ?? '',
    captureReportedAppsEnabled && (dialogAppRuleEditorOpen || dialogAppRulesOpen),
  )

  const currentFilterSuggestions =
    currentFilterListKey === 'appBlacklist'
      ? (blacklistSuggestionsQuery.data ?? [])
      : (whitelistSuggestionsQuery.data ?? [])
  const currentFilterEditingItem =
    editingListItem?.listKey === currentFilterListKey
      ? {
          currentValue: editingListItem.currentValue,
          draftValue: editingListItem.draftValue,
        }
      : null

  const invalidateRuleToolsAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'rule-tools'] })
  }

  const persistRuleToolsPayload = async (
    payload: RuleToolsExportPayload,
    showSuccessToast = false,
  ): Promise<boolean> => {
    if (heavyEditingLocked) {
      toast.error(t('webSettingsMigration.lockedToast'))
      return false
    }
    const normalized = normalizePayloadForSave(payload)
    if (normalized.error) {
      toast.error(
        t('webSettingsRuleTools.appRules.invalidRegex', {
          group: normalized.error.group,
          rule: normalized.error.rule,
          message: normalized.error.message,
        }),
      )
      return false
    }
    try {
      await saveDraftMutation.mutateAsync(normalized.data)
      const committed = cloneRuleToolsPayload(normalized.data)
      setSavedPayload(cloneRuleToolsPayload(committed))
      setDraftPayload(null)
      queryClient.setQueryData(adminQueryKeys.ruleTools.export(), cloneRuleToolsPayload(committed))
      void invalidateRuleToolsAll()
      if (showSuccessToast) {
        toast.success(t('webSettingsRuleTools.toasts.saved'))
      }
      return true
    } catch {
      return false
    }
  }

  const updateDraftPayload = (
    updater: (current: RuleToolsExportPayload) => RuleToolsExportPayload,
  ) => {
    setDraftPayload((current) => {
      const base = current ?? committedPayload
      if (!base) return current
      const next = updater(cloneRuleToolsPayload(base))
      return areRuleToolsPayloadEqual(next, committedPayload) ? null : next
    })
  }

  const commitSinglePayloadChange = async (
    updater: (current: RuleToolsExportPayload) => RuleToolsExportPayload,
  ) => {
    const base = currentPayload
    if (!base) return
    if (draftDirty) {
      updateDraftPayload(updater)
      return
    }
    const previous = cloneRuleToolsPayload(base)
    const next = updater(cloneRuleToolsPayload(base))
    setSavedPayload(cloneRuleToolsPayload(next))
    setDraftPayload(null)
    const ok = await persistRuleToolsPayload(next)
    if (!ok) {
      setSavedPayload(cloneRuleToolsPayload(previous))
      setDraftPayload(null)
    }
  }

  const updateRuleDraft = (updater: (current: RuleToolsRuleItem) => RuleToolsRuleItem) => {
    if (!activeSelectedRuleId) return
    updateDraftPayload((current) => ({
      ...current,
      appMessageRules: current.appMessageRules.map((rule, position) =>
        rule.id === activeSelectedRuleId
          ? updater({
              ...rule,
              position,
              titleRules: rule.titleRules.map((titleRule) => ({ ...titleRule })),
            })
          : {
              ...rule,
              titleRules: rule.titleRules.map((titleRule) => ({ ...titleRule })),
            },
      ),
    }))
  }

  const updateTitleRuleDraft = (
    titleRuleId: string,
    updater: (current: AppMessageTitleRule) => AppMessageTitleRule,
  ) => {
    updateRuleDraft((current) => ({
      ...current,
      titleRules: current.titleRules.map((titleRule) =>
        titleRule.id === titleRuleId ? updater(titleRule) : titleRule,
      ),
    }))
  }

  const updateDraftList = (
    listKey: RuleToolsListKey,
    updater: (items: string[]) => string[],
  ) => {
    updateDraftPayload((current) => ({
      ...current,
      [listKey]: updater([...current[listKey]]),
    }))
  }

  const handleOpenRuleSelector = () => {
    if (!selectedRuleId && ruleItems[0]) {
      setSelectedRuleId(ruleItems[0].id)
    }
    setDialogAppRulesOpen(true)
  }

  const handleOpenRuleEditor = (ruleId: string) => {
    setSelectedRuleId(ruleId)
    setDialogAppRuleEditorOpen(false)
    setDialogAppRulesOpen(true)
  }

  const handleAppRuleEditorOpenChange = (open: boolean) => {
    setDialogAppRuleEditorOpen(open)
    if (!open) {
      setDialogAppRulesOpen(true)
    }
  }

  const openMobileRuleEditor = (rule: RuleToolsRuleItem) => {
    setSelectedRuleId(rule.id)
    setDialogAppRulesOpen(false)
    setDialogAppRuleEditorOpen(true)
  }

  const handleStartEditListItem = (listKey: RuleToolsListKey, value: string) => {
    setEditingListItem({
      listKey,
      currentValue: value,
      draftValue: value,
    })
  }

  const handleCancelEditListItem = () => {
    setEditingListItem(null)
  }

  const handleSaveEditedListItem = () => {
    if (!editingListItem) return
    const nextValue = normalizeDraftListValue(
      editingListItem.listKey,
      editingListItem.draftValue,
    )
    if (!nextValue) return
    updateDraftList(editingListItem.listKey, (items) => {
      const targetIndex = items.findIndex(
        (item) => item.toLowerCase() === editingListItem.currentValue.toLowerCase(),
      )
      if (targetIndex < 0) return items
      const duplicateIndex = items.findIndex(
        (item, index) =>
          index !== targetIndex && item.toLowerCase() === nextValue.toLowerCase(),
      )
      if (duplicateIndex >= 0) return items
      const next = [...items]
      next[targetIndex] = nextValue
      return next
    })
    setEditingListItem(null)
  }

  const handleRemoveListItem = (listKey: RuleToolsListKey, value: string) => {
    updateDraftList(listKey, (items) =>
      items.filter((item) => item.toLowerCase() !== value.toLowerCase()),
    )
    if (editingListItem?.listKey === listKey) {
      setEditingListItem(null)
    }
  }

  const handleAddFilterItem = () => {
    const listKey = currentFilterListKey
    const raw = listKey === 'appBlacklist' ? blacklistInput : whitelistInput
    const value = normalizeDraftListValue(listKey, raw)
    if (!value) return
    updateDraftList(listKey, (items) => {
      if (items.some((item) => item.toLowerCase() === value.toLowerCase())) return items
      return [...items, value]
    })
    if (listKey === 'appBlacklist') {
      setBlacklistInput('')
      setBlacklistSearchInput('')
      setBlacklistListPage(
        listMaxPage((currentPayload?.appBlacklist.length ?? 0) + 1, SETTINGS_APP_LIST_PAGE_SIZE),
      )
    } else {
      setWhitelistInput('')
      setWhitelistSearchInput('')
      setWhitelistListPage(
        listMaxPage((currentPayload?.appWhitelist.length ?? 0) + 1, SETTINGS_APP_LIST_PAGE_SIZE),
      )
    }
  }

  const handleAddNameOnlyItem = () => {
    const value = normalizeDraftListValue('appNameOnlyList', nameOnlyListInput)
    if (!value) return
    updateDraftList('appNameOnlyList', (items) => {
      if (items.some((item) => item.toLowerCase() === value.toLowerCase())) return items
      return [...items, value]
    })
    setNameOnlyListInput('')
    setNameOnlyListSearchInput('')
    setNameOnlyListPage(
      listMaxPage((currentPayload?.appNameOnlyList.length ?? 0) + 1, SETTINGS_APP_LIST_PAGE_SIZE),
    )
  }

  const handleAddMediaSourceItem = () => {
    const value = normalizeDraftListValue('mediaPlaySourceBlocklist', mediaSourceInput)
    if (!value) return
    updateDraftList('mediaPlaySourceBlocklist', (items) => {
      if (items.some((item) => item.toLowerCase() === value.toLowerCase())) return items
      return [...items, value]
    })
    setMediaSourceInput('')
    setMediaSourceSearchInput('')
    setMediaSourceListPage(
      listMaxPage(
        (currentPayload?.mediaPlaySourceBlocklist.length ?? 0) + 1,
        SETTINGS_APP_LIST_PAGE_SIZE,
      ),
    )
  }

  const handleAddRuleGroup = (openEditor = false) => {
    const nextId = createAppMessageRuleGroupId()
    updateDraftPayload((current) => ({
      ...current,
      appMessageRules: [
        ...current.appMessageRules,
        {
          id: nextId,
          processMatch: '',
          defaultText: undefined,
          titleRules: [],
        },
      ],
    }))
    setRuleSearchInput('')
    setGroupListPage(
      listMaxPage((currentPayload?.appMessageRules.length ?? 0) + 1, SETTINGS_RULES_PAGE_SIZE),
    )
    setSelectedRuleId(nextId)
    if (openEditor) {
      setDialogAppRulesOpen(false)
      setDialogAppRuleEditorOpen(true)
    }
  }

  const handleDeleteRuleGroup = (groupId: string) => {
    updateDraftPayload((current) => ({
      ...current,
      appMessageRules: current.appMessageRules.filter((rule) => rule.id !== groupId),
    }))
    if (selectedRuleId === groupId) {
      setSelectedRuleId(null)
    }
    if (dialogAppRuleEditorOpen) {
      setDialogAppRuleEditorOpen(false)
      setDialogAppRulesOpen(true)
    }
  }

  const handleMoveRuleGroup = (groupId: string, toIndex: number) => {
    updateDraftPayload((current) => {
      const fromIndex = current.appMessageRules.findIndex((rule) => rule.id === groupId)
      if (fromIndex < 0) return current
      return {
        ...current,
        appMessageRules: moveItem(current.appMessageRules, fromIndex, toIndex),
      }
    })
  }

  const handleAddTitleRule = () => {
    if (!selectedRule) return
    updateRuleDraft((current) => ({
      ...current,
      titleRules: [
        ...current.titleRules,
        {
          id: createAppMessageTitleRuleId(),
          mode: 'plain',
          pattern: '',
          text: '',
        },
      ],
    }))
  }

  const handleDeleteTitleRule = (titleRuleId: string) => {
    updateRuleDraft((current) => ({
      ...current,
      titleRules: current.titleRules.filter((item) => item.id !== titleRuleId),
    }))
  }

  const handleMoveTitleRule = (titleRuleId: string, toIndex: number) => {
    updateRuleDraft((current) => {
      const fromIndex = current.titleRules.findIndex((item) => item.id === titleRuleId)
      if (fromIndex < 0) return current
      return {
        ...current,
        titleRules: moveItem(current.titleRules, fromIndex, toIndex),
      }
    })
  }

  const handleTitleRuleModeChange = (titleRuleId: string, nextMode: AppTitleRuleMode) => {
    updateTitleRuleDraft(titleRuleId, (current) => ({
      ...current,
      mode: nextMode,
    }))
  }

  const copyRulesJson = async () => {
    try {
      const payload = currentPayload ?? (await exportAdminRuleTools())
      const json = exportAppRulesJson(payload)
      await navigator.clipboard.writeText(json)
      toast.success(t('webSettingsRuleTools.toasts.copiedRulesJson'))
    } catch (error) {
      toast.error(getErrorMessage(error, t('common.copyFailedBrowserPermission')))
    }
  }

  const exportUsedAppsJson = async () => {
    try {
      const payload = JSON.stringify(await exportAdminActivityApps(), null, 2)
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      const link = document.createElement('a')
      link.href = url
      link.download = `apps-export-${ts}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success(t('webSettingsRuleTools.toasts.exportedUsedAppsJson'))
    } catch (error) {
      toast.error(getErrorMessage(error, t('query.exportFailed')))
    }
  }

  const confirmImportRules = () => {
    const raw = importRulesInput.trim()
    if (!raw) {
      toast.error(t('webSettingsRuleTools.importDialog.pasteRulesJsonFirst'))
      return
    }
    const parsed = parseAppRulesJson(raw, (key) => t(`webSettingsRuleTools.parseErrors.${key}`))
    if (!parsed.ok) {
      toast.error(parsed.error)
      return
    }
    const imported = cloneRuleToolsPayload(parsed.data)
    setDraftPayload(areRuleToolsPayloadEqual(imported, committedPayload) ? null : imported)
    setSelectedRuleId(null)
    setImportRulesDialogOpen(false)
    setImportRulesInput('')
    setRuleSearchInput('')
    setBlacklistSearchInput('')
    setWhitelistSearchInput('')
    setNameOnlyListSearchInput('')
    setMediaSourceSearchInput('')
    toast.success(t('webSettingsRuleTools.toasts.importedRulesIntoForm'))
  }

  const handleRevertDraft = () => {
    if (!committedPayload) return
    setDraftPayload(null)
    setEditingListItem(null)
  }

  const handleSaveDraft = async () => {
    if (!draftPayload || !draftDirty) return
    await persistRuleToolsPayload(draftPayload, true)
  }

  const renderRulePreview = () => {
    if (ruleToolsQuery.isLoading && previewItems.length === 0) {
      return <p className="text-xs text-muted-foreground">{t('webSettings.loading')}</p>
    }
    if (previewItems.length === 0) {
      return (
        <p className="text-xs text-muted-foreground">
          {t('webSettingsRuleTools.appRules.noRules')}
        </p>
      )
    }

    return (
      <div className="space-y-3">
        <motion.ul className="space-y-3" layout>
          <AnimatePresence initial={false}>
            {previewItems.map((item) => (
              <motion.li
                key={item.id}
                className="rounded-xl border border-border/60 bg-background/70 px-3 py-3"
                variants={sectionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={sectionTransition}
                layout
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {t('webSettingsRuleTools.appRules.ruleIndex', {
                        index: item.position + 1,
                        total: previewTotal,
                      })}
                    </p>
                    <p className="text-sm leading-6 text-foreground">
                      {summarizeAppRuleGroup(item, t)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!currentPayload || busy}
                    onClick={() => handleOpenRuleEditor(item.id)}
                  >
                    {t('common.edit')}
                  </Button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
        {previewOverflow > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t('webSettingsRuleTools.appRules.moreRulesHint', { value: previewOverflow })}
          </p>
        ) : null}
      </div>
    )
  }

  const renderRuleGroupList = (mobile: boolean) => {
    const hasSearch = ruleSearchInput.trim().length > 0

    return (
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {t('webSettingsRuleTools.appRules.groupListTitle')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('webSettingsRuleTools.appRules.groupListDescription')}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            disabled={!currentPayload || busy}
            onClick={() => handleAddRuleGroup(mobile)}
          >
            {t('webSettingsRuleTools.appRules.addGroup')}
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor={mobile ? 'app-rule-search-mobile' : 'app-rule-search-desktop'}>
            {t('common.search')}
          </Label>
          <Input
            id={mobile ? 'app-rule-search-mobile' : 'app-rule-search-desktop'}
            value={ruleSearchInput}
            onChange={(event) => {
              setRuleSearchInput(event.target.value)
              setGroupListPage(0)
            }}
            placeholder={t('webSettingsRuleTools.appRules.searchPlaceholder')}
          />
          {ruleToolsQuery.isFetching && !ruleToolsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">{t('common.refreshing')}</p>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {ruleToolsQuery.isLoading && !currentPayload ? (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/30 px-6 py-8 text-center">
              <p className="text-xs text-muted-foreground">{t('webSettings.loading')}</p>
            </div>
          ) : pagedRuleItems.length === 0 ? (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/30 px-6 py-8 text-center">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {hasSearch
                  ? t('webSettingsRuleTools.appRules.noSearchResults')
                  : t('webSettingsRuleTools.appRules.noGroups')}
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border border-border/60 bg-background/20 p-3">
                {pagedRuleItems.map((item) => {
                  const isSelected = !mobile && activeSelectedRuleId === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        'w-full rounded-lg border px-3 py-3 text-left transition-colors',
                        isSelected
                          ? 'border-primary/60 bg-background shadow-sm'
                          : 'border-border/50 bg-background/60 hover:bg-background',
                      )}
                      onClick={() => {
                        if (mobile) {
                          openMobileRuleEditor(item)
                          return
                        }
                        setSelectedRuleId(item.id)
                      }}
                    >
                      <p className="text-xs font-medium text-foreground/80">
                        {t('webSettingsRuleTools.appRules.ruleIndex', {
                          index: item.position + 1,
                          total: currentSummary?.ruleGroupCount ?? 0,
                        })}
                      </p>
                      <p className="mt-1 break-all font-mono text-sm text-foreground">
                        {item.processMatch || t('webSettingsRuleTools.appRules.matchEmpty')}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {summarizeAppRuleGroup(item, t)}
                      </p>
                    </button>
                  )
                })}
              </div>
              <ListPaginationBar
                page={resolvedGroupListPage}
                pageSize={SETTINGS_RULES_PAGE_SIZE}
                total={filteredRuleItems.length}
                onPageChange={setGroupListPage}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderRuleGroupEditor = (mobile: boolean) => {
    if (ruleToolsQuery.isLoading && !selectedRule) {
      return <p className="text-xs text-muted-foreground">{t('webSettings.loading')}</p>
    }
    if (!selectedRule) {
      return (
        <div className="flex h-full min-h-[18rem] items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/30 px-6 py-8 text-center">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              {t('webSettingsRuleTools.appRules.emptyEditorTitle')}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t('webSettingsRuleTools.appRules.emptyEditorDescription')}
            </p>
            {mobile ? (
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <Button type="button" disabled={!currentPayload || busy} onClick={() => handleAddRuleGroup(true)}>
                  {t('webSettingsRuleTools.appRules.addGroup')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogAppRuleEditorOpen(false)
                    setDialogAppRulesOpen(true)
                  }}
                >
                  {t('webSettingsRuleTools.appRules.chooseAnotherGroup')}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )
    }

    const groupIndex = selectedRule.position
    const total = currentSummary?.ruleGroupCount ?? 0

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/[0.08] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {t('webSettingsRuleTools.appRules.groupEditorTitle')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('webSettingsRuleTools.appRules.ruleIndex', {
                  index: groupIndex + 1,
                  total,
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {mobile ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDialogAppRuleEditorOpen(false)
                    setDialogAppRulesOpen(true)
                  }}
                >
                  {t('webSettingsRuleTools.appRules.chooseAnotherGroup')}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy || selectedRule.position <= 0}
                onClick={() => handleMoveRuleGroup(selectedRule.id, selectedRule.position - 1)}
              >
                {t('webSettingsRuleTools.appRules.moveUp')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy || selectedRule.position >= total - 1}
                onClick={() => handleMoveRuleGroup(selectedRule.id, selectedRule.position + 1)}
              >
                {t('webSettingsRuleTools.appRules.moveDown')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => handleDeleteRuleGroup(selectedRule.id)}
              >
                {t('common.delete')}
              </Button>
            </div>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            {t('webSettingsRuleTools.appRules.groupEditorDescription')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rule-group-process-match">
            {t('webSettingsRuleTools.appRules.processMatchLabel')}
          </Label>
          <Autocomplete
            id="rule-group-process-match"
            items={ruleProcessSuggestionsQuery.data ?? []}
            value={selectedRule.processMatch}
            onValueChange={(value) =>
              updateRuleDraft((current) => ({
                ...current,
                processMatch: value,
              }))
            }
            placeholder={t('webSettingsRuleTools.appRules.processMatchPlaceholder')}
            inputClassName="font-mono"
            emptyText={
              captureReportedAppsEnabled
                ? t('webSettingsRuleTools.appRules.noMatchingHistoryApp')
                : t('webSettingsRuleTools.appNameListEditor.historyDisabled')
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rule-group-default-text">
            {t('webSettingsRuleTools.appRules.defaultTextLabel')}
          </Label>
          <Textarea
            id="rule-group-default-text"
            rows={3}
            value={selectedRule.defaultText ?? ''}
            onChange={(event) =>
              updateRuleDraft((current) => ({
                ...current,
                defaultText: event.target.value || undefined,
              }))
            }
            placeholder={t('webSettingsRuleTools.appRules.defaultTextPlaceholder')}
          />
          <p className="text-xs leading-6 text-muted-foreground">
            {t('webSettingsRuleTools.appRules.defaultTextDescription')}
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 bg-background/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {t('webSettingsRuleTools.appRules.titleRulesTitle')}
              </p>
              <p className="text-xs leading-6 text-muted-foreground">
                {t('webSettingsRuleTools.appRules.titleRulesDescription')}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={handleAddTitleRule}
            >
              {t('webSettingsRuleTools.appRules.addTitleRule')}
            </Button>
          </div>

          {selectedRule.titleRules.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t('webSettingsRuleTools.appRules.noTitleRules')}
            </p>
          ) : (
            <motion.ul className="space-y-3" layout>
              <AnimatePresence initial={false}>
                {selectedRule.titleRules.map((titleRule, index) => {
                  const isFirst = index <= 0
                  const isLast = index >= selectedRule.titleRules.length - 1
                  const regexError = getTitleRuleRegexErrorMessage(
                    titleRule,
                    groupIndex,
                    index,
                    t,
                  )
                  return (
                    <motion.li
                      key={titleRule.id}
                      className="rounded-xl border border-border/60 bg-muted/[0.04] p-4"
                      variants={sectionVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={sectionTransition}
                      layout
                    >
                      <div className="space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              {t('webSettingsRuleTools.appRules.titleRuleIndex', {
                                index: index + 1,
                                total: selectedRule.titleRules.length,
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {titleRule.mode === 'regex'
                                ? t('webSettingsRuleTools.appRules.titleRuleModeRegexDescription')
                                : t('webSettingsRuleTools.appRules.titleRuleModePlainDescription')}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy || isFirst}
                              onClick={() => handleMoveTitleRule(titleRule.id, index - 1)}
                            >
                              {t('webSettingsRuleTools.appRules.moveUp')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy || isLast}
                              onClick={() => handleMoveTitleRule(titleRule.id, index + 1)}
                            >
                              {t('webSettingsRuleTools.appRules.moveDown')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => handleDeleteTitleRule(titleRule.id)}
                            >
                              {t('common.delete')}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>{t('webSettingsRuleTools.appRules.titleRuleModeLabel')}</Label>
                          <RadioGroup
                            value={titleRule.mode}
                            onValueChange={(value) => {
                              const nextMode: AppTitleRuleMode =
                                value === 'regex' ? 'regex' : 'plain'
                              handleTitleRuleModeChange(titleRule.id, nextMode)
                            }}
                            className="grid gap-3 sm:grid-cols-2"
                          >
                            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-3">
                              <RadioGroupItem value="plain" id={`${titleRule.id}-plain`} />
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">
                                  {t('webSettingsRuleTools.appRules.titleRuleModePlain')}
                                </p>
                                <p className="text-xs leading-6 text-muted-foreground">
                                  {t('webSettingsRuleTools.appRules.titleRuleModePlainDescription')}
                                </p>
                              </div>
                            </label>
                            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-3">
                              <RadioGroupItem value="regex" id={`${titleRule.id}-regex`} />
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">
                                  {t('webSettingsRuleTools.appRules.titleRuleModeRegex')}
                                </p>
                                <p className="text-xs leading-6 text-muted-foreground">
                                  {t('webSettingsRuleTools.appRules.titleRuleModeRegexDescription')}
                                </p>
                              </div>
                            </label>
                          </RadioGroup>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${titleRule.id}-pattern`}>
                            {t('webSettingsRuleTools.appRules.titleRulePatternLabel')}
                          </Label>
                          <Input
                            id={`${titleRule.id}-pattern`}
                            value={titleRule.pattern}
                            onChange={(event) =>
                              updateTitleRuleDraft(titleRule.id, (current) => ({
                                ...current,
                                pattern: event.target.value,
                              }))
                            }
                            className="font-mono"
                            placeholder={
                              titleRule.mode === 'regex'
                                ? t('webSettingsRuleTools.appRules.titleRulePatternRegexPlaceholder')
                                : t('webSettingsRuleTools.appRules.titleRulePatternPlainPlaceholder')
                            }
                          />
                          {regexError ? (
                            <p className="text-xs leading-6 text-destructive">{regexError}</p>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${titleRule.id}-text`}>
                            {t('webSettingsRuleTools.appRules.titleRuleTextLabel')}
                          </Label>
                          <Textarea
                            id={`${titleRule.id}-text`}
                            rows={2}
                            value={titleRule.text}
                            onChange={(event) =>
                              updateTitleRuleDraft(titleRule.id, (current) => ({
                                ...current,
                                text: event.target.value,
                              }))
                            }
                            placeholder={t('webSettingsRuleTools.appRules.titleRuleTextPlaceholder')}
                          />
                        </div>
                      </div>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </motion.ul>
          )}
        </div>

        <p className="text-xs leading-6 text-muted-foreground">
          {t('webSettingsRuleTools.appRules.helpText', {
            process: '{process}',
            title: '{title}',
          })}
        </p>
      </div>
    )
  }

  if (ruleToolsQuery.isLoading && !currentPayload) {
    return <div className="text-sm text-muted-foreground">{t('webSettings.loading')}</div>
  }
  if (ruleToolsQuery.isError && !currentPayload) {
    return (
      <div className="text-sm text-destructive">
        {getErrorMessage(ruleToolsQuery.error, t('common.networkErrorRetry'))}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4 sm:rounded-xl sm:border sm:border-border/60 sm:bg-muted/[0.05] sm:p-5">
        <div className="space-y-4">
          <WebSettingsInset className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {t('webSettingsRuleTools.appRules.title')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('webSettingsRuleTools.appRules.savedCount', {
                    value: currentSummary?.ruleGroupCount ?? 0,
                  })}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!currentPayload || busy}
                onClick={handleOpenRuleSelector}
              >
                {t('webSettingsRuleTools.editInDialog')}
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-xs leading-6 text-muted-foreground">
                {t('webSettingsRuleTools.appRules.dialogDescription')}
              </p>
              <p className="text-xs font-medium tracking-wide text-muted-foreground">
                {t('webSettingsRuleTools.appRules.previewTop3')}
              </p>
              {renderRulePreview()}
            </div>
          </WebSettingsInset>

          <WebSettingsRows>
            <WebSettingsRow
              htmlFor="rule-tools-show-process-name"
              title={t('webSettingsRuleTools.appRules.showProcessNameTitle')}
              description={t('webSettingsRuleTools.appRules.showProcessNameDescription')}
              action={
                <Switch
                  id="rule-tools-show-process-name"
                  checked={currentPayload?.appMessageRulesShowProcessName ?? true}
                  disabled={!currentPayload || busy}
                  onCheckedChange={(value) => {
                    void commitSinglePayloadChange((current) => ({
                      ...current,
                      appMessageRulesShowProcessName: value,
                    }))
                  }}
                />
              }
            />
            <WebSettingsRow
              htmlFor="rule-tools-capture-reported-apps"
              title={t('webSettingsRuleTools.captureReportedApps.title')}
              description={t('webSettingsRuleTools.captureReportedApps.description')}
              action={
                <Switch
                  id="rule-tools-capture-reported-apps"
                  checked={captureReportedAppsEnabled}
                  disabled={!currentPayload || busy}
                  onCheckedChange={(value) => {
                    void commitSinglePayloadChange((current) => ({
                      ...current,
                      captureReportedAppsEnabled: value,
                    }))
                  }}
                />
              }
            />
            <WebSettingsRow
              title={t('webSettingsRuleTools.appFilter.title')}
              description={
                <>
                  <div>
                    {t('webSettingsRuleTools.appFilter.summary', {
                      mode: currentFilterModeLabel,
                      blacklist: currentSummary?.appBlacklistCount ?? 0,
                      whitelist: currentSummary?.appWhitelistCount ?? 0,
                    })}
                  </div>
                  <div className="pt-1">
                    {appFilterMode === 'blacklist'
                      ? t('webSettingsRuleTools.appFilter.blacklistDescription')
                      : t('webSettingsRuleTools.appFilter.whitelistDescription')}
                  </div>
                </>
              }
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!currentPayload || busy}
                  onClick={() => setDialogAppFilterOpen(true)}
                >
                  {t('webSettingsRuleTools.editInDialog')}
                </Button>
              }
            />
            <WebSettingsRow
              title={t('webSettingsRuleTools.nameOnly.title')}
              description={t('webSettingsRuleTools.nameOnly.count', {
                value: currentSummary?.appNameOnlyListCount ?? 0,
              })}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!currentPayload || busy}
                  onClick={() => setDialogNameOnlyOpen(true)}
                >
                  {t('webSettingsRuleTools.editInDialog')}
                </Button>
              }
            />
            <WebSettingsRow
              title={t('webSettingsRuleTools.mediaSource.title')}
              description={t('webSettingsRuleTools.mediaSource.count', {
                value: currentSummary?.mediaPlaySourceBlocklistCount ?? 0,
              })}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!currentPayload || busy}
                  onClick={() => setDialogMediaSourceOpen(true)}
                >
                  {t('webSettingsRuleTools.editInDialog')}
                </Button>
              }
            />
          </WebSettingsRows>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => void exportUsedAppsJson()}>
              {t('webSettingsRuleTools.actions.exportUsedAppsJson')}
            </Button>
            <Button type="button" variant="outline" onClick={() => void copyRulesJson()}>
              {t('webSettingsRuleTools.actions.copyRulesJson')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!currentPayload || busy}
              onClick={() => setImportRulesDialogOpen(true)}
            >
              {t('webSettingsRuleTools.actions.importRulesJson')}
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={dialogAppRulesOpen}
        onOpenChange={(open) => {
          setDialogAppRulesOpen(open)
          if (!open) setEditingListItem(null)
        }}
      >
        <DialogContent
          className="flex h-[calc(100vh-1rem)] max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:h-[min(90vh,56rem)] sm:max-h-[min(90vh,56rem)] sm:w-[calc(100vw-1.5rem)] sm:max-w-5xl"
          showCloseButton
        >
          <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-4 pr-12 text-left sm:px-6">
            <DialogTitle>{t('webSettingsRuleTools.appRules.title')}</DialogTitle>
            <DialogDescription>
              <span className="md:hidden">
                {t('webSettingsRuleTools.appRules.selectorDescription')}
              </span>
              <span className="hidden md:inline">
                {t('webSettingsRuleTools.appRules.dialogDescription')}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden px-4 py-4 sm:px-6 md:hidden">
            {renderRuleGroupList(true)}
          </div>
          <div className="hidden min-h-0 flex-1 overflow-hidden md:grid md:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
            <div className="min-h-0 border-r px-6 py-4">{renderRuleGroupList(false)}</div>
            <div className="min-h-0 overflow-y-auto px-6 py-4">{renderRuleGroupEditor(false)}</div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogAppRuleEditorOpen} onOpenChange={handleAppRuleEditorOpenChange}>
        <DialogContent
          className="flex max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 md:hidden"
          showCloseButton
        >
          <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-4 pr-12 text-left sm:px-6">
            <DialogTitle>{t('webSettingsRuleTools.appRules.groupEditorTitle')}</DialogTitle>
            <DialogDescription>
              {t('webSettingsRuleTools.appRules.groupEditorDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {renderRuleGroupEditor(true)}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogAppFilterOpen}
        onOpenChange={(open) => {
          setDialogAppFilterOpen(open)
          if (!open) setEditingListItem(null)
        }}
      >
        <DialogContent className="flex h-[calc(100vh-1rem)] max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:h-[min(90vh,56rem)] sm:max-h-[min(90vh,56rem)] sm:w-[calc(100vw-1.5rem)]">
          <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-4 pr-12 text-left sm:px-6">
            <DialogTitle>{t('webSettingsRuleTools.appFilter.title')}</DialogTitle>
            <DialogDescription>
              {t('webSettingsRuleTools.appFilter.dialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden px-4 py-4 sm:px-6">
            <div className="flex h-full min-h-0 flex-col gap-4">
              <RadioGroup
                value={appFilterMode}
                disabled={busy}
                onValueChange={(value) => {
                  if (value !== 'blacklist' && value !== 'whitelist') return
                  setEditingListItem(null)
                  updateDraftPayload((current) => ({
                    ...current,
                    appFilterMode: value,
                  }))
                }}
                className="grid gap-3 sm:grid-cols-2"
              >
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-4">
                  <RadioGroupItem value="blacklist" id="rule-tools-filter-blacklist" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {t('webSettingsRuleTools.appFilter.blacklistMode')}
                    </p>
                    <p className="text-xs leading-6 text-muted-foreground">
                      {t('webSettingsRuleTools.appFilter.blacklistDescription')}
                    </p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-4">
                  <RadioGroupItem value="whitelist" id="rule-tools-filter-whitelist" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {t('webSettingsRuleTools.appFilter.whitelistMode')}
                    </p>
                    <p className="text-xs leading-6 text-muted-foreground">
                      {t('webSettingsRuleTools.appFilter.whitelistDescription')}
                    </p>
                  </div>
                </label>
              </RadioGroup>

              <ListDialogEditor
                description={
                  appFilterMode === 'blacklist'
                    ? t('webSettingsRuleTools.appFilter.blacklistInputDescription')
                    : t('webSettingsRuleTools.appFilter.whitelistInputDescription')
                }
                emptyText={
                  appFilterMode === 'blacklist'
                    ? t('webSettingsRuleTools.appFilter.blacklistEmpty')
                    : t('webSettingsRuleTools.appFilter.whitelistEmpty')
                }
                inputId="rule-tools-filter-list"
                placeholder={
                  appFilterMode === 'blacklist'
                    ? t('webSettingsRuleTools.appFilter.blacklistPlaceholder')
                    : t('webSettingsRuleTools.appFilter.whitelistPlaceholder')
                }
                suggestions={currentFilterSuggestions}
                suggestionsEnabled={captureReportedAppsEnabled}
                inputValue={
                  currentFilterListKey === 'appBlacklist' ? blacklistInput : whitelistInput
                }
                onInputValueChange={
                  currentFilterListKey === 'appBlacklist' ? setBlacklistInput : setWhitelistInput
                }
                onAdd={handleAddFilterItem}
                items={pagedCurrentFilterItems}
                total={filteredCurrentFilterItems.length}
                page={currentFilterPage}
                onPageChange={
                  currentFilterListKey === 'appBlacklist'
                    ? setBlacklistListPage
                    : setWhitelistListPage
                }
                savedSearchValue={currentFilterSearchInput}
                onSavedSearchValueChange={(value) => {
                  if (currentFilterListKey === 'appBlacklist') {
                    setBlacklistSearchInput(value)
                    setBlacklistListPage(0)
                  } else {
                    setWhitelistSearchInput(value)
                    setWhitelistListPage(0)
                  }
                }}
                loading={ruleToolsQuery.isLoading && !currentPayload}
                refreshing={ruleToolsQuery.isFetching && !ruleToolsQuery.isLoading}
                busy={busy}
                editingItem={currentFilterEditingItem}
                onEditingValueChange={(value) =>
                  setEditingListItem((current) =>
                    current ? { ...current, draftValue: value } : current,
                  )
                }
                onStartEdit={(value) => handleStartEditListItem(currentFilterListKey, value)}
                onCancelEdit={handleCancelEditListItem}
                onSaveEdit={handleSaveEditedListItem}
                onRemove={(value) => handleRemoveListItem(currentFilterListKey, value)}
                inputClassName="font-mono"
              />
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t px-4 py-4 sm:px-6">
            <Button type="button" variant="outline" onClick={() => setDialogAppFilterOpen(false)}>
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogNameOnlyOpen}
        onOpenChange={(open) => {
          setDialogNameOnlyOpen(open)
          if (!open) setEditingListItem(null)
        }}
      >
        <DialogContent className="flex h-[calc(100vh-1rem)] max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:h-[min(90vh,56rem)] sm:max-h-[min(90vh,56rem)] sm:w-[calc(100vw-1.5rem)]">
          <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-4 pr-12 text-left sm:px-6">
            <DialogTitle>{t('webSettingsRuleTools.nameOnly.title')}</DialogTitle>
            <DialogDescription>
              {t('webSettingsRuleTools.nameOnly.dialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden px-4 py-4 sm:px-6">
            <ListDialogEditor
              description={t('webSettingsRuleTools.nameOnly.inputDescription')}
              emptyText={t('webSettingsRuleTools.nameOnly.empty')}
              inputId="rule-tools-name-only"
              placeholder={t('webSettingsRuleTools.nameOnly.placeholder')}
              suggestions={nameOnlySuggestionsQuery.data ?? []}
              suggestionsEnabled={captureReportedAppsEnabled}
              inputValue={nameOnlyListInput}
              onInputValueChange={setNameOnlyListInput}
              onAdd={handleAddNameOnlyItem}
              items={pagedNameOnlyItems}
              total={filteredNameOnlyItems.length}
              page={resolvedNameOnlyListPage}
              onPageChange={setNameOnlyListPage}
              savedSearchValue={nameOnlyListSearchInput}
              onSavedSearchValueChange={(value) => {
                setNameOnlyListSearchInput(value)
                setNameOnlyListPage(0)
              }}
              loading={ruleToolsQuery.isLoading && !currentPayload}
              refreshing={ruleToolsQuery.isFetching && !ruleToolsQuery.isLoading}
              busy={busy}
              editingItem={
                editingListItem?.listKey === 'appNameOnlyList'
                  ? {
                      currentValue: editingListItem.currentValue,
                      draftValue: editingListItem.draftValue,
                    }
                  : null
              }
              onEditingValueChange={(value) =>
                setEditingListItem((current) =>
                  current ? { ...current, draftValue: value } : current,
                )
              }
              onStartEdit={(value) => handleStartEditListItem('appNameOnlyList', value)}
              onCancelEdit={handleCancelEditListItem}
              onSaveEdit={handleSaveEditedListItem}
              onRemove={(value) => handleRemoveListItem('appNameOnlyList', value)}
              inputClassName="font-mono"
            />
          </div>
          <DialogFooter className="shrink-0 border-t px-4 py-4 sm:px-6">
            <Button type="button" variant="outline" onClick={() => setDialogNameOnlyOpen(false)}>
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogMediaSourceOpen}
        onOpenChange={(open) => {
          setDialogMediaSourceOpen(open)
          if (!open) setEditingListItem(null)
        }}
      >
        <DialogContent className="flex h-[calc(100vh-1rem)] max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:h-[min(90vh,56rem)] sm:max-h-[min(90vh,56rem)] sm:w-[calc(100vw-1.5rem)]">
          <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-4 pr-12 text-left sm:px-6">
            <DialogTitle>{t('webSettingsRuleTools.mediaSource.title')}</DialogTitle>
            <DialogDescription>
              {t('webSettingsRuleTools.mediaSource.dialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden px-4 py-4 sm:px-6">
            <ListDialogEditor
              description={t('webSettingsRuleTools.mediaSource.inputDescription')}
              emptyText={t('webSettingsRuleTools.mediaSource.empty')}
              inputId="rule-tools-media-source"
              placeholder={t('webSettingsRuleTools.mediaSource.placeholder')}
              suggestions={mediaSourceSuggestionsQuery.data ?? []}
              suggestionsEnabled={captureReportedAppsEnabled}
              inputValue={mediaSourceInput}
              onInputValueChange={setMediaSourceInput}
              onAdd={handleAddMediaSourceItem}
              items={pagedMediaSourceItems}
              total={filteredMediaSourceItems.length}
              page={resolvedMediaSourceListPage}
              onPageChange={setMediaSourceListPage}
              savedSearchValue={mediaSourceSearchInput}
              onSavedSearchValueChange={(value) => {
                setMediaSourceSearchInput(value)
                setMediaSourceListPage(0)
              }}
              loading={ruleToolsQuery.isLoading && !currentPayload}
              refreshing={ruleToolsQuery.isFetching && !ruleToolsQuery.isLoading}
              busy={busy}
              editingItem={
                editingListItem?.listKey === 'mediaPlaySourceBlocklist'
                  ? {
                      currentValue: editingListItem.currentValue,
                      draftValue: editingListItem.draftValue,
                    }
                  : null
              }
              onEditingValueChange={(value) =>
                setEditingListItem((current) =>
                  current ? { ...current, draftValue: value } : current,
                )
              }
              onStartEdit={(value) =>
                handleStartEditListItem('mediaPlaySourceBlocklist', value)
              }
              onCancelEdit={handleCancelEditListItem}
              onSaveEdit={handleSaveEditedListItem}
              onRemove={(value) => handleRemoveListItem('mediaPlaySourceBlocklist', value)}
              inputClassName="font-mono"
            />
          </div>
          <DialogFooter className="shrink-0 border-t px-4 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogMediaSourceOpen(false)}
            >
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importRulesDialogOpen} onOpenChange={setImportRulesDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('webSettingsRuleTools.importDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('webSettingsRuleTools.importDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="import-rules-input">{t('webSettingsRuleTools.importDialog.label')}</Label>
            <Textarea
              id="import-rules-input"
              rows={14}
              value={importRulesInput}
              onChange={(event) => setImportRulesInput(event.target.value)}
              placeholder={t('webSettingsRuleTools.importDialog.placeholder')}
              className="font-mono text-xs"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setImportRulesDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="button" disabled={busy} onClick={confirmImportRules}>
              {t('webSettingsRuleTools.importDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UnsavedChangesBar
        open={draftDirty}
        saving={saveDraftMutation.isPending}
        saveDisabled={heavyEditingLocked || !draftPayload}
        message={heavyEditingLocked ? t('webSettingsMigration.lockedMessage') : undefined}
        onSave={handleSaveDraft}
        onRevert={handleRevertDraft}
      />
    </>
  )
}
