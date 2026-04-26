'use client'

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useT } from 'next-i18next/client'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
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
  fetchAdminRuleToolsConfig,
  fetchAdminRuleToolsListPage,
  fetchAdminRuleToolsRulesPage,
  fetchAdminRuleToolsSummary,
} from '@/components/admin/admin-query-fetchers'
import { adminQueryKeys } from '@/components/admin/admin-query-keys'
import {
  importAdminRuleTools,
  patchAdminRuleToolsConfig,
  patchAdminRuleToolsList,
  patchAdminRuleToolsRules,
} from '@/components/admin/admin-query-mutations'
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
import type {
  AppMessageRuleGroup,
  AppMessageTitleRule,
  AppTitleRuleMode,
} from '@/lib/app-message-rules'
import { cn } from '@/lib/utils'
import type {
  RuleToolsConfigResponse,
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

function cloneRuleItem(rule: RuleToolsRuleItem): RuleToolsRuleItem {
  return {
    ...rule,
    titleRules: rule.titleRules.map((titleRule) => ({ ...titleRule })),
  }
}

function moveItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return [...items]
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  if (typeof item === 'undefined') return next
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
  if (titleRule.mode !== 'regex' || !titleRule.pattern.trim()) {
    return null
  }
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
  const [ruleDraft, setRuleDraft] = useState<RuleToolsRuleItem | null>(null)
  const [selectedRuleSnapshot, setSelectedRuleSnapshot] = useState<RuleToolsRuleItem | null>(null)

  const deferredRuleSearch = useDeferredValue(ruleSearchInput)
  const deferredBlacklistSearch = useDeferredValue(blacklistSearchInput)
  const deferredWhitelistSearch = useDeferredValue(whitelistSearchInput)
  const deferredNameOnlySearch = useDeferredValue(nameOnlyListSearchInput)
  const deferredMediaSourceSearch = useDeferredValue(mediaSourceSearchInput)

  const configRevisionRef = useRef('')
  const rulesRevisionRef = useRef('')
  const listRevisionRef = useRef<Record<RuleToolsListKey, string>>({
    appBlacklist: '',
    appWhitelist: '',
    appNameOnlyList: '',
    mediaPlaySourceBlocklist: '',
  })

  const summaryQuery = useQuery({
    queryKey: adminQueryKeys.ruleTools.summary(),
    queryFn: fetchAdminRuleToolsSummary,
  })
  const configQuery = useQuery({
    queryKey: adminQueryKeys.ruleTools.config(),
    queryFn: fetchAdminRuleToolsConfig,
  })
  const rulesPreviewQuery = useQuery({
    queryKey: adminQueryKeys.ruleTools.rulesPreview(),
    queryFn: () =>
      fetchAdminRuleToolsRulesPage({
        page: 0,
        q: '',
        pageSize: 3,
      }),
  })
  const rulesQuery = useQuery({
    queryKey: adminQueryKeys.ruleTools.rules({
      q: deferredRuleSearch,
      page: groupListPage,
      pageSize: SETTINGS_RULES_PAGE_SIZE,
    }),
    queryFn: () =>
      fetchAdminRuleToolsRulesPage({
        page: groupListPage,
        q: deferredRuleSearch,
        pageSize: SETTINGS_RULES_PAGE_SIZE,
      }),
    enabled: dialogAppRulesOpen || dialogAppRuleEditorOpen,
    placeholderData: keepPreviousData,
  })

  const currentConfig = configQuery.data
  const currentSummary = summaryQuery.data
  const captureReportedAppsEnabled =
    currentConfig?.captureReportedAppsEnabled ??
    currentSummary?.captureReportedAppsEnabled ??
    true
  const appFilterMode =
    currentConfig?.appFilterMode ?? currentSummary?.appFilterMode ?? 'blacklist'

  const blacklistQuery = useQuery({
    queryKey: adminQueryKeys.ruleTools.list({
      listKey: 'appBlacklist',
      q: deferredBlacklistSearch,
      page: blacklistListPage,
      pageSize: SETTINGS_APP_LIST_PAGE_SIZE,
    }),
    queryFn: () =>
      fetchAdminRuleToolsListPage({
        listKey: 'appBlacklist',
        page: blacklistListPage,
        q: deferredBlacklistSearch,
        pageSize: SETTINGS_APP_LIST_PAGE_SIZE,
      }),
    enabled: dialogAppFilterOpen && appFilterMode === 'blacklist',
    placeholderData: keepPreviousData,
  })
  const whitelistQuery = useQuery({
    queryKey: adminQueryKeys.ruleTools.list({
      listKey: 'appWhitelist',
      q: deferredWhitelistSearch,
      page: whitelistListPage,
      pageSize: SETTINGS_APP_LIST_PAGE_SIZE,
    }),
    queryFn: () =>
      fetchAdminRuleToolsListPage({
        listKey: 'appWhitelist',
        page: whitelistListPage,
        q: deferredWhitelistSearch,
        pageSize: SETTINGS_APP_LIST_PAGE_SIZE,
      }),
    enabled: dialogAppFilterOpen && appFilterMode === 'whitelist',
    placeholderData: keepPreviousData,
  })
  const nameOnlyListQuery = useQuery({
    queryKey: adminQueryKeys.ruleTools.list({
      listKey: 'appNameOnlyList',
      q: deferredNameOnlySearch,
      page: nameOnlyListPage,
      pageSize: SETTINGS_APP_LIST_PAGE_SIZE,
    }),
    queryFn: () =>
      fetchAdminRuleToolsListPage({
        listKey: 'appNameOnlyList',
        page: nameOnlyListPage,
        q: deferredNameOnlySearch,
        pageSize: SETTINGS_APP_LIST_PAGE_SIZE,
      }),
    enabled: dialogNameOnlyOpen,
    placeholderData: keepPreviousData,
  })
  const mediaSourceListQuery = useQuery({
    queryKey: adminQueryKeys.ruleTools.list({
      listKey: 'mediaPlaySourceBlocklist',
      q: deferredMediaSourceSearch,
      page: mediaSourceListPage,
      pageSize: SETTINGS_APP_LIST_PAGE_SIZE,
    }),
    queryFn: () =>
      fetchAdminRuleToolsListPage({
        listKey: 'mediaPlaySourceBlocklist',
        page: mediaSourceListPage,
        q: deferredMediaSourceSearch,
        pageSize: SETTINGS_APP_LIST_PAGE_SIZE,
      }),
    enabled: dialogMediaSourceOpen,
    placeholderData: keepPreviousData,
  })
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

  const patchSummaryCache = (updater: (current: RuleToolsSummary) => RuleToolsSummary) => {
    queryClient.setQueryData<RuleToolsSummary | undefined>(
      adminQueryKeys.ruleTools.summary(),
      (current) => (current ? updater(current) : current),
    )
  }

  const invalidateRuleToolsAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.ruleTools.summary() }),
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.ruleTools.config() }),
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.ruleTools.rulesPreview() }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'rule-tools', 'rules'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'rule-tools', 'list'] }),
    ])
  }

  const configMutation = useMutation({
    mutationFn: patchAdminRuleToolsConfig,
    onSuccess: (data) => {
      configRevisionRef.current = data.revision
      queryClient.setQueryData(adminQueryKeys.ruleTools.config(), data)
      patchSummaryCache((current) => ({
        ...current,
        appFilterMode: data.appFilterMode,
        captureReportedAppsEnabled: data.captureReportedAppsEnabled,
        appMessageRulesShowProcessName: data.appMessageRulesShowProcessName,
      }))
      void queryClient.invalidateQueries({ queryKey: adminQueryKeys.ruleTools.summary() })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t('common.networkErrorRetry')))
    },
  })

  const rulesMutation = useMutation({
    mutationFn: patchAdminRuleToolsRules,
    onSuccess: (data) => {
      rulesRevisionRef.current = data.revision
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.ruleTools.summary() }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.ruleTools.rulesPreview() }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'rule-tools', 'rules'] }),
      ])
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t('common.networkErrorRetry')))
    },
  })

  const listMutation = useMutation({
    mutationFn: ({
      listKey,
      body,
    }: {
      listKey: RuleToolsListKey
      body: Record<string, unknown>
    }) => patchAdminRuleToolsList(listKey, body),
    onSuccess: (data, variables) => {
      listRevisionRef.current[variables.listKey] = data.revision
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.ruleTools.summary() }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'rule-tools', 'list'] }),
      ])
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t('common.networkErrorRetry')))
    },
  })

  const importMutation = useMutation({
    mutationFn: importAdminRuleTools,
    onSuccess: () => {
      void invalidateRuleToolsAll()
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t('common.networkErrorRetry')))
    },
  })

  useEffect(() => {
    if (configQuery.data?.revision) {
      configRevisionRef.current = configQuery.data.revision
    }
  }, [configQuery.data?.revision])

  useEffect(() => {
    if (rulesQuery.data?.revision) {
      rulesRevisionRef.current = rulesQuery.data.revision
    } else if (rulesPreviewQuery.data?.revision) {
      rulesRevisionRef.current = rulesPreviewQuery.data.revision
    }
  }, [rulesPreviewQuery.data?.revision, rulesQuery.data?.revision])

  useEffect(() => {
    if (blacklistQuery.data?.revision) {
      listRevisionRef.current.appBlacklist = blacklistQuery.data.revision
    }
  }, [blacklistQuery.data?.revision])

  useEffect(() => {
    if (whitelistQuery.data?.revision) {
      listRevisionRef.current.appWhitelist = whitelistQuery.data.revision
    }
  }, [whitelistQuery.data?.revision])

  useEffect(() => {
    if (nameOnlyListQuery.data?.revision) {
      listRevisionRef.current.appNameOnlyList = nameOnlyListQuery.data.revision
    }
  }, [nameOnlyListQuery.data?.revision])

  useEffect(() => {
    if (mediaSourceListQuery.data?.revision) {
      listRevisionRef.current.mediaPlaySourceBlocklist = mediaSourceListQuery.data.revision
    }
  }, [mediaSourceListQuery.data?.revision])

  const activeSelectedRuleId = useMemo(
    () => selectedRuleId ?? rulesQuery.data?.items[0]?.id ?? null,
    [rulesQuery.data?.items, selectedRuleId],
  )

  const selectedRuleFromQueries = useMemo(() => {
    if (!activeSelectedRuleId) return null
    return (
      rulesQuery.data?.items.find((item) => item.id === activeSelectedRuleId) ??
      rulesPreviewQuery.data?.items.find((item) => item.id === activeSelectedRuleId) ??
      null
    )
  }, [activeSelectedRuleId, rulesPreviewQuery.data?.items, rulesQuery.data?.items])

  const selectedRule = useMemo(() => {
    if (!activeSelectedRuleId) return null
    if (selectedRuleSnapshot?.id === activeSelectedRuleId) {
      return selectedRuleSnapshot
    }
    if (selectedRuleFromQueries?.id === activeSelectedRuleId) {
      return selectedRuleFromQueries
    }
    return null
  }, [activeSelectedRuleId, selectedRuleFromQueries, selectedRuleSnapshot])

  const activeRuleDraft = useMemo(() => {
    if (!selectedRule) return null
    return ruleDraft?.id === selectedRule.id ? ruleDraft : cloneRuleItem(selectedRule)
  }, [ruleDraft, selectedRule])

  const ruleProcessSuggestionsQuery = useHistoryAppSuggestions(
    activeRuleDraft?.processMatch ?? '',
    captureReportedAppsEnabled && (dialogAppRuleEditorOpen || dialogAppRulesOpen),
  )

  const withHandledMutation = async <T,>(action: () => Promise<T>): Promise<T | null> => {
    try {
      return await action()
    } catch {
      return null
    }
  }

  const updateRuleDraft = (updater: (current: RuleToolsRuleItem) => RuleToolsRuleItem) => {
    setRuleDraft((current) => {
      const base =
        current && selectedRule && current.id === selectedRule.id
          ? current
          : selectedRule
            ? cloneRuleItem(selectedRule)
            : null
      return base ? updater(base) : base
    })
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

  const replaceSelectedRuleState = (nextRule: RuleToolsRuleItem | null) => {
    if (!nextRule) {
      setSelectedRuleSnapshot(null)
      setRuleDraft(null)
      return
    }
    const snapshot = cloneRuleItem(nextRule)
    setSelectedRuleSnapshot(snapshot)
    setRuleDraft(cloneRuleItem(snapshot))
  }

  const patchSelectedRuleSnapshot = (
    ruleId: string,
    updater: (current: RuleToolsRuleItem) => RuleToolsRuleItem,
  ) => {
    setSelectedRuleSnapshot((current) => {
      const base =
        current?.id === ruleId
          ? cloneRuleItem(current)
          : selectedRule?.id === ruleId
            ? cloneRuleItem(selectedRule)
            : null
      return base ? updater(base) : current
    })
  }

  const getRulesRevision = () =>
    rulesRevisionRef.current || rulesQuery.data?.revision || rulesPreviewQuery.data?.revision || ''

  const getConfigRevision = () => configRevisionRef.current || configQuery.data?.revision || ''

  const getListRevision = (listKey: RuleToolsListKey) => {
    if (listRevisionRef.current[listKey]) {
      return listRevisionRef.current[listKey]
    }
    switch (listKey) {
      case 'appBlacklist':
        return blacklistQuery.data?.revision ?? ''
      case 'appWhitelist':
        return whitelistQuery.data?.revision ?? ''
      case 'appNameOnlyList':
        return nameOnlyListQuery.data?.revision ?? ''
      case 'mediaPlaySourceBlocklist':
        return mediaSourceListQuery.data?.revision ?? ''
      default:
        return ''
    }
  }

  const saveConfigPatch = async (patch: Partial<RuleToolsConfigResponse>) => {
    const revision = getConfigRevision()
    if (!revision) return false
    const result = await withHandledMutation(() =>
      configMutation.mutateAsync({
        revision,
        ...patch,
      }),
    )
    return result !== null
  }

  const saveListAction = async (listKey: RuleToolsListKey, body: Record<string, unknown>) => {
    const revision = getListRevision(listKey)
    if (!revision) return false
    const result = await withHandledMutation(() =>
      listMutation.mutateAsync({
        listKey,
        body: {
          revision,
          ...body,
        },
      }),
    )
    return result !== null
  }

  const commitRuleGroupDraft = async () => {
    if (!selectedRule || !activeRuleDraft) return true
    const patch: Record<string, unknown> = {}
    if (activeRuleDraft.processMatch !== selectedRule.processMatch) {
      patch.processMatch = activeRuleDraft.processMatch
    }
    if ((activeRuleDraft.defaultText ?? '') !== (selectedRule.defaultText ?? '')) {
      patch.defaultText = activeRuleDraft.defaultText ?? ''
    }
    if (Object.keys(patch).length === 0) return true

    const result = await withHandledMutation(() =>
      rulesMutation.mutateAsync({
        action: 'update_group',
        revision: getRulesRevision(),
        groupId: selectedRule.id,
        patch,
      }),
    )
    if (result) {
      patchSelectedRuleSnapshot(selectedRule.id, (current) => ({
        ...current,
        processMatch: activeRuleDraft.processMatch,
        defaultText: activeRuleDraft.defaultText ?? undefined,
      }))
    }
    return result !== null
  }

  const commitTitleRuleDraft = async (titleRuleId: string) => {
    if (!selectedRule || !activeRuleDraft) return true
    const currentDraft = activeRuleDraft.titleRules.find((item) => item.id === titleRuleId)
    const currentServer = selectedRule.titleRules.find((item) => item.id === titleRuleId)
    if (!currentDraft || !currentServer) return true
    const patch: Record<string, unknown> = {}
    if (currentDraft.mode !== currentServer.mode) patch.mode = currentDraft.mode
    if (currentDraft.pattern !== currentServer.pattern) patch.pattern = currentDraft.pattern
    if (currentDraft.text !== currentServer.text) patch.text = currentDraft.text
    if (Object.keys(patch).length === 0) return true

    const result = await withHandledMutation(() =>
      rulesMutation.mutateAsync({
        action: 'update_title_rule',
        revision: getRulesRevision(),
        groupId: selectedRule.id,
        titleRuleId,
        patch,
      }),
    )
    if (result) {
      patchSelectedRuleSnapshot(selectedRule.id, (current) => ({
        ...current,
        titleRules: current.titleRules.map((item) =>
          item.id === titleRuleId
            ? {
                ...item,
                mode: currentDraft.mode,
                pattern: currentDraft.pattern,
                text: currentDraft.text,
              }
            : item,
        ),
      }))
    }
    return result !== null
  }

  const commitEntireRuleDraft = async () => {
    if (!(await commitRuleGroupDraft())) return false
    if (!activeRuleDraft) return true
    for (const titleRule of activeRuleDraft.titleRules) {
      if (!(await commitTitleRuleDraft(titleRule.id))) {
        return false
      }
    }
    return true
  }

  const currentFilterListKey: RuleToolsListKey =
    appFilterMode === 'blacklist' ? 'appBlacklist' : 'appWhitelist'
  const currentFilterListQuery =
    currentFilterListKey === 'appBlacklist' ? blacklistQuery : whitelistQuery
  const currentFilterSuggestions =
    currentFilterListKey === 'appBlacklist'
      ? (blacklistSuggestionsQuery.data ?? [])
      : (whitelistSuggestionsQuery.data ?? [])
  const currentFilterSearchInput =
    currentFilterListKey === 'appBlacklist' ? blacklistSearchInput : whitelistSearchInput
  const currentFilterPage =
    currentFilterListKey === 'appBlacklist' ? blacklistListPage : whitelistListPage
  const currentFilterRevision =
    currentFilterListKey === 'appBlacklist'
      ? (blacklistQuery.data?.revision ?? '')
      : (whitelistQuery.data?.revision ?? '')
  const currentFilterEditingItem =
    editingListItem?.listKey === currentFilterListKey
      ? {
          currentValue: editingListItem.currentValue,
          draftValue: editingListItem.draftValue,
        }
      : null

  const previewItems = rulesPreviewQuery.data?.items ?? []
  const previewTotal =
    currentSummary?.ruleGroupCount ?? rulesPreviewQuery.data?.total ?? rulesQuery.data?.total ?? 0
  const previewOverflow = Math.max(0, previewTotal - previewItems.length)
  const configReady = Boolean(currentConfig?.revision)
  const rulesReady = Boolean(rulesQuery.data?.revision || rulesPreviewQuery.data?.revision)
  const rulesRefreshing = rulesQuery.isFetching && !rulesQuery.isLoading
  const nameOnlyRevision = nameOnlyListQuery.data?.revision ?? ''
  const mediaSourceRevision = mediaSourceListQuery.data?.revision ?? ''
  const currentFilterModeLabel =
    appFilterMode === 'blacklist'
      ? t('webSettingsRuleTools.appFilter.blacklistMode')
      : t('webSettingsRuleTools.appFilter.whitelistMode')

  const handleAppRuleEditorOpenChange = (open: boolean) => {
    setDialogAppRuleEditorOpen(open)
    if (!open) {
      setDialogAppRulesOpen(true)
    }
  }

  const handleOpenRuleSelector = () => {
    setDialogAppRulesOpen(true)
  }

  const handleOpenRuleEditor = (ruleId: string) => {
    setSelectedRuleId(ruleId)
    const currentItem =
      rulesQuery.data?.items.find((item) => item.id === ruleId) ??
      rulesPreviewQuery.data?.items.find((item) => item.id === ruleId) ??
      null
    replaceSelectedRuleState(currentItem ? cloneRuleItem(currentItem) : null)
    setDialogAppRuleEditorOpen(false)
    setDialogAppRulesOpen(true)
  }

  const openMobileRuleEditor = (rule: RuleToolsRuleItem) => {
    setSelectedRuleId(rule.id)
    replaceSelectedRuleState(cloneRuleItem(rule))
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

  const handleSaveEditedListItem = async () => {
    if (!editingListItem) return
    const ok = await saveListAction(editingListItem.listKey, {
      action: 'update',
      currentValue: editingListItem.currentValue,
      nextValue: editingListItem.draftValue,
    })
    if (ok) {
      setEditingListItem(null)
    }
  }

  const handleRemoveListItem = async (listKey: RuleToolsListKey, value: string) => {
    const ok = await saveListAction(listKey, {
      action: 'delete',
      currentValue: value,
    })
    if (ok && editingListItem?.listKey === listKey) {
      setEditingListItem(null)
    }
  }

  const handleAddFilterItem = async () => {
    const value =
      currentFilterListKey === 'appBlacklist' ? blacklistInput.trim() : whitelistInput.trim()
    if (!value) return
    const ok = await saveListAction(currentFilterListKey, {
      action: 'create',
      value,
    })
    if (!ok) return
    if (currentFilterListKey === 'appBlacklist') {
      setBlacklistInput('')
      setBlacklistSearchInput('')
      setBlacklistListPage(
        listMaxPage((currentFilterListQuery.data?.total ?? 0) + 1, SETTINGS_APP_LIST_PAGE_SIZE),
      )
    } else {
      setWhitelistInput('')
      setWhitelistSearchInput('')
      setWhitelistListPage(
        listMaxPage((currentFilterListQuery.data?.total ?? 0) + 1, SETTINGS_APP_LIST_PAGE_SIZE),
      )
    }
  }

  const handleAddNameOnlyItem = async () => {
    const value = nameOnlyListInput.trim()
    if (!value) return
    const ok = await saveListAction('appNameOnlyList', {
      action: 'create',
      value,
    })
    if (!ok) return
    setNameOnlyListInput('')
    setNameOnlyListSearchInput('')
    setNameOnlyListPage(
      listMaxPage((nameOnlyListQuery.data?.total ?? 0) + 1, SETTINGS_APP_LIST_PAGE_SIZE),
    )
  }

  const handleAddMediaSourceItem = async () => {
    const value = mediaSourceInput.trim().toLowerCase()
    if (!value) return
    const ok = await saveListAction('mediaPlaySourceBlocklist', {
      action: 'create',
      value,
    })
    if (!ok) return
    setMediaSourceInput('')
    setMediaSourceSearchInput('')
    setMediaSourceListPage(
      listMaxPage((mediaSourceListQuery.data?.total ?? 0) + 1, SETTINGS_APP_LIST_PAGE_SIZE),
    )
  }

  const handleAddRuleGroup = async (openEditor = false) => {
    if (!rulesReady) return
    const result = await withHandledMutation(() =>
      rulesMutation.mutateAsync({
        action: 'create_group',
        revision: getRulesRevision(),
        group: {
          processMatch: '',
          defaultText: '',
          titleRules: [],
        },
      }),
    )
    if (!result) return
    setRuleSearchInput('')
    setGroupListPage(listMaxPage(result.total, SETTINGS_RULES_PAGE_SIZE))
    setSelectedRuleId(result.groupId ?? null)
    replaceSelectedRuleState(
      result.groupId
        ? {
            id: result.groupId,
            processMatch: '',
            defaultText: undefined,
            titleRules: [],
            position: Math.max(0, result.total - 1),
          }
        : null,
    )
    if (openEditor) {
      setDialogAppRulesOpen(false)
      setDialogAppRuleEditorOpen(true)
    }
  }

  const handleDeleteRuleGroup = async (groupId: string) => {
    const result = await withHandledMutation(() =>
      rulesMutation.mutateAsync({
        action: 'delete_group',
        revision: getRulesRevision(),
        groupId,
      }),
    )
    if (!result) return
    if (selectedRuleId === groupId) {
      setSelectedRuleId(null)
      replaceSelectedRuleState(null)
    }
    if (dialogAppRuleEditorOpen) {
      setDialogAppRuleEditorOpen(false)
      setDialogAppRulesOpen(true)
    }
  }

  const handleMoveRuleGroup = async (groupId: string, toIndex: number) => {
    const result = await withHandledMutation(() =>
      rulesMutation.mutateAsync({
        action: 'move_group',
        revision: getRulesRevision(),
        groupId,
        toIndex,
      }),
    )
    if (result && activeSelectedRuleId === groupId) {
      patchSelectedRuleSnapshot(groupId, (current) => ({
        ...current,
        position: toIndex,
      }))
      setRuleDraft((current) =>
        current?.id === groupId
          ? {
              ...current,
              position: toIndex,
            }
          : current,
      )
    }
  }

  const handleAddTitleRule = async () => {
    if (!selectedRule) return
    if (!(await commitEntireRuleDraft())) return
    const baseRule = activeRuleDraft ? cloneRuleItem(activeRuleDraft) : cloneRuleItem(selectedRule)
    const result = await withHandledMutation(() =>
      rulesMutation.mutateAsync({
        action: 'create_title_rule',
        revision: getRulesRevision(),
        groupId: selectedRule.id,
        index: baseRule.titleRules.length,
        rule: {
          mode: 'plain',
          pattern: '',
          text: '',
        },
      }),
    )
    if (!result) return
    replaceSelectedRuleState({
      ...baseRule,
      titleRules: [
        ...baseRule.titleRules,
        {
          id: result.titleRuleId ?? `${selectedRule.id}-title-rule-${baseRule.titleRules.length}`,
          mode: 'plain',
          pattern: '',
          text: '',
        },
      ],
    })
  }

  const handleDeleteTitleRule = async (titleRuleId: string) => {
    if (!selectedRule) return
    const baseRule = activeRuleDraft ? cloneRuleItem(activeRuleDraft) : cloneRuleItem(selectedRule)
    const result = await withHandledMutation(() =>
      rulesMutation.mutateAsync({
        action: 'delete_title_rule',
        revision: getRulesRevision(),
        groupId: selectedRule.id,
        titleRuleId,
      }),
    )
    if (!result) return
    replaceSelectedRuleState({
      ...baseRule,
      titleRules: baseRule.titleRules.filter((item) => item.id !== titleRuleId),
    })
  }

  const handleMoveTitleRule = async (titleRuleId: string, toIndex: number) => {
    if (!selectedRule) return
    if (!(await commitEntireRuleDraft())) return
    const baseRule = activeRuleDraft ? cloneRuleItem(activeRuleDraft) : cloneRuleItem(selectedRule)
    const fromIndex = baseRule.titleRules.findIndex((item) => item.id === titleRuleId)
    if (fromIndex < 0) return
    const result = await withHandledMutation(() =>
      rulesMutation.mutateAsync({
        action: 'move_title_rule',
        revision: getRulesRevision(),
        groupId: selectedRule.id,
        titleRuleId,
        toIndex,
      }),
    )
    if (!result) return
    replaceSelectedRuleState({
      ...baseRule,
      titleRules: moveItem(baseRule.titleRules, fromIndex, toIndex),
    })
  }

  const handleTitleRuleModeChange = async (
    titleRuleId: string,
    nextMode: AppTitleRuleMode,
  ) => {
    if (!selectedRule) return
    updateTitleRuleDraft(titleRuleId, (current) => ({
      ...current,
      mode: nextMode,
    }))
    await withHandledMutation(() =>
      rulesMutation.mutateAsync({
        action: 'update_title_rule',
        revision: getRulesRevision(),
        groupId: selectedRule.id,
        titleRuleId,
        patch: { mode: nextMode },
      }),
    )
  }

  const copyRulesJson = async () => {
    try {
      const payload = await exportAdminRuleTools()
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

  const confirmImportRules = async () => {
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
    const result = await withHandledMutation(() => importMutation.mutateAsync(parsed.data))
    if (!result) return
    setSelectedRuleId(null)
    replaceSelectedRuleState(null)
    setImportRulesDialogOpen(false)
    setImportRulesInput('')
    setRuleSearchInput('')
    setBlacklistSearchInput('')
    setWhitelistSearchInput('')
    setNameOnlyListSearchInput('')
    setMediaSourceSearchInput('')
    toast.success(t('webSettingsRuleTools.toasts.importedRulesIntoForm'))
  }

  const renderRulePreview = () => {
    if (rulesPreviewQuery.isLoading && previewItems.length === 0) {
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
                    disabled={!rulesReady || rulesMutation.isPending}
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
    const items = rulesQuery.data?.items ?? []
    const rulesTotal = currentSummary?.ruleGroupCount ?? rulesQuery.data?.total ?? 0
    const filteredTotal = rulesQuery.data?.total ?? 0
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
            disabled={!rulesReady || rulesMutation.isPending}
            onClick={() => void handleAddRuleGroup(mobile)}
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
          {rulesRefreshing ? (
            <p className="text-xs text-muted-foreground">{t('common.refreshing')}</p>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {rulesQuery.isLoading && !rulesQuery.data ? (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/30 px-6 py-8 text-center">
              <p className="text-xs text-muted-foreground">{t('webSettings.loading')}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/30 px-6 py-8 text-center">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {hasSearch
                  ? t('webSettingsRuleTools.appRules.noSearchResults')
                  : t('webSettingsRuleTools.appRules.noGroups')}
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div
                className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border border-border/60 bg-background/20 p-3"
              >
                {items.map((item) => {
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
                        replaceSelectedRuleState(cloneRuleItem(item))
                      }}
                    >
                      <p className="text-xs font-medium text-foreground/80">
                        {t('webSettingsRuleTools.appRules.ruleIndex', {
                          index: item.position + 1,
                          total: rulesTotal,
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
                page={groupListPage}
                pageSize={SETTINGS_RULES_PAGE_SIZE}
                total={filteredTotal}
                onPageChange={setGroupListPage}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderRuleGroupEditor = (mobile: boolean) => {
    if (rulesQuery.isLoading && !selectedRule) {
      return <p className="text-xs text-muted-foreground">{t('webSettings.loading')}</p>
    }

    if (!selectedRule || !activeRuleDraft) {
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
                <Button
                  type="button"
                  disabled={!rulesReady}
                  onClick={() => void handleAddRuleGroup(true)}
                >
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

    const total = currentSummary?.ruleGroupCount ?? rulesQuery.data?.total ?? 0
    const groupIndex = selectedRule.position

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
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    void (async () => {
                      if (!(await commitEntireRuleDraft())) return
                      setDialogAppRuleEditorOpen(false)
                      setDialogAppRulesOpen(true)
                    })()
                  }}
                >
                  {t('webSettingsRuleTools.appRules.chooseAnotherGroup')}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={rulesMutation.isPending || selectedRule.position <= 0}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void handleMoveRuleGroup(selectedRule.id, selectedRule.position - 1)}
              >
                {t('webSettingsRuleTools.appRules.moveUp')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={rulesMutation.isPending || selectedRule.position >= total - 1}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void handleMoveRuleGroup(selectedRule.id, selectedRule.position + 1)}
              >
                {t('webSettingsRuleTools.appRules.moveDown')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={rulesMutation.isPending}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void handleDeleteRuleGroup(selectedRule.id)}
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
            value={activeRuleDraft.processMatch}
            onValueChange={(value) =>
              updateRuleDraft((current) => ({
                ...current,
                processMatch: value,
              }))
            }
            onBlur={() => {
              void commitRuleGroupDraft()
            }}
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
            value={activeRuleDraft.defaultText ?? ''}
            onChange={(event) =>
              updateRuleDraft((current) => ({
                ...current,
                defaultText: event.target.value,
              }))
            }
            onBlur={() => {
              void commitRuleGroupDraft()
            }}
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
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void handleAddTitleRule()}
            >
              {t('webSettingsRuleTools.appRules.addTitleRule')}
            </Button>
          </div>

          {activeRuleDraft.titleRules.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t('webSettingsRuleTools.appRules.noTitleRules')}
            </p>
          ) : (
            <motion.ul className="space-y-3" layout>
              <AnimatePresence initial={false}>
                {activeRuleDraft.titleRules.map((titleRule, index) => {
                  const isFirst = index <= 0
                  const isLast = index >= activeRuleDraft.titleRules.length - 1
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
                                total: activeRuleDraft.titleRules.length,
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
                              disabled={rulesMutation.isPending || isFirst}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => void handleMoveTitleRule(titleRule.id, index - 1)}
                            >
                              {t('webSettingsRuleTools.appRules.moveUp')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={rulesMutation.isPending || isLast}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => void handleMoveTitleRule(titleRule.id, index + 1)}
                            >
                              {t('webSettingsRuleTools.appRules.moveDown')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={rulesMutation.isPending}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => void handleDeleteTitleRule(titleRule.id)}
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
                              void handleTitleRuleModeChange(titleRule.id, nextMode)
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
                            onBlur={() => {
                              void commitTitleRuleDraft(titleRule.id)
                            }}
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
                            onBlur={() => {
                              void commitTitleRuleDraft(titleRule.id)
                            }}
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

  if (summaryQuery.isLoading && !currentSummary) {
    return <div className="text-sm text-muted-foreground">{t('webSettings.loading')}</div>
  }

  if (summaryQuery.isError && !currentSummary) {
    return (
      <div className="text-sm text-destructive">
        {getErrorMessage(summaryQuery.error, t('common.networkErrorRetry'))}
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
                disabled={!rulesReady}
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
                  checked={currentConfig?.appMessageRulesShowProcessName ?? true}
                  disabled={!configReady || configMutation.isPending}
                  onCheckedChange={(value) => {
                    void saveConfigPatch({ appMessageRulesShowProcessName: value })
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
                  disabled={!configReady || configMutation.isPending}
                  onCheckedChange={(value) => {
                    void saveConfigPatch({ captureReportedAppsEnabled: value })
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
          if (!open) {
            setEditingListItem(null)
          }
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
          if (!open) {
            setEditingListItem(null)
          }
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
              disabled={!configReady || configMutation.isPending}
              onValueChange={(value) => {
                if (value !== 'blacklist' && value !== 'whitelist') return
                setEditingListItem(null)
                void saveConfigPatch({ appFilterMode: value })
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
              items={currentFilterListQuery.data?.items ?? []}
              total={currentFilterListQuery.data?.total ?? 0}
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
              loading={currentFilterListQuery.isLoading && !currentFilterListQuery.data}
              refreshing={currentFilterListQuery.isFetching && !currentFilterListQuery.isLoading}
              busy={
                listMutation.isPending ||
                configMutation.isPending ||
                currentFilterRevision.length === 0
              }
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogAppFilterOpen(false)}
            >
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogNameOnlyOpen}
        onOpenChange={(open) => {
          setDialogNameOnlyOpen(open)
          if (!open) {
            setEditingListItem(null)
          }
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
              items={nameOnlyListQuery.data?.items ?? []}
              total={nameOnlyListQuery.data?.total ?? 0}
              page={nameOnlyListPage}
              onPageChange={setNameOnlyListPage}
              savedSearchValue={nameOnlyListSearchInput}
              onSavedSearchValueChange={(value) => {
                setNameOnlyListSearchInput(value)
                setNameOnlyListPage(0)
              }}
              loading={nameOnlyListQuery.isLoading && !nameOnlyListQuery.data}
              refreshing={nameOnlyListQuery.isFetching && !nameOnlyListQuery.isLoading}
              busy={listMutation.isPending || nameOnlyRevision.length === 0}
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogNameOnlyOpen(false)}
            >
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogMediaSourceOpen}
        onOpenChange={(open) => {
          setDialogMediaSourceOpen(open)
          if (!open) {
            setEditingListItem(null)
          }
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
              items={mediaSourceListQuery.data?.items ?? []}
              total={mediaSourceListQuery.data?.total ?? 0}
              page={mediaSourceListPage}
              onPageChange={setMediaSourceListPage}
              savedSearchValue={mediaSourceSearchInput}
              onSavedSearchValueChange={(value) => {
                setMediaSourceSearchInput(value)
                setMediaSourceListPage(0)
              }}
              loading={mediaSourceListQuery.isLoading && !mediaSourceListQuery.data}
              refreshing={mediaSourceListQuery.isFetching && !mediaSourceListQuery.isLoading}
              busy={listMutation.isPending || mediaSourceRevision.length === 0}
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
            <Button
              type="button"
              disabled={importMutation.isPending}
              onClick={() => void confirmImportRules()}
            >
              {t('webSettingsRuleTools.importDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
