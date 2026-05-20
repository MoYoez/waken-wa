import { ListDialogEditor } from '@/components/admin/rule-tools-list-dialog-editor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

import type { useRuleToolsState } from './use-rule-tools-state'

type RuleToolsListDialogsT = (
  key: string,
  values?: Record<string, unknown>,
) => string

export function RuleToolsListDialogs({
  state,
  t,
}: {
  state: ReturnType<typeof useRuleToolsState>
  t: RuleToolsListDialogsT
}) {
  const {
    ruleToolsQuery,
    currentPayload,
    captureReportedAppsEnabled,
    appFilterMode,
    busy,
    currentFilterListKey,
    currentFilterSearchInput,
    currentFilterPage,
    filteredCurrentFilterItems,
    pagedCurrentFilterItems,
    currentFilterSuggestions,
    currentFilterEditingItem,
    filteredNameOnlyItems,
    resolvedNameOnlyListPage,
    pagedNameOnlyItems,
    nameOnlySuggestionsQuery,
    blacklistInput,
    setBlacklistInput,
    whitelistInput,
    setWhitelistInput,
    nameOnlyListInput,
    setNameOnlyListInput,
    setBlacklistListPage,
    setBlacklistSearchInput,
    setWhitelistListPage,
    setWhitelistSearchInput,
    nameOnlyListSearchInput,
    setNameOnlyListSearchInput,
    setNameOnlyListPage,
    dialogAppFilterOpen,
    setDialogAppFilterOpen,
    dialogNameOnlyOpen,
    setDialogNameOnlyOpen,
    editingListItem,
    setEditingListItem,
    handleStartEditListItem,
    handleCancelEditListItem,
    handleSaveEditedListItem,
    handleRemoveListItem,
    handleAddFilterItem,
    handleAddNameOnlyItem,
    updateDraftPayload,
  } = state

  return (
    <>
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
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background/70 px-4 py-4">
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
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background/70 px-4 py-4">
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
                inputValue={currentFilterListKey === 'appBlacklist' ? blacklistInput : whitelistInput}
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
    </>
  )
}
