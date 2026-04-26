'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useT } from 'next-i18next/client'

import {
  getAdminPanelTransition,
  getAdminSectionVariants,
} from '@/components/admin/admin-motion'
import {
  ListPaginationBar,
  SETTINGS_APP_LIST_PAGE_SIZE,
} from '@/components/admin/web-settings-paging'
import { Autocomplete } from '@/components/ui/autocomplete'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { RuleToolsListItem } from '@/types/rule-tools'

export function ListDialogEditor({
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
