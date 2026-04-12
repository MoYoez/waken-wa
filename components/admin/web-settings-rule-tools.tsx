'use client'

import { useAtom } from 'jotai'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
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
          emptyText={items.length > 0 ? '无匹配历史记录' : '未启用历史应用记录'}
        />
        <Button type="button" className="shrink-0" onClick={onAdd}>
          添加
        </Button>
      </div>

      {total === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">已有条目（分页）</p>
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
                      删除
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
      toast.success('已复制规则 JSON 到剪贴板')
    } catch {
      toast.error('复制失败，请重试')
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
      toast.success('已导出已使用应用 JSON')
    } catch {
      toast.error('导出失败，请重试')
    }
  }

  const confirmImportRules = () => {
    const raw = importRulesInput.trim()
    if (!raw) {
      toast.error('请先粘贴规则 JSON')
      return
    }
    const parsed = parseAppRulesJson(raw)
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
    toast.success('已写入规则到表单，请记得保存')
  }

  return (
    <>
      <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label className="text-base">应用匹配文案规则</Label>
            <p className="text-xs text-muted-foreground">已保存 {rulesTotal} 条</p>
          </div>
          <Button type="button" variant="secondary" className="shrink-0" onClick={() => setDialogAppRulesOpen(true)}>
            在弹窗中编辑
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/40 px-3 py-2.5">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="app-rule-show-process" className="font-normal cursor-pointer">
              命中规则时显示进程名
            </Label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              开启后为「文案 | 进程名」；关闭则仅显示规则文案（仍隐藏原标题）。
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
              <p className="text-xs text-muted-foreground">规则预览（前 3 条）</p>
              <ul className="space-y-2">
                {form.appMessageRules.slice(0, 3).map((rule, idx) => (
                  <li key={`${rule.match}-${idx}`} className="rounded-md border border-border/40 bg-background/55 px-3 py-2">
                    <p className="text-xs font-medium text-foreground/80 break-all font-mono">{rule.match || '未填写 match'}</p>
                    <p className="mt-1 text-sm text-muted-foreground break-words">{rule.text || '未填写 text'}</p>
                  </li>
                ))}
              </ul>
              {rulesTotal > 3 ? <p className="text-xs text-muted-foreground">其余 {rulesTotal - 3} 条可在弹窗中继续查看和编辑。</p> : null}
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
            <DialogTitle>应用匹配文案规则</DialogTitle>
            <DialogDescription>
              match 为进程/应用名，text 为展示文案；支持 {'{process}'}、{'{title}'} 占位符。
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-3">
              {form.appMessageRules.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无规则</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">已有规则</p>
                  {form.appMessageRules
                    .slice(rulesStart, rulesStart + SETTINGS_RULES_PAGE_SIZE)
                    .map((rule, localIdx) => {
                      const idx = rulesStart + localIdx
                      return (
                        <div key={idx} className="space-y-3 rounded-md border bg-background/50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground">
                              规则 {idx + 1} / 共 {rulesTotal} 条
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
                              删除
                            </Button>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`rule-match-${idx}`}>match（进程/应用名）</Label>
                            <Autocomplete
                              id={`rule-match-${idx}`}
                              items={appAutocompleteItems}
                              value={rule.match}
                              onValueChange={(value) => {
                                const next = [...form.appMessageRules]
                                next[idx] = { ...next[idx], match: value }
                                patch('appMessageRules', next)
                              }}
                              placeholder="例如：WindowsTerminal.exe"
                              showClear={false}
                              emptyText={
                                form.captureReportedAppsEnabled ? '无匹配历史应用' : '未启用历史应用记录'
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`rule-text-${idx}`}>text（替换文案）</Label>
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
                              placeholder="例如：正在编码：{title}"
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
                添加规则
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              示例：match 为 `WindowsTerminal.exe`，text 为 {'正在编码：{title}'}。
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Label className="text-base">应用显示筛选</Label>
          <p className="text-xs text-muted-foreground">
            {form.appFilterMode === 'blacklist' ? '黑名单' : '白名单'}模式 · 黑 {blTotal} / 白 {wlTotal} 条
          </p>
        </div>
        <Button type="button" variant="secondary" className="shrink-0" onClick={() => setDialogAppFilterOpen(true)}>
          在弹窗中编辑
        </Button>
      </div>

      <Dialog open={dialogAppFilterOpen} onOpenChange={setDialogAppFilterOpen}>
        <DialogContent
          className="flex max-h-[min(90vh,56rem)] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
          showCloseButton
        >
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle>应用显示筛选</DialogTitle>
            <DialogDescription>选择黑名单或白名单，并维护应用名列表（不区分大小写）。</DialogDescription>
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
                      黑名单模式
                    </Label>
                    <p className="text-xs text-muted-foreground">列表中的应用将从当前状态与历史记录中隐藏。</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="whitelist" id="filter-whitelist" className="mt-0.5" />
                  <div className="space-y-1">
                    <Label htmlFor="filter-whitelist" className="font-medium cursor-pointer">
                      白名单模式
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      仅列表中的应用会显示；白名单为空时不展示任何活动记录。
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
                    <Label htmlFor="blacklist-input">黑名单应用名</Label>
                    <AppNameListEditor
                      title="黑名单应用名"
                      description="不区分大小写，每行添加一个应用名。"
                      emptyText="暂无黑名单条目"
                      inputId="blacklist-input"
                      placeholder="例如：WeChat.exe"
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
                    <Label htmlFor="whitelist-input">白名单应用名</Label>
                    <AppNameListEditor
                      title="白名单应用名"
                      description="不区分大小写；仅这些应用会出现在前台。"
                      emptyText="白名单为空：前台不显示任何活动"
                      inputId="whitelist-input"
                      placeholder="例如：Code.exe"
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
          <Label className="text-base">仅显示应用名</Label>
          <p className="text-xs text-muted-foreground">已配置 {noTotal} 个应用</p>
        </div>
        <Button type="button" variant="secondary" className="shrink-0" onClick={() => setDialogNameOnlyOpen(true)}>
          在弹窗中编辑
        </Button>
      </WebSettingsInset>

      <WebSettingsInset className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Label className="text-base">媒体来源屏蔽规则（play_source）</Label>
          <p className="text-xs text-muted-foreground">已配置 {msTotal} 条</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            关闭「保存上报行为的应用记录」后不会再新增历史记录，但会保留已保存的历史数据。
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          onClick={() => setDialogMediaSourceOpen(true)}
        >
          在弹窗中编辑
        </Button>
      </WebSettingsInset>

      <WebSettingsRows>
        <WebSettingsRow
          htmlFor="capture-reported-apps"
          title="保存上报行为的应用记录（用于规则选择/导出）"
          description="关闭后不会再新增历史记录，但会保留已保存的历史数据。"
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
            <DialogTitle>媒体来源屏蔽规则</DialogTitle>
            <DialogDescription>
              当上报的 <code className="rounded bg-muted px-1">metadata.play_source</code> 命中时，将隐藏该条活动的媒体信息（仅移除 metadata.media）。
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <AppNameListEditor
              title="媒体来源屏蔽规则"
              description="输入来源值（建议小写）"
              emptyText="暂无屏蔽规则"
              inputId="mediaSource-input"
              placeholder="例如：system_media"
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
            <DialogTitle>仅显示应用名</DialogTitle>
            <DialogDescription>
              命中后只显示应用名，不显示窗口标题等详细内容（不区分大小写）。
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <AppNameListEditor
              title="仅显示应用名"
              description="输入应用名（不区分大小写）"
              emptyText="暂无“仅显示应用名”配置"
              inputId="nameOnly-input"
              placeholder="例如：Code.exe"
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
          导出已使用应用（JSON）
        </Button>
        <Button type="button" variant="outline" onClick={() => void copyRulesJson()}>
          复制规则 JSON
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setImportRulesInput('')
            setImportRulesDialogOpen(true)
          }}
        >
          导入规则 JSON
        </Button>
      </div>

      <Dialog open={importRulesDialogOpen} onOpenChange={setImportRulesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入规则 JSON</DialogTitle>
            <DialogDescription>
              将覆盖当前表单中的应用规则与媒体来源规则。写入后请点击保存配置。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="import-rules-input">规则 JSON</Label>
            <textarea
              id="import-rules-input"
              rows={10}
              value={importRulesInput}
              onChange={(e) => setImportRulesInput(e.target.value)}
              placeholder="粘贴 JSON（包含 version 与 rules 字段）"
              className="w-full rounded-md border bg-background px-3 py-2 text-xs font-mono leading-relaxed"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportRulesDialogOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={confirmImportRules}>
              导入并覆盖规则
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
