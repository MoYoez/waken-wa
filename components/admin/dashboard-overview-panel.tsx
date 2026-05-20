'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CircleHelp,
  Clock3,
  Loader2,
  MonitorSmartphone,
  OctagonX,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react'
import { useT } from 'next-i18next/client'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { fetchAdminSettings } from '@/components/admin/admin-query-fetchers'
import { adminQueryKeys } from '@/components/admin/admin-query-keys'
import { patchAdminSettingsCore } from '@/components/admin/admin-query-mutations'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  formatTodayStatusDateTimeLocal,
  normalizeTodayStatusBusy,
  normalizeTodayStatusEmoji,
  normalizeTodayStatusExpiresAt,
  normalizeTodayStatusText,
  parseTodayStatusDateTimeLocal,
  TODAY_STATUS_TEXT_MAX_LENGTH,
} from '@/lib/today-status'
import {
  detectBrowserUserAgentPlatform,
  type UserAgentPlatform,
} from '@/lib/user-agent'
import type { ActivityFeedItem } from '@/types/activity'

import { AddActivityForm } from './add-activity-form'
import {
  BuildRecentRecordSummary,
  FormatOverviewClock,
  FormatOverviewDate,
  FormatOverviewRelativeTime,
  GetRecordPushMode,
  type OverviewFormatPattern,
} from './dashboard-utils'

type TodayStatusForm = {
  emoji: string
  text: string
  expiresAt: string
  busy: boolean
}

const TODAY_STATUS_EMOJI_PRESETS = ['🙂', '💻', '📚', '🎧', '☕', '🌙', '🔥', '✨']
const EMPTY_TODAY_STATUS_FORM: TodayStatusForm = {
  emoji: '',
  text: '',
  expiresAt: '',
  busy: false,
}

interface DashboardOverviewPanelProps {
  viewerCount: number
  viewerCountLoading: boolean
  viewerCountError: boolean
  viewerCountUpdatedAt: string | null | undefined
  recentActivityUsage: ActivityFeedItem[]
  recentActivityUsageLoading: boolean
  recentActivityUsageFetching: boolean
  locale: string
  formatPattern: OverviewFormatPattern
  onRefreshRecentActivity: () => void
  onOpenDevices: () => void
  onEndActivity: (recordId: number) => Promise<void>
  endingActivityId: number | null
  endingActivityPending: boolean
}

function buildTodayStatusForm(data: Record<string, unknown> | null | undefined): TodayStatusForm {
  return {
    emoji: normalizeTodayStatusEmoji(data?.todayStatusEmoji),
    text: normalizeTodayStatusText(data?.todayStatusText),
    expiresAt: normalizeTodayStatusExpiresAt(data?.todayStatusExpiresAt),
    busy: normalizeTodayStatusBusy(data?.todayStatusBusy),
  }
}

function getEmojiShortcutKeys(platform: UserAgentPlatform): string[] {
  switch (platform) {
    case 'windows':
      return ['Win', '.']
    case 'linux':
      return ['Shift', 'Ctrl', 'Alt', 'U']
    case 'macos':
      return ['Fn', 'E']
    case 'mobile':
    case 'unknown':
      return []
  }
}

