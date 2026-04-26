import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useT } from 'next-i18next/client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  exportAdminActivityApps,
  exportAdminRuleTools,
} from '@/components/admin/admin-query-fetchers'
import { adminQueryKeys } from '@/components/admin/admin-query-keys'
import { importAdminRuleTools } from '@/components/admin/admin-query-mutations'
import {
  useHistoryAppSuggestions,
  useHistoryPlaySourceSuggestions,
} from '@/components/admin/rule-tools-hooks'
import {
  areRuleToolsPayloadEqual,
  buildRuleItems,
  buildRuleToolsSummary,
  cloneRuleToolsPayload,
  filterListValues,
  filterRuleItems,
  getErrorMessage,
  type ListEditingState,
  moveItem,
  normalizeDraftListValue,
  normalizePayloadForSave,
} from '@/components/admin/rule-tools-utils'
import {
  listMaxPage,
  SETTINGS_APP_LIST_PAGE_SIZE,
  SETTINGS_RULES_PAGE_SIZE,
} from '@/components/admin/web-settings-paging'
import { exportAppRulesJson, parseAppRulesJson } from '@/components/admin/web-settings-utils'
import {
  type AppMessageTitleRule,
  type AppTitleRuleMode,
  createAppMessageRuleGroupId,
  createAppMessageTitleRuleId,
} from '@/lib/app-message-rules'
import type {
  RuleToolsExportPayload,
  RuleToolsListKey,
  RuleToolsRuleItem,
} from '@/types/rule-tools'

export function useRuleToolsState(migration: { heavyEditingLocked?: boolean } | null | undefined) {
  const { t } = useT('admin')
  const queryClient = useQueryClient()

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

  return {
    t,
    // Query state
    ruleToolsQuery,
    saveDraftMutation,
    // Payload state
    committedPayload,
    currentPayload,
    currentSummary,
    draftDirty,
    draftPayload,
    // Derived flags
    captureReportedAppsEnabled,
    appFilterMode,
    currentFilterModeLabel,
    heavyEditingLocked,
    busy,
    // Rule items
    ruleItems,
    filteredRuleItems,
    resolvedGroupListPage,
    pagedRuleItems,
    previewItems,
    previewTotal,
    previewOverflow,
    activeSelectedRuleId,
    selectedRule,
    // Filter list
    currentFilterListKey,
    currentFilterValues,
    currentFilterSearchInput,
    currentFilterPage,
    filteredCurrentFilterItems,
    pagedCurrentFilterItems,
    currentFilterSuggestions,
    currentFilterEditingItem,
    // Name only list
    filteredNameOnlyItems,
    resolvedNameOnlyListPage,
    pagedNameOnlyItems,
    // Media source list
    filteredMediaSourceItems,
    resolvedMediaSourceListPage,
    pagedMediaSourceItems,
    // Suggestion queries
    nameOnlySuggestionsQuery,
    mediaSourceSuggestionsQuery,
    ruleProcessSuggestionsQuery,
    // Input state
    blacklistInput,
    setBlacklistInput,
    whitelistInput,
    setWhitelistInput,
    nameOnlyListInput,
    setNameOnlyListInput,
    mediaSourceInput,
    setMediaSourceInput,
    ruleSearchInput,
    setRuleSearchInput,
    // Page state
    setGroupListPage,
    setBlacklistListPage,
    setBlacklistSearchInput,
    setWhitelistListPage,
    setWhitelistSearchInput,
    nameOnlyListSearchInput,
    setNameOnlyListSearchInput,
    setNameOnlyListPage,
    mediaSourceSearchInput,
    setMediaSourceSearchInput,
    setMediaSourceListPage,
    // Dialog state
    dialogAppRulesOpen,
    setDialogAppRulesOpen,
    dialogAppRuleEditorOpen,
    setDialogAppRuleEditorOpen,
    dialogAppFilterOpen,
    setDialogAppFilterOpen,
    dialogNameOnlyOpen,
    setDialogNameOnlyOpen,
    dialogMediaSourceOpen,
    setDialogMediaSourceOpen,
    importRulesDialogOpen,
    setImportRulesDialogOpen,
    importRulesInput,
    setImportRulesInput,
    // Editing state
    editingListItem,
    setEditingListItem,
    selectedRuleId,
    setSelectedRuleId,
    // Handlers
    handleOpenRuleSelector,
    handleOpenRuleEditor,
    handleAppRuleEditorOpenChange,
    openMobileRuleEditor,
    handleStartEditListItem,
    handleCancelEditListItem,
    handleSaveEditedListItem,
    handleRemoveListItem,
    handleAddFilterItem,
    handleAddNameOnlyItem,
    handleAddMediaSourceItem,
    handleAddRuleGroup,
    handleDeleteRuleGroup,
    handleMoveRuleGroup,
    handleAddTitleRule,
    handleDeleteTitleRule,
    handleMoveTitleRule,
    handleTitleRuleModeChange,
    updateRuleDraft,
    updateTitleRuleDraft,
    updateDraftPayload,
    commitSinglePayloadChange,
    copyRulesJson,
    exportUsedAppsJson,
    confirmImportRules,
    handleRevertDraft,
    handleSaveDraft,
  }
}
