'use client'

import { useAtom } from 'jotai'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useT } from 'next-i18next/client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  getAdminPanelTransition,
  getAdminSectionVariants,
} from '@/components/admin/admin-motion'
import { exportAdminActivityApps } from '@/components/admin/admin-query-fetchers'
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
import {
  webSettingsFormAtom,
  webSettingsHistoryAppsAtom,
  webSettingsHistoryPlaySourcesAtom,
} from '@/components/admin/web-settings-store'
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
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'

function AppNameListEditor({
  title,
  description,
  emptyText,
  inputId,
  placeholder,
  items,
  value,
  inputValue,
  onInputValueChange,
  onAdd,
  onRemove,
  page,
  onPageChange,
  inputClassName,
}: {
  title: string
  description: string
  emptyText: string
  inputId: string
  placeholder: string
  items: string[]
  value: string[]
  inputValue: string
  onInputValueChange: (value: string) => void
  onAdd: () => void
  onRemove: (index: number) => void
  page: number
  onPageChange: (page: number) => void
  inputClassName?: string
}) {
  const { t } = useT('admin')
  const prefersReducedMotion = Boolean(useReducedMotion())
  const total = value.length
  const maxPage = listMaxPage(total, SETTINGS_APP_LIST_PAGE_SIZE)
  const safePage = Math.min(page, maxPage)
  const start = safePage * SETTINGS_APP_LIST_PAGE_SIZE
  const sectionTransition = getAdminPanelTransition(prefersReducedMotion)
  const sectionVariants = getAdminSectionVariants(prefersReducedMotion, {
    enterY: 10,
    exitY: 8,
    scale: 0.996,
  })

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Autocomplete
          id={inputId}
          items={items}
          value={inputValue}
          onValueChange={onInputValueChange}
          placeholder={placeholder}
          inputClassName={inputClassName}
          showClear={false}
          emptyText={
            items.length > 0
              ? t('webSettingsRuleTools.appNameListEditor.noMatchingHistory')
              : t('webSettingsRuleTools.appNameListEditor.historyDisabled')
          }
        />
        <Button type="button" className="shrink-0" onClick={onAdd}>
          {t('webSettingsRuleTools.appNameListEditor.add')}
        </Button>
      </div>

      {total === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {t('webSettingsRuleTools.appNameListEditor.savedItemsPaged')}
          </p>
          <motion.ul className="space-y-3" layout>
            <AnimatePresence initial={false}>
              {value.slice(start, start + SETTINGS_APP_LIST_PAGE_SIZE).map((item, localIdx) => {
                const idx = start + localIdx
                return (
                  <motion.li
                    key={`${item}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-md border bg-background/50 px-3 py-2.5"
                    variants={sectionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={sectionTransition}
                    layout
                  >
                    <span className="text-sm text-foreground break-all">{item}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => onRemove(idx)}
                    >
                      {t('common.delete')}
                    </Button>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </motion.ul>
          <ListPaginationBar
            page={page}
            pageSize={SETTINGS_APP_LIST_PAGE_SIZE}
            total={total}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  )
}

export function WebSettingsRuleTools() {
  const { t } = useT('admin')
  const [form, setForm] = useAtom(webSettingsFormAtom)
  const [historyApps] = useAtom(webSettingsHistoryAppsAtom)
  const [historyPlaySources] = useAtom(webSettingsHistoryPlaySourcesAtom)
  const prefersReducedMotion = Boolean(useReducedMotion())
  const patch = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const [blacklistInput, setBlacklistInput] = useState('')
  const [whitelistInput, setWhitelistInput] = useState('')
  const [nameOnlyListInput, setNameOnlyListInput] = useState('')
  const [mediaSourceInput, setMediaSourceInput] = useState('')
  const [rulesListPage, setRulesListPage] = useState(0)
  const [blacklistListPage, setBlacklistListPage] = useState(0)
  const [whitelistListPage, setWhitelistListPage] = useState(0)
  const [nameOnlyListPage, setNameOnlyListPage] = useState(0)
  const [mediaSourceListPage, setMediaSourceListPage] = useState(0)
  const [dialogAppRulesOpen, setDialogAppRulesOpen] = useState(false)
  const [dialogAppFilterOpen, setDialogAppFilterOpen] = useState(false)
  const [dialogNameOnlyOpen, setDialogNameOnlyOpen] = useState(false)
  const [dialogMediaSourceOpen, setDialogMediaSourceOpen] = useState(false)
  const [importRulesDialogOpen, setImportRulesDialogOpen] = useState(false)
  const [importRulesInput, setImportRulesInput] = useState('')

  const rulesTotal = form.appMessageRules.length
  const rulesPage = Math.min(rulesListPage, listMaxPage(rulesTotal, SETTINGS_RULES_PAGE_SIZE))
  const rulesStart = rulesPage * SETTINGS_RULES_PAGE_SIZE

  const blTotal = form.appBlacklist.length
  const wlTotal = form.appWhitelist.length
  const noTotal = form.appNameOnlyList.length
  const msTotal = form.mediaPlaySourceBlocklist.length

  const appAutocompleteItems = useMemo(
    () => (form.captureReportedAppsEnabled ? historyApps : []),
    [form.captureReportedAppsEnabled, historyApps],
  )
  const playSourceItems = useMemo(
    () => (form.captureReportedAppsEnabled ? historyPlaySources : []),
    [form.captureReportedAppsEnabled, historyPlaySources],
  )
  const sectionTransition = getAdminPanelTransition(prefersReducedMotion)
  const sectionVariants = getAdminSectionVariants(prefersReducedMotion, {
    enterY: 10,
    exitY: 8,
    scale: 0.996,
  })

  const resetEditorState = () => {
    setBlacklistInput('')
    setWhitelistInput('')
    setNameOnlyListInput('')
    setMediaSourceInput('')
    setRulesListPage(0)
    setBlacklistListPage(0)
    setWhitelistListPage(0)
    setNameOnlyListPage(0)
    setMediaSourceListPage(0)
  }

  const copyRulesJson = async () => {
    try {
      const json = exportAppRulesJson({
        appMessageRules: form.appMessageRules,
        appMessageRulesShowProcessName: form.appMessageRulesShowProcessName,
        appFilterMode: form.appFilterMode,
        appBlacklist: form.appBlacklist,
        appWhitelist: form.appWhitelist,
        appNameOnlyList: form.appNameOnlyList,
        mediaPlaySourceBlocklist: form.mediaPlaySourceBlocklist,
      })
      await navigator.clipboard.writeText(json)
      toast.success(t('webSettingsRuleTools.toasts.copiedRulesJson'))
    } catch {
      toast.error(t('common.copyFailedBrowserPermission'))
    }
  }

  const exportUsedAppsJson = async () => {
    try {
      const payload = JSON.stringify(await exportAdminActivityApps(), null, 2)
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      const a = document.createElement('a')
      a.href = url
      a.download = `apps-export-${ts}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(t('webSettingsRuleTools.toasts.exportedUsedAppsJson'))
    } catch {
      toast.error(t('query.exportFailed'))
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
    patch('appMessageRules', parsed.data.appMessageRules)
    patch('appMessageRulesShowProcessName', parsed.data.appMessageRulesShowProcessName)
    patch('appFilterMode', parsed.data.appFilterMode)
    patch('appBlacklist', parsed.data.appBlacklist)
    patch('appWhitelist', parsed.data.appWhitelist)
    patch('appNameOnlyList', parsed.data.appNameOnlyList)
    patch('mediaPlaySourceBlocklist', parsed.data.mediaPlaySourceBlocklist)
    resetEditorState()
    setImportRulesDialogOpen(false)
    toast.success(t('webSettingsRuleTools.toasts.importedRulesIntoForm'))
  }

  return (
    <>
      <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label className="text-base">{t('webSettingsRuleTools.appRules.title')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('webSettingsRuleTools.appRules.savedCount', { value: rulesTotal })}
            </p>
          </div>
          <Button type="button" variant="secondary" className="shrink-0" onClick={() => setDialogAppRulesOpen(true)}>
            {t('webSettingsRuleTools.editInDialog')}
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/40 px-3 py-2.5">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="app-rule-show-process" className="font-normal cursor-pointer">
              {t('webSettingsRuleTools.appRules.showProcessNameTitle')}
            </Label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('webSettingsRuleTools.appRules.showProcessNameDescription')}
            </p>
          </div>
          <Switch
            id="app-rule-show-process"
            checked={form.appMessageRulesShowProcessName}
            onCheckedChange={(v) => patch('appMessageRulesShowProcessName', v)}
            className="shrink-0"
          />
        </div>
        <AnimatePresence initial={false}>
          {rulesTotal > 0 ? (
            <motion.div
              className="space-y-2 rounded-md border border-border/50 bg-background/35 px-3 py-3"
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={sectionTransition}
              layout
            >
              <p className="text-xs text-muted-foreground">
                {t('webSettingsRuleTools.appRules.previewTop3')}
              </p>
              <ul className="space-y-2">
                {form.appMessageRules.slice(0, 3).map((rule, idx) => (
                  <li key={`${rule.match}-${idx}`} className="rounded-md border border-border/40 bg-background/55 px-3 py-2">
                    <p className="text-xs font-medium text-foreground/80 break-all font-mono">
                      {rule.match || t('webSettingsRuleTools.appRules.matchEmpty')}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground break-words">
                      {rule.text || t('webSettingsRuleTools.appRules.textEmpty')}
                    </p>
                  </li>
                ))}
              </ul>
              {rulesTotal > 3 ? (
                <p className="text-xs text-muted-foreground">
                  {t('webSettingsRuleTools.appRules.moreRulesHint', {
                    value: rulesTotal - 3,
                  })}
                </p>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <Dialog open={dialogAppRulesOpen} onOpenChange={setDialogAppRulesOpen}>
        <DialogContent
          className="flex max-h-[min(90vh,56rem)] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
          showCloseButton
        >
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle>{t('webSettingsRuleTools.appRules.title')}</DialogTitle>
            <DialogDescription>
              {t('webSettingsRuleTools.appRules.dialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-3">
              {form.appMessageRules.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('webSettingsRuleTools.appRules.noRules')}</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">{t('webSettingsRuleTools.appRules.savedRules')}</p>
                  {form.appMessageRules
                    .slice(rulesStart, rulesStart + SETTINGS_RULES_PAGE_SIZE)
                    .map((rule, localIdx) => {
                      const idx = rulesStart + localIdx
                      return (
                        <div key={idx} className="space-y-3 rounded-md border bg-background/50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground">
                              {t('webSettingsRuleTools.appRules.ruleIndex', {
                                index: idx + 1,
                                total: rulesTotal,
                              })}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                patch(
                                  'appMessageRules',
                                  form.appMessageRules.filter((_, i) => i !== idx),
                                )
                              }
                            >
                              {t('common.delete')}
                            </Button>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`rule-match-${idx}`}>
                              {t('webSettingsRuleTools.appRules.matchLabel')}
                            </Label>
                            <Autocomplete
                              id={`rule-match-${idx}`}
                              items={appAutocompleteItems}
                              value={rule.match}
                              onValueChange={(value) => {
                                const next = [...form.appMessageRules]
                                next[idx] = { ...next[idx], match: value }
                                patch('appMessageRules', next)
                              }}
                              placeholder={t('webSettingsRuleTools.appRules.matchPlaceholder')}
                              showClear={false}
                              emptyText={
                                form.captureReportedAppsEnabled
                                  ? t('webSettingsRuleTools.appRules.noMatchingHistoryApp')
                                  : t('webSettingsRuleTools.appNameListEditor.historyDisabled')
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`rule-text-${idx}`}>
                              {t('webSettingsRuleTools.appRules.textLabel')}
                            </Label>
                            <textarea
                              id={`rule-text-${idx}`}
                              rows={3}
                              value={rule.text}
                              onChange={(e) => {
                                const next = [...form.appMessageRules]
                                next[idx] = { ...next[idx], text: e.target.value }
                                patch('appMessageRules', next)
                              }}
                              className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
                              placeholder={t('webSettingsRuleTools.appRules.textPlaceholder')}
                            />
                          </div>
                        </div>
                      )
                    })}
                  <ListPaginationBar
                    page={rulesListPage}
                    pageSize={SETTINGS_RULES_PAGE_SIZE}
                    total={rulesTotal}
                    onPageChange={setRulesListPage}
                  />
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const next = [...form.appMessageRules, { match: '', text: '' }]
                  patch('appMessageRules', next)
                  setRulesListPage(listMaxPage(next.length, SETTINGS_RULES_PAGE_SIZE))
                }}
              >
                {t('webSettingsRuleTools.appRules.addRule')}
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {t('webSettingsRuleTools.appRules.example')}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Label className="text-base">{t('webSettingsRuleTools.appFilter.title')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('webSettingsRuleTools.appFilter.summary', {
              mode:
                form.appFilterMode === 'blacklist'
                  ? t('webSettingsRuleTools.appFilter.blacklistMode')
                  : t('webSettingsRuleTools.appFilter.whitelistMode'),
              blacklist: blTotal,
              whitelist: wlTotal,
            })}
          </p>
        </div>
        <Button type="button" variant="secondary" className="shrink-0" onClick={() => setDialogAppFilterOpen(true)}>
          {t('webSettingsRuleTools.editInDialog')}
        </Button>
      </div>

      <Dialog open={dialogAppFilterOpen} onOpenChange={setDialogAppFilterOpen}>
        <DialogContent
          className="flex max-h-[min(90vh,56rem)] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
          showCloseButton
        >
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle>{t('webSettingsRuleTools.appFilter.title')}</DialogTitle>
            <DialogDescription>{t('webSettingsRuleTools.appFilter.dialogDescription')}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4 rounded-lg border border-border/60 bg-card/30 p-4">
              <RadioGroup
                value={form.appFilterMode}
                onValueChange={(v) => patch('appFilterMode', v as 'blacklist' | 'whitelist')}
                className="gap-3"
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="blacklist" id="filter-blacklist" className="mt-0.5" />
                  <div className="space-y-1">
                    <Label htmlFor="filter-blacklist" className="font-medium cursor-pointer">
                      {t('webSettingsRuleTools.appFilter.blacklistMode')}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t('webSettingsRuleTools.appFilter.blacklistDescription')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="whitelist" id="filter-whitelist" className="mt-0.5" />
                  <div className="space-y-1">
                    <Label htmlFor="filter-whitelist" className="font-medium cursor-pointer">
                      {t('webSettingsRuleTools.appFilter.whitelistMode')}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t('webSettingsRuleTools.appFilter.whitelistDescription')}
                    </p>
                  </div>
                </div>
              </RadioGroup>

              <AnimatePresence mode="wait" initial={false}>
                {form.appFilterMode === 'blacklist' ? (
                  <motion.div
                    key="rule-blacklist-editor"
                    className="space-y-3 border-t border-border/50 pt-2"
                    variants={sectionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={sectionTransition}
                    layout
                  >
                    <Label htmlFor="blacklist-input">
                      {t('webSettingsRuleTools.appFilter.blacklistInputLabel')}
                    </Label>
                    <AppNameListEditor
                      title={t('webSettingsRuleTools.appFilter.blacklistInputLabel')}
                      description={t('webSettingsRuleTools.appFilter.blacklistInputDescription')}
                      emptyText={t('webSettingsRuleTools.appFilter.blacklistEmpty')}
                      inputId="blacklist-input"
                      placeholder={t('webSettingsRuleTools.appFilter.blacklistPlaceholder')}
                      items={appAutocompleteItems}
                      value={form.appBlacklist}
                      inputValue={blacklistInput}
                      onInputValueChange={setBlacklistInput}
                      onAdd={() => {
                        const value = blacklistInput.trim()
                        if (!value) return
                        const exists = form.appBlacklist.some((x) => x.toLowerCase() === value.toLowerCase())
                        if (exists) return
                        const next = [...form.appBlacklist, value]
                        patch('appBlacklist', next)
                        setBlacklistInput('')
                        setBlacklistListPage(listMaxPage(next.length, SETTINGS_APP_LIST_PAGE_SIZE))
                      }}
                      onRemove={(index) =>
                        patch(
                          'appBlacklist',
                          form.appBlacklist.filter((_, i) => i !== index),
                        )
                      }
                      page={blacklistListPage}
                      onPageChange={setBlacklistListPage}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="rule-whitelist-editor"
                    className="space-y-3 border-t border-border/50 pt-2"
                    variants={sectionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={sectionTransition}
                    layout
                  >
                    <Label htmlFor="whitelist-input">
                      {t('webSettingsRuleTools.appFilter.whitelistInputLabel')}
                    </Label>
                    <AppNameListEditor
                      title={t('webSettingsRuleTools.appFilter.whitelistInputLabel')}
                      description={t('webSettingsRuleTools.appFilter.whitelistInputDescription')}
                      emptyText={t('webSettingsRuleTools.appFilter.whitelistEmpty')}
                      inputId="whitelist-input"
                      placeholder={t('webSettingsRuleTools.appFilter.whitelistPlaceholder')}
                      items={appAutocompleteItems}
                      value={form.appWhitelist}
                      inputValue={whitelistInput}
                      onInputValueChange={setWhitelistInput}
                      onAdd={() => {
                        const value = whitelistInput.trim()
                        if (!value) return
                        const exists = form.appWhitelist.some((x) => x.toLowerCase() === value.toLowerCase())
                        if (exists) return
                        const next = [...form.appWhitelist, value]
                        patch('appWhitelist', next)
                        setWhitelistInput('')
                        setWhitelistListPage(listMaxPage(next.length, SETTINGS_APP_LIST_PAGE_SIZE))
                      }}
                      onRemove={(index) =>
                        patch(
                          'appWhitelist',
                          form.appWhitelist.filter((_, i) => i !== index),
                        )
                      }
                      page={whitelistListPage}
                      onPageChange={setWhitelistListPage}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <WebSettingsInset className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Label className="text-base">{t('webSettingsRuleTools.nameOnly.title')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('webSettingsRuleTools.nameOnly.count', { value: noTotal })}
          </p>
        </div>
        <Button type="button" variant="secondary" className="shrink-0" onClick={() => setDialogNameOnlyOpen(true)}>
          {t('webSettingsRuleTools.editInDialog')}
        </Button>
      </WebSettingsInset>

      <WebSettingsInset className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Label className="text-base">{t('webSettingsRuleTools.mediaSource.title')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('webSettingsRuleTools.mediaSource.count', { value: msTotal })}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('webSettingsRuleTools.captureReportedApps.description')}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          onClick={() => setDialogMediaSourceOpen(true)}
        >
          {t('webSettingsRuleTools.editInDialog')}
        </Button>
      </WebSettingsInset>

      <WebSettingsRows>
        <WebSettingsRow
          htmlFor="capture-reported-apps"
          title={t('webSettingsRuleTools.captureReportedApps.title')}
          description={t('webSettingsRuleTools.captureReportedApps.description')}
          action={
            <Switch
              id="capture-reported-apps"
              checked={form.captureReportedAppsEnabled}
              onCheckedChange={(v) => patch('captureReportedAppsEnabled', v)}
              className="shrink-0"
            />
          }
        />
      </WebSettingsRows>

      <Dialog open={dialogMediaSourceOpen} onOpenChange={setDialogMediaSourceOpen}>
        <DialogContent
          className="flex max-h-[min(90vh,48rem)] w-[calc(100vw-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
          showCloseButton
        >
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle>{t('webSettingsRuleTools.mediaSource.title')}</DialogTitle>
            <DialogDescription>
              {t('webSettingsRuleTools.mediaSource.dialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <AppNameListEditor
              title={t('webSettingsRuleTools.mediaSource.title')}
              description={t('webSettingsRuleTools.mediaSource.inputDescription')}
              emptyText={t('webSettingsRuleTools.mediaSource.empty')}
              inputId="mediaSource-input"
              placeholder={t('webSettingsRuleTools.mediaSource.placeholder')}
              items={playSourceItems}
              value={form.mediaPlaySourceBlocklist}
              inputValue={mediaSourceInput}
              onInputValueChange={setMediaSourceInput}
              onAdd={() => {
                const value = mediaSourceInput.trim().toLowerCase()
                if (!value) return
                const exists = form.mediaPlaySourceBlocklist.some((x) => x.toLowerCase() === value)
                if (exists) return
                const next = [...form.mediaPlaySourceBlocklist, value]
                patch('mediaPlaySourceBlocklist', next)
                setMediaSourceInput('')
                setMediaSourceListPage(listMaxPage(next.length, SETTINGS_APP_LIST_PAGE_SIZE))
              }}
              onRemove={(index) =>
                patch(
                  'mediaPlaySourceBlocklist',
                  form.mediaPlaySourceBlocklist.filter((_, i) => i !== index),
                )
              }
              page={mediaSourceListPage}
              onPageChange={setMediaSourceListPage}
              inputClassName="flex-1 min-w-[240px] font-mono text-xs"
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogNameOnlyOpen} onOpenChange={setDialogNameOnlyOpen}>
        <DialogContent
          className="flex max-h-[min(90vh,48rem)] w-[calc(100vw-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
          showCloseButton
        >
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle>{t('webSettingsRuleTools.nameOnly.title')}</DialogTitle>
            <DialogDescription>
              {t('webSettingsRuleTools.nameOnly.dialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <AppNameListEditor
              title={t('webSettingsRuleTools.nameOnly.title')}
              description={t('webSettingsRuleTools.nameOnly.inputDescription')}
              emptyText={t('webSettingsRuleTools.nameOnly.empty')}
              inputId="nameOnly-input"
              placeholder={t('webSettingsRuleTools.nameOnly.placeholder')}
              items={appAutocompleteItems}
              value={form.appNameOnlyList}
              inputValue={nameOnlyListInput}
              onInputValueChange={setNameOnlyListInput}
              onAdd={() => {
                const value = nameOnlyListInput.trim()
                if (!value) return
                const exists = form.appNameOnlyList.some((x) => x.toLowerCase() === value.toLowerCase())
                if (exists) return
                const next = [...form.appNameOnlyList, value]
                patch('appNameOnlyList', next)
                setNameOnlyListInput('')
                setNameOnlyListPage(listMaxPage(next.length, SETTINGS_APP_LIST_PAGE_SIZE))
              }}
              onRemove={(index) =>
                patch(
                  'appNameOnlyList',
                  form.appNameOnlyList.filter((_, i) => i !== index),
                )
              }
              page={nameOnlyListPage}
              onPageChange={setNameOnlyListPage}
            />
          </div>
        </DialogContent>
      </Dialog>

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
          onClick={() => {
            setImportRulesInput('')
            setImportRulesDialogOpen(true)
          }}
        >
          {t('webSettingsRuleTools.actions.importRulesJson')}
        </Button>
      </div>

      <Dialog open={importRulesDialogOpen} onOpenChange={setImportRulesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('webSettingsRuleTools.importDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('webSettingsRuleTools.importDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="import-rules-input">{t('webSettingsRuleTools.importDialog.label')}</Label>
            <textarea
              id="import-rules-input"
              rows={10}
              value={importRulesInput}
              onChange={(e) => setImportRulesInput(e.target.value)}
              placeholder={t('webSettingsRuleTools.importDialog.placeholder')}
              className="w-full rounded-md border bg-background px-3 py-2 text-xs font-mono leading-relaxed"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportRulesDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={confirmImportRules}>
              {t('webSettingsRuleTools.importDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
