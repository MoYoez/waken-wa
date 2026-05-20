import {
  AnimatePresence,
  motion,
  type Transition,
  type Variants,
} from 'motion/react'
import { type Dispatch, type SetStateAction } from 'react'

import {
  ListPaginationBar,
  SETTINGS_APP_LIST_PAGE_SIZE,
} from '@/components/admin/web-settings-paging'
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
import type {
  MediaPlaySourceRule,
  MediaPlaySourceRuleAction,
} from '@/types/rule-tools'

type RuleToolsMediaSourceDialogT = (
  key: string,
  values?: Record<string, unknown>,
) => string

type MediaSourceRuleItem = MediaPlaySourceRule & {
  position: number
}

function ParseMediaSourceRuleAction(
  value: string,
): MediaPlaySourceRuleAction | null {
  switch (value) {
    case 'block':
    case 'rename':
      return value
    default:
      return null
  }
}

function IsMediaSourceRuleIncomplete(rule: MediaPlaySourceRule | null): boolean {
  if (!rule?.source.trim()) return true
  return rule.action === 'rename' && !rule.displayName?.trim()
}

export function RuleToolsMediaSourceDialog({
  open,
  isLoading,
  isFetching,
  hasPayload,
  busy,
  captureReportedAppsEnabled,
  mediaSourceSuggestions,
  mediaSourceInput,
  setMediaSourceInput,
  mediaSourceAction,
  setMediaSourceAction,
  mediaSourceDisplayName,
  setMediaSourceDisplayName,
  mediaSourceSearchInput,
  setMediaSourceSearchInput,
  setMediaSourceListPage,
  filteredMediaSourceItems,
  pagedMediaSourceItems,
  resolvedMediaSourceListPage,
  editingMediaSourceRule,
  setEditingMediaSourceRule,
  sectionVariants,
  sectionTransition,
  t,
  onOpenChange,
  onAddMediaSourceItem,
  onStartEditMediaSourceRule,
  onCancelEditMediaSourceRule,
  onSaveEditedMediaSourceRule,
  onRemoveMediaSourceRule,
}: {
  open: boolean
  isLoading: boolean
  isFetching: boolean
  hasPayload: boolean
  busy: boolean
  captureReportedAppsEnabled: boolean
  mediaSourceSuggestions: string[]
  mediaSourceInput: string
  setMediaSourceInput: (value: string) => void
  mediaSourceAction: MediaPlaySourceRuleAction
  setMediaSourceAction: (value: MediaPlaySourceRuleAction) => void
  mediaSourceDisplayName: string
  setMediaSourceDisplayName: (value: string) => void
  mediaSourceSearchInput: string
  setMediaSourceSearchInput: (value: string) => void
  setMediaSourceListPage: (page: number) => void
  filteredMediaSourceItems: MediaSourceRuleItem[]
  pagedMediaSourceItems: MediaSourceRuleItem[]
  resolvedMediaSourceListPage: number
  editingMediaSourceRule: MediaPlaySourceRule | null
  setEditingMediaSourceRule: Dispatch<
    SetStateAction<MediaPlaySourceRule | null>
  >
  sectionVariants: Variants
  sectionTransition: Transition
  t: RuleToolsMediaSourceDialogT
  onOpenChange: (open: boolean) => void
  onAddMediaSourceItem: () => void
  onStartEditMediaSourceRule: (rule: MediaPlaySourceRule) => void
  onCancelEditMediaSourceRule: () => void
  onSaveEditedMediaSourceRule: () => void
  onRemoveMediaSourceRule: (source: string) => void
}) {
  const canAddMediaSource =
    !busy &&
    mediaSourceInput.trim().length > 0 &&
    (mediaSourceAction !== 'rename' ||
      mediaSourceDisplayName.trim().length > 0)

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) setEditingMediaSourceRule(null)
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
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="shrink-0 space-y-3">
              <p className="text-xs text-muted-foreground">
                {t('webSettingsRuleTools.mediaSource.inputDescription')}
              </p>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
                <Autocomplete
                  id="rule-tools-media-source"
                  items={mediaSourceSuggestions}
                  value={mediaSourceInput}
                  onValueChange={setMediaSourceInput}
                  placeholder={t('webSettingsRuleTools.mediaSource.placeholder')}
                  inputClassName="font-mono"
                  showClear={false}
                  emptyText={
                    captureReportedAppsEnabled
                      ? t('webSettingsRuleTools.mediaSource.noMatchingHistory')
                      : t(
                          'webSettingsRuleTools.appNameListEditor.historyDisabled',
                        )
                  }
                />
                <RadioGroup
                  value={mediaSourceAction}
                  onValueChange={(value) => {
                    const action = ParseMediaSourceRuleAction(value)
                    if (action) setMediaSourceAction(action)
                  }}
                  className="grid grid-cols-2 gap-2"
                  disabled={busy}
                >
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs">
                    <RadioGroupItem
                      value="block"
                      id="media-source-action-block"
                    />
                    {t('webSettingsRuleTools.mediaSource.actions.block')}
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs">
                    <RadioGroupItem
                      value="rename"
                      id="media-source-action-rename"
                    />
                    {t('webSettingsRuleTools.mediaSource.actions.rename')}
                  </label>
                </RadioGroup>
              </div>
              {mediaSourceAction === 'rename' ? (
                <Input
                  value={mediaSourceDisplayName}
                  onChange={(event) =>
                    setMediaSourceDisplayName(event.target.value)
                  }
                  placeholder={t(
                    'webSettingsRuleTools.mediaSource.displayNamePlaceholder',
                  )}
                />
              ) : null}
              <Button
                type="button"
                disabled={!canAddMediaSource}
                onClick={() => onAddMediaSourceItem()}
              >
                {t('webSettingsRuleTools.appNameListEditor.add')}
              </Button>

              <div className="space-y-2">
                <Label htmlFor="rule-tools-media-source-saved-search">
                  {t('common.search')}
                </Label>
                <Input
                  id="rule-tools-media-source-saved-search"
                  value={mediaSourceSearchInput}
                  onChange={(event) => {
                    setMediaSourceSearchInput(event.target.value)
                    setMediaSourceListPage(0)
                  }}
                  placeholder={t(
                    'webSettingsRuleTools.appNameListEditor.savedSearchPlaceholder',
                  )}
                />
                {isFetching && !isLoading ? (
                  <p className="text-xs text-muted-foreground">
                    {t('common.refreshing')}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {isLoading && !hasPayload ? (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-background/30 px-6 py-8 text-center">
                  <p className="text-xs text-muted-foreground">
                    {t('webSettings.loading')}
                  </p>
                </div>
              ) : filteredMediaSourceItems.length === 0 ? (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-background/30 px-6 py-8 text-center">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {mediaSourceSearchInput.trim()
                      ? t(
                          'webSettingsRuleTools.appNameListEditor.noSavedResults',
                        )
                      : t('webSettingsRuleTools.mediaSource.empty')}
                  </p>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {t('webSettingsRuleTools.appNameListEditor.savedItemsPaged')}
                  </p>
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-background/20 p-3">
                    <motion.ul className="space-y-3" layout>
                      <AnimatePresence initial={false}>
                        {pagedMediaSourceItems.map((item) => {
                          const isEditing =
                            editingMediaSourceRule?.source.toLowerCase() ===
                            item.source.toLowerCase()
                          return (
                            <motion.li
                              key={item.source.toLowerCase()}
                              className="rounded-md border bg-background/50 px-3 py-2.5"
                              variants={sectionVariants}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={sectionTransition}
                              layout
                            >
                              {isEditing ? (
                                <div className="space-y-3">
                                  <Input
                                    value={editingMediaSourceRule?.source ?? ''}
                                    onChange={(event) =>
                                      setEditingMediaSourceRule((current) =>
                                        current
                                          ? {
                                              ...current,
                                              source: event.target.value,
                                            }
                                          : current,
                                      )
                                    }
                                    className="font-mono"
                                    placeholder={t(
                                      'webSettingsRuleTools.mediaSource.placeholder',
                                    )}
                                  />
                                  <RadioGroup
                                    value={
                                      editingMediaSourceRule?.action ?? 'block'
                                    }
                                    onValueChange={(value) => {
                                      const action =
                                        ParseMediaSourceRuleAction(value)
                                      if (!action) return
                                      setEditingMediaSourceRule((current) =>
                                        current ? { ...current, action } : current,
                                      )
                                    }}
                                    className="grid grid-cols-2 gap-2"
                                    disabled={busy}
                                  >
                                    <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs">
                                      <RadioGroupItem
                                        value="block"
                                        id={`media-source-edit-block-${item.position}`}
                                      />
                                      {t(
                                        'webSettingsRuleTools.mediaSource.actions.block',
                                      )}
                                    </label>
                                    <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs">
                                      <RadioGroupItem
                                        value="rename"
                                        id={`media-source-edit-rename-${item.position}`}
                                      />
                                      {t(
                                        'webSettingsRuleTools.mediaSource.actions.rename',
                                      )}
                                    </label>
                                  </RadioGroup>
                                  {editingMediaSourceRule?.action ===
                                  'rename' ? (
                                    <Input
                                      value={
                                        editingMediaSourceRule?.displayName ?? ''
                                      }
                                      onChange={(event) =>
                                        setEditingMediaSourceRule((current) =>
                                          current
                                            ? {
                                                ...current,
                                                displayName: event.target.value,
                                              }
                                            : current,
                                        )
                                      }
                                      placeholder={t(
                                        'webSettingsRuleTools.mediaSource.displayNamePlaceholder',
                                      )}
                                    />
                                  ) : null}
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={
                                        busy ||
                                        IsMediaSourceRuleIncomplete(
                                          editingMediaSourceRule,
                                        )
                                      }
                                      onClick={() => onSaveEditedMediaSourceRule()}
                                    >
                                      {t('common.save')}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      disabled={busy}
                                      onClick={onCancelEditMediaSourceRule}
                                    >
                                      {t('common.cancel')}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0 space-y-1">
                                    <p className="break-all font-mono text-sm text-foreground">
                                      {item.source}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {item.action === 'rename'
                                        ? t(
                                            'webSettingsRuleTools.mediaSource.renameSummary',
                                            {
                                              value: item.displayName ?? '',
                                            },
                                          )
                                        : t(
                                            'webSettingsRuleTools.mediaSource.blockSummary',
                                          )}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      disabled={busy}
                                      onClick={() =>
                                        onStartEditMediaSourceRule(item)
                                      }
                                    >
                                      {t('common.edit')}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      disabled={busy}
                                      onClick={() =>
                                        onRemoveMediaSourceRule(item.source)
                                      }
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
                    page={resolvedMediaSourceListPage}
                    pageSize={SETTINGS_APP_LIST_PAGE_SIZE}
                    total={filteredMediaSourceItems.length}
                    onPageChange={setMediaSourceListPage}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="shrink-0 border-t px-4 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