export function DashboardOverviewPanel({
  viewerCount,
  viewerCountLoading,
  viewerCountError,
  viewerCountUpdatedAt,
  recentActivityUsage,
  recentActivityUsageLoading,
  recentActivityUsageFetching,
  locale,
  formatPattern,
  onRefreshRecentActivity,
  onOpenDevices,
  onEndActivity,
  endingActivityId,
  endingActivityPending,
}: DashboardOverviewPanelProps) {
  const { t } = useT('admin')
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({
    queryKey: adminQueryKeys.settings.detail(),
    queryFn: fetchAdminSettings,
  })
  const serverTodayStatus = useMemo(
    () => buildTodayStatusForm(settingsQuery.data),
    [settingsQuery.data],
  )
  const [todayStatusForm, setTodayStatusForm] = useState<TodayStatusForm>(serverTodayStatus)
  const [userAgentPlatform, setUserAgentPlatform] = useState<UserAgentPlatform>('unknown')

  useEffect(() => {
    setTodayStatusForm(serverTodayStatus)
  }, [serverTodayStatus])

  useEffect(() => {
    setUserAgentPlatform(detectBrowserUserAgentPlatform())
  }, [])

  const saveTodayStatusMutation = useMutation({
    mutationFn: async (form: TodayStatusForm) =>
      patchAdminSettingsCore({
        todayStatusEmoji: normalizeTodayStatusEmoji(form.emoji) || null,
        todayStatusText: normalizeTodayStatusText(form.text) || null,
        todayStatusExpiresAt: normalizeTodayStatusExpiresAt(form.expiresAt) || null,
        todayStatusBusy: normalizeTodayStatusBusy(form.busy),
      }),
    onSuccess: async () => {
      toast.success(t('dashboard.todayStatus.saved'))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.settings.detail() }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.activity.publicFeed() }),
      ])
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('mutation.saveFailed'))
    },
  })

  const todayStatusDateTimeLocal = formatTodayStatusDateTimeLocal(todayStatusForm.expiresAt)
  const todayStatusDirty =
    todayStatusForm.emoji !== serverTodayStatus.emoji ||
    todayStatusForm.text !== serverTodayStatus.text ||
    todayStatusForm.expiresAt !== serverTodayStatus.expiresAt ||
    todayStatusForm.busy !== serverTodayStatus.busy
  const todayStatusSaving = saveTodayStatusMutation.isPending
  const todayStatusHasValue =
    todayStatusForm.emoji.trim().length > 0 ||
    todayStatusForm.text.trim().length > 0 ||
    todayStatusForm.expiresAt.trim().length > 0 ||
    todayStatusForm.busy
  const emojiShortcutKeys = getEmojiShortcutKeys(userAgentPlatform)
  const patchTodayStatus = <K extends keyof TodayStatusForm>(
    key: K,
    value: TodayStatusForm[K],
  ) => {
    setTodayStatusForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              <Users className="h-4 w-4" />
              {t('dashboard.viewerCountTitle')}
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              {t('dashboard.viewerCountDescription')}
            </p>
          </div>
          <div className="rounded-full border border-primary/25 bg-primary/10 p-3 text-primary shadow-sm">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-4xl font-semibold tracking-tight tabular-nums text-foreground">
              {viewerCount}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {viewerCountError
                ? t('dashboard.viewerCountLoadFailed')
                : viewerCountLoading && !viewerCountUpdatedAt
                  ? t('dashboard.viewerCountLoading')
                  : viewerCountUpdatedAt
                    ? t('dashboard.viewerCountLastUpdated', {
                        value: FormatOverviewRelativeTime(
                          viewerCountUpdatedAt,
                          locale,
                          t('dashboard.justNow'),
                        ),
                      })
                    : t('dashboard.viewerCountWaiting')}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground">
            <RefreshCw
              className={`h-3.5 w-3.5 ${viewerCountLoading && !viewerCountUpdatedAt ? 'animate-spin' : ''}`}
            />
            <span>
              {viewerCountUpdatedAt ? FormatOverviewClock(viewerCountUpdatedAt, formatPattern) : '--:--:--'}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              <Clock3 className="h-4 w-4" />
              {t('dashboard.todayStatus.title')}
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              {t('dashboard.todayStatus.description')}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setTodayStatusForm(EMPTY_TODAY_STATUS_FORM)
                saveTodayStatusMutation.mutate(EMPTY_TODAY_STATUS_FORM)
              }}
              disabled={settingsQuery.isLoading || !todayStatusHasValue || todayStatusSaving}
            >
              {todayStatusSaving ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-4 w-4" />
              )}
              {t('dashboard.todayStatus.clear')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => saveTodayStatusMutation.mutate(todayStatusForm)}
              disabled={settingsQuery.isLoading || !todayStatusDirty || todayStatusSaving}
            >
              {todayStatusSaving ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : null}
              {todayStatusSaving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <div className="space-y-3 rounded-lg border border-border bg-muted/15 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="overview-today-status-emoji">
                {t('dashboard.todayStatus.emojiLabel')}
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={t('dashboard.todayStatus.emojiHelpAria')}
                  >
                    <CircleHelp className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-72 text-left leading-5">
                  {userAgentPlatform === 'mobile' ? (
                    <span>{t('dashboard.todayStatus.emojiHelpMobile')}</span>
                  ) : emojiShortcutKeys.length > 0 ? (
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <span>{t('dashboard.todayStatus.emojiHelpDesktopPrefix')}</span>
                      <KbdGroup>
                        {emojiShortcutKeys.map((key) => (
                          <Kbd key={key}>{key}</Kbd>
                        ))}
                      </KbdGroup>
                    </span>
                  ) : (
                    <span>{t('dashboard.todayStatus.emojiHelpUnknown')}</span>
                  )}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border bg-background text-3xl shadow-sm">
                {todayStatusForm.emoji || t('dashboard.todayStatus.emojiFallback')}
              </div>
              <Input
                id="overview-today-status-emoji"
                value={todayStatusForm.emoji}
                maxLength={8}
                onChange={(event) => patchTodayStatus('emoji', event.target.value)}
                placeholder={t('dashboard.todayStatus.emojiPlaceholder')}
                disabled={settingsQuery.isLoading || todayStatusSaving}
                className="text-center text-2xl"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TODAY_STATUS_EMOJI_PRESETS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => patchTodayStatus('emoji', emoji)}
                  disabled={settingsQuery.isLoading || todayStatusSaving}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-base shadow-xs transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={t('dashboard.todayStatus.presetEmojiAria', { value: emoji })}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="overview-today-status-text">
              {t('dashboard.todayStatus.textLabel')}
            </Label>
            <Textarea
              id="overview-today-status-text"
              value={todayStatusForm.text}
              maxLength={TODAY_STATUS_TEXT_MAX_LENGTH}
              onChange={(event) => patchTodayStatus('text', event.target.value)}
              placeholder={t('dashboard.todayStatus.textPlaceholder')}
              disabled={settingsQuery.isLoading || todayStatusSaving}
              className="min-h-24 resize-y"
            />
            <p className="text-[11px] text-muted-foreground">
              {t('dashboard.todayStatus.textCount', {
                count: todayStatusForm.text.length,
                max: TODAY_STATUS_TEXT_MAX_LENGTH,
              })}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="overview-today-status-expires-at">
              {t('dashboard.todayStatus.expiresAtLabel')}
            </Label>
            <Input
              id="overview-today-status-expires-at"
              type="datetime-local"
              value={todayStatusDateTimeLocal}
              onChange={(event) =>
                patchTodayStatus('expiresAt', parseTodayStatusDateTimeLocal(event.target.value))
              }
              disabled={settingsQuery.isLoading || todayStatusSaving}
            />
            <p className="text-xs text-muted-foreground">
              {t('dashboard.todayStatus.expiresAtHint')}
            </p>
          </div>

          <div className="flex items-end">
            <div className="w-full rounded-lg border border-border bg-muted/15 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="overview-today-status-busy"
                    className="cursor-pointer font-normal"
                  >
                    {t('dashboard.todayStatus.busyTitle')}
                  </Label>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t('dashboard.todayStatus.busyDescription')}
                  </p>
                </div>
                <Switch
                  id="overview-today-status-busy"
                  checked={todayStatusForm.busy}
                  onCheckedChange={(value) => patchTodayStatus('busy', value)}
                  disabled={settingsQuery.isLoading || todayStatusSaving}
                  className="shrink-0"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <Clock3 className="h-4 w-4" />
            {t('dashboard.quickAddTitle')}
          </h3>
          <Button type="button" variant="outline" size="sm" onClick={onOpenDevices}>
            <MonitorSmartphone className="mr-1 h-4 w-4" />
            {t('dashboard.openDeviceManager')}
          </Button>
        </div>
        <AddActivityForm />
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              <Clock3 className="h-4 w-4" />
              {t('dashboard.recentRecordsTitle')}
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              {t('dashboard.recentRecordsDescription')}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefreshRecentActivity}
            disabled={recentActivityUsageFetching}
          >
            {recentActivityUsageFetching ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-4 w-4" />
            )}
            {t('common.refresh')}
          </Button>
        </div>

        {recentActivityUsageLoading ? (
          <div className="rounded-lg border border-border bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
            {t('dashboard.recentRecordsLoading')}
          </div>
        ) : recentActivityUsage.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
            {t('dashboard.recentRecordsEmpty')}
          </div>
        ) : (
          <div className="space-y-0">
            {recentActivityUsage.map((record, index) => {
              const recordTime = record.lastReportAt || record.updatedAt || record.startedAt
              const summary = BuildRecentRecordSummary(record, t('dashboard.noStatusDescription'))
              const isPersistentRecord =
                GetRecordPushMode(record) === 'active' && typeof record.id === 'number'
              const persistentRecordId = isPersistentRecord ? (record.id as number) : null
              const endingThisRecord =
                persistentRecordId !== null &&
                endingActivityPending &&
                endingActivityId === persistentRecordId

              return (
                <div
                  key={record.id}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[88px_minmax(0,1fr)] sm:gap-4"
                >
                  <div className="hidden pt-1 text-right sm:block">
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {FormatOverviewClock(recordTime, formatPattern)}
                    </p>
                    <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                      {FormatOverviewDate(recordTime, formatPattern, t('common.unknownTime'))}
                    </p>
                  </div>

                  <div className="relative pb-5 pl-7 sm:pl-0">
                    {index !== recentActivityUsage.length - 1 ? (
                      <div className="absolute left-[7px] top-7 h-[calc(100%-1rem)] w-px bg-border sm:left-[7px]" />
                    ) : null}
                    <div className="absolute left-0 top-1.5 h-4 w-4 rounded-full border border-primary/30 bg-primary/15">
                      <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
                    </div>

                    <div className="rounded-xl border border-border bg-muted/15 px-4 py-3 sm:ml-7">
                      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground sm:hidden">
                        <span className="font-semibold tabular-nums text-foreground">
                          {FormatOverviewClock(recordTime, formatPattern)}
                        </span>
                        <span>{FormatOverviewDate(recordTime, formatPattern, t('common.unknownTime'))}</span>
                        <span>·</span>
                        <span>{FormatOverviewRelativeTime(recordTime, locale, t('dashboard.justNow'))}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-sm font-medium leading-6 text-foreground">{summary}</p>
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          {FormatOverviewRelativeTime(recordTime, locale, t('dashboard.justNow'))}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {record.device || t('dashboard.unknownDevice')}
                        {record.processName ? ` · ${record.processName}` : ''}
                      </p>
                      {isPersistentRecord ? (
                        <div className="mt-3">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button type="button" variant="outline" size="sm" disabled={endingThisRecord}>
                                {endingThisRecord ? (
                                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                ) : (
                                  <OctagonX className="mr-1 h-4 w-4" />
                                )}
                                {t('dashboard.endActivityNow')}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('dashboard.confirmEndActivityTitle')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('dashboard.confirmEndActivityDescription', { summary })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                  disabled={endingThisRecord}
                                  onClick={() =>
                                    persistentRecordId !== null
                                      ? void onEndActivity(persistentRecordId)
                                      : undefined
                                  }
                                >
                                  {endingThisRecord ? t('dashboard.endingActivity') : t('dashboard.confirmEnd')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
