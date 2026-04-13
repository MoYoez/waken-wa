'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Clock3,
  Download,
  Home,
  Loader2,
  LogOut,
  MonitorSmartphone,
  OctagonX,
  Plus,
  RefreshCw,
  Upload,
  Users,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useT } from 'next-i18next/client'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { MdAutoFixHigh } from 'react-icons/md'
import { toast } from 'sonner'

import {
  getAdminIndicatorTransition,
  getAdminPanelTransition,
  getAdminPanelVariants,
} from '@/components/admin/admin-motion'
import { fetchActivityFeed } from '@/components/admin/admin-query-fetchers'
import { adminQueryKeys } from '@/components/admin/admin-query-keys'
import { endAdminActivity, logoutAdmin } from '@/components/admin/admin-query-mutations'
import { AdminQueryProvider } from '@/components/admin/admin-query-provider'
import { useSiteTimeFormat } from '@/components/site-timezone-provider'
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
import {
  ADMIN_DASHBOARD_TAB_ITEMS,
  ADMIN_DASHBOARD_VALID_TABS,
  ADMIN_RECENT_ACTIVITY_USAGE_LIMIT,
  ADMIN_SHORT_EVENT_FILTER_MS,
} from '@/constants/admin-dashboard'
import { useViewerCount } from '@/hooks/use-viewer-count'
import { normalizeRequestLanguage } from '@/lib/i18n/request-locale'
import type { ActivityFeedItem } from '@/types/activity'
import type { AdminTabValue } from '@/types/admin-dashboard'

import { AccountSettings } from './account-settings'
import { AddActivityForm } from './add-activity-form'
import { DeviceManager } from './device-manager'
import { InspirationManager } from './inspiration-manager'
import { OrphanImages, type OrphanImagesHandle } from './orphan-images'
import { ScheduleManager, type ScheduleManagerHandle } from './schedule-manager'
import { TokenManager, type TokenManagerHandle } from './token-manager'
import { WebSettings } from './web-settings'

function isAdminTabValue(value: string | undefined): value is AdminTabValue {
  return !!value && ADMIN_DASHBOARD_VALID_TABS.has(value as AdminTabValue)
}

interface DashboardProps {
  username: string
  initialTab?: string
  initialDeviceHash?: string
}

function subscribeToWindowLocationOrigin() {
  return () => {}
}

function getWindowLocationOrigin() {
  return window.location.origin
}

function getServerLocationOriginSnapshot() {
  return ''
}

function formatOverviewClock(
  value: string | null | undefined,
  formatPattern: (value: Date | string | number | null | undefined, pattern: string, fallback?: string) => string,
): string {
  return formatPattern(value, 'HH:mm:ss', '--:--:--')
}

function formatOverviewDate(
  value: string | null | undefined,
  formatPattern: (value: Date | string | number | null | undefined, pattern: string, fallback?: string) => string,
  fallback: string,
): string {
  return formatPattern(value, 'MM/dd', fallback)
}

function formatOverviewRelativeTime(
  value: string | null | undefined,
  locale: string,
  justNowLabel: string,
): string {
  const time = Date.parse(String(value ?? ''))
  if (!Number.isFinite(time)) return justNowLabel

  const diffMs = time - Date.now()
  const absMs = Math.abs(diffMs)
  const normalizedLocale = normalizeRequestLanguage(locale) === 'zh-CN' ? 'zh-CN' : 'en'
  const rtf = new Intl.RelativeTimeFormat(normalizedLocale, { numeric: 'auto' })

  if (absMs < 60_000) return justNowLabel
  if (absMs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), 'minute')
  if (absMs < 86_400_000) return rtf.format(Math.round(diffMs / 3_600_000), 'hour')
  return rtf.format(Math.round(diffMs / 86_400_000), 'day')
}

function buildRecentRecordSummary(
  record: ActivityFeedItem,
  emptyDescription: string,
): string {
  const statusLine = typeof record.statusText === 'string' ? record.statusText.trim() : ''
  if (statusLine) return statusLine
  if (record.processTitle?.trim()) return record.processTitle.trim()
  if (record.processName?.trim()) return record.processName.trim()
  return emptyDescription
}

function getRecordPushMode(record: ActivityFeedItem): 'realtime' | 'active' {
  if (record.pushMode === 'active' || record.pushMode === 'realtime') return record.pushMode
  const meta =
    record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata)
      ? (record.metadata as Record<string, unknown>)
      : null
  const mode = String(meta?.pushMode ?? '').trim().toLowerCase()
  return mode === 'active' || mode === 'persistent' ? 'active' : 'realtime'
}

function shouldShowRecentRecord(record: ActivityFeedItem): boolean {
  if (getRecordPushMode(record) === 'active') return true

  const startedAtMs = Date.parse(String(record.startedAt ?? ''))
  if (!Number.isFinite(startedAtMs)) return true

  const reportedAtMs = Date.parse(
    String(record.endedAt || record.lastReportAt || record.updatedAt || record.startedAt || ''),
  )
  const fallbackEndMs = Number.isFinite(reportedAtMs) ? reportedAtMs : startedAtMs
  const effectiveEndMs = record.endedAt ? fallbackEndMs : Math.max(fallbackEndMs, Date.now())

  return effectiveEndMs - startedAtMs >= ADMIN_SHORT_EVENT_FILTER_MS
}

function BottomGuide({
  title,
  description,
  code,
}: {
  title: string
  description: React.ReactNode
  code: string
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-card p-5">
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <div className="text-sm leading-6 text-muted-foreground">{description}</div>
      </div>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-6">
        {code}
      </pre>
    </section>
  )
}

function AdminDashboardContent({ username, initialTab, initialDeviceHash }: DashboardProps) {
  const { i18n, t } = useT('admin')
  const router = useRouter()
  const queryClient = useQueryClient()
  const { formatPattern } = useSiteTimeFormat()
  const [activeTab, setActiveTab] = useState<AdminTabValue>(() =>
    isAdminTabValue(initialTab) ? initialTab : 'overview',
  )
  const origin = useSyncExternalStore(
    subscribeToWindowLocationOrigin,
    getWindowLocationOrigin,
    getServerLocationOriginSnapshot,
  )
  const prefersReducedMotion = Boolean(useReducedMotion())
  const {
    count: viewerCount,
    loading: viewerCountLoading,
    error: viewerCountError,
    lastUpdatedAt: viewerCountUpdatedAt,
  } = useViewerCount({
    mode: 'readonly',
    enabled: activeTab === 'overview',
  })

  const tokenManagerRef = useRef<TokenManagerHandle | null>(null)
  const orphanImagesRef = useRef<OrphanImagesHandle | null>(null)
  const scheduleManagerRef = useRef<ScheduleManagerHandle | null>(null)
  const tabsRailRef = useRef<HTMLDivElement | null>(null)
  const triggerRefs = useRef<Record<AdminTabValue, HTMLButtonElement | null>>({
    overview: null,
    inspiration: null,
    schedule: null,
    devices: null,
    tokens: null,
    account: null,
    'orphan-images': null,
    settings: null,
  })
  const tabIndicatorTransition = useMemo(
    () => getAdminIndicatorTransition(prefersReducedMotion),
    [prefersReducedMotion],
  )
  const panelTransition = useMemo(
    () => getAdminPanelTransition(prefersReducedMotion),
    [prefersReducedMotion],
  )
  const panelVariants = useMemo(
    () => getAdminPanelVariants(prefersReducedMotion),
    [prefersReducedMotion],
  )

  const translatedTabs = useMemo(
    () =>
      ADMIN_DASHBOARD_TAB_ITEMS.map((item) => ({
        ...item,
        label: t(`dashboard.tabs.${item.value}.label`),
        description: t(`dashboard.tabs.${item.value}.description`),
      })),
    [t],
  )
  const activeTabMeta = useMemo(
    () => translatedTabs.find((item) => item.value === activeTab) ?? translatedTabs[0],
    [activeTab, translatedTabs],
  )
  const activeDeviceHash = initialDeviceHash
  const recentActivityUsageQuery = useQuery({
    queryKey: adminQueryKeys.activity.recentUsage(),
    queryFn: fetchActivityFeed,
    enabled: activeTab === 'overview',
    select: (data) =>
      (Array.isArray(data.recentActivities) ? data.recentActivities : [])
        .filter(shouldShowRecentRecord)
        .slice(0, ADMIN_RECENT_ACTIVITY_USAGE_LIMIT),
  })
  const recentActivityUsage = recentActivityUsageQuery.data ?? []
  const endActivityMutation = useMutation({
    mutationFn: endAdminActivity,
    onSuccess: async () => {
      toast.success(t('dashboard.activityEnded'))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.activity.recentUsage() }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.activity.feed() }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.activity.publicFeed() }),
      ])
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('mutation.endActivityFailed'))
    },
  })

  const updateAdminLocation = useCallback(
    (nextTab: AdminTabValue) => {
      if (typeof window === 'undefined') return
      const nextSearch = new URLSearchParams(window.location.search)

      if (nextTab === 'overview') {
        nextSearch.delete('tab')
      } else {
        nextSearch.set('tab', nextTab)
      }

      if (nextTab !== 'devices') {
        nextSearch.delete('hash')
      }

      const query = nextSearch.toString()
      const nextUrl = query ? `/admin?${query}` : '/admin'
      window.history.replaceState(window.history.state, '', nextUrl)
    },
    [],
  )

  const handleTabChange = useCallback(
    (nextTab: AdminTabValue) => {
      setActiveTab(nextTab)
      updateAdminLocation(nextTab)
    },
    [updateAdminLocation],
  )

  useEffect(() => {
    const rail = tabsRailRef.current
    const trigger = triggerRefs.current[activeTab]
    if (!rail || !trigger) return

    if (rail.scrollWidth > rail.clientWidth) {
      trigger.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  }, [activeTab])

  const handleLogout = async () => {
    try {
      await logoutAdmin()
      toast.success(t('dashboard.logoutSuccess'))
      router.push('/admin/login')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('dashboard.logoutFailed'))
    }
  }

  const renderActivePanel = () => {
    if (activeTab === 'inspiration') {
      return <InspirationManager />
    }
    if (activeTab === 'orphan-images') {
      return <OrphanImages ref={orphanImagesRef} />
    }
    if (activeTab === 'devices') {
      return <DeviceManager initialHashKey={activeDeviceHash} highlightHashKey={activeDeviceHash} />
    }
    if (activeTab === 'tokens') {
      return <TokenManager ref={tokenManagerRef} />
    }
    if (activeTab === 'account') {
      return <AccountSettings />
    }
    if (activeTab === 'settings') {
      return <WebSettings />
    }
    return <ScheduleManager ref={scheduleManagerRef} />
  }

  const renderOverviewPanel = () => (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t('dashboard.viewerCountTitle')}
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              {t('dashboard.viewerCountDescription')}
            </p>
          </div>
          <div className="rounded-full border border-primary/15 bg-primary/8 p-3 text-primary shadow-sm">
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
                        value: formatOverviewRelativeTime(
                          viewerCountUpdatedAt,
                          i18n.language,
                          t('dashboard.justNow'),
                        ),
                      })
                    : t('dashboard.viewerCountWaiting')}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
            <RefreshCw className={`h-3.5 w-3.5 ${viewerCountLoading && !viewerCountUpdatedAt ? 'animate-spin' : ''}`} />
            <span>
              {viewerCountUpdatedAt ? formatOverviewClock(viewerCountUpdatedAt, formatPattern) : '--:--:--'}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Clock3 className="h-4 w-4" />
            {t('dashboard.quickAddTitle')}
          </h3>
          <Button type="button" variant="outline" size="sm" onClick={() => handleTabChange('devices')}>
            <MonitorSmartphone className="h-4 w-4 mr-1" />
            {t('dashboard.openDeviceManager')}
          </Button>
        </div>
        <AddActivityForm />
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
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
            onClick={() => void recentActivityUsageQuery.refetch()}
            disabled={recentActivityUsageQuery.isFetching}
          >
            {recentActivityUsageQuery.isFetching ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-4 w-4" />
            )}
            {t('common.refresh')}
          </Button>
        </div>

        {recentActivityUsageQuery.isLoading ? (
          <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
            {t('dashboard.recentRecordsLoading')}
          </div>
        ) : recentActivityUsage.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
            {t('dashboard.recentRecordsEmpty')}
          </div>
        ) : (
          <div className="space-y-0">
            {recentActivityUsage.map((record, index) => {
              const recordTime = record.lastReportAt || record.updatedAt || record.startedAt
              const summary = buildRecentRecordSummary(record, t('dashboard.noStatusDescription'))
              const isPersistentRecord =
                getRecordPushMode(record) === 'active' && typeof record.id === 'number'
              const persistentRecordId = isPersistentRecord ? (record.id as number) : null
              const endingThisRecord =
                persistentRecordId !== null &&
                endActivityMutation.isPending &&
                endActivityMutation.variables === persistentRecordId
              return (
                <div
                  key={record.id}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[88px_minmax(0,1fr)] sm:gap-4"
                >
                  <div className="hidden pt-1 text-right sm:block">
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {formatOverviewClock(recordTime, formatPattern)}
                    </p>
                    <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                      {formatOverviewDate(recordTime, formatPattern, t('common.unknownTime'))}
                    </p>
                  </div>

                  <div className="relative pb-5 pl-7 sm:pl-0">
                    {index !== recentActivityUsage.length - 1 ? (
                      <div className="absolute left-[7px] top-7 h-[calc(100%-1rem)] w-px bg-border sm:left-[7px]" />
                    ) : null}
                    <div className="absolute left-0 top-1.5 h-4 w-4 rounded-full border border-primary/20 bg-primary/12">
                      <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
                    </div>

                    <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3 sm:ml-7">
                      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground sm:hidden">
                        <span className="font-semibold tabular-nums text-foreground">
                          {formatOverviewClock(recordTime, formatPattern)}
                        </span>
                        <span>{formatOverviewDate(recordTime, formatPattern, t('common.unknownTime'))}</span>
                        <span>·</span>
                        <span>{formatOverviewRelativeTime(recordTime, i18n.language, t('dashboard.justNow'))}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-sm font-medium leading-6 text-foreground">{summary}</p>
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          {formatOverviewRelativeTime(recordTime, i18n.language, t('dashboard.justNow'))}
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
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={endingThisRecord}
                              >
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
                                      ? void endActivityMutation.mutateAsync(persistentRecordId)
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

  const renderBottomGuide = () => {
    if (activeTab === 'tokens') {
      return (
        <BottomGuide
          title={t('dashboard.tokensGuide.title')}
          description={
            <>
              <p>{t('dashboard.tokensGuide.descriptionLine1')}</p>
              <p>
                {t('dashboard.tokensGuide.descriptionLine2Prefix')}{' '}
                <code className="rounded bg-muted px-1">generatedHashKey</code>{' '}
                {t('dashboard.tokensGuide.descriptionLine2Suffix')}
              </p>
            </>
          }
          code={`curl -X POST ${origin}/api/activity \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "generatedHashKey": "YOUR_DEVICE_HASH_KEY",
    "device": "MacBook Pro",
    "device_type": "desktop",
    "process_name": "VS Code",
    "process_title": "${t('dashboard.tokensGuide.exampleProcessTitle')}",
    "battery_level": 82,
    "is_charging": true,
    "push_mode": "realtime"
  }'`}
        />
      )
    }

    if (activeTab === 'inspiration') {
      return (
        <BottomGuide
          title={t('dashboard.inspirationGuide.title')}
          description={
            <>
              <p>
                {t('dashboard.inspirationGuide.descriptionLine1Prefix')}{' '}
                <code className="rounded bg-muted px-1">API Token</code>。{' '}
                <code className="rounded bg-muted px-1">contentLexical</code>{' '}
                {t('dashboard.inspirationGuide.descriptionLine1Middle')}{' '}
                <code className="rounded bg-muted px-1">content</code>{' '}
                {t('dashboard.inspirationGuide.descriptionLine1Suffix')}
              </p>
              <p>
                {t('dashboard.inspirationGuide.descriptionLine2Prefix')}{' '}
                <code className="rounded bg-muted px-1">POST /api/inspiration/assets</code>
                ，{t('dashboard.inspirationGuide.descriptionLine2Middle')}{' '}
                <code className="rounded bg-muted px-1">url</code>{' '}
                {t('dashboard.inspirationGuide.descriptionLine2Suffix')}{' '}
                <code className="rounded bg-muted px-1">X-Device-Key</code>。
              </p>
            </>
          }
          code={`# If site setting restricts inspiration by device, add:
#   -H "X-Device-Key: YOUR_DEVICE_GENERATED_HASH_KEY"

curl -X POST ${origin}/api/inspiration/assets \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"imageDataUrl":"data:image/png;base64,..."}'

curl -X POST ${origin}/api/inspiration/entries \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"${t('dashboard.inspirationGuide.exampleTitleValue')}","contentLexical":{"root":{"type":"root","children":[...]}},"imageDataUrl":null,"attachCurrentStatus":true,"attachStatusDeviceHash":"your_device_generated_hash_key"}'`}
        />
      )
    }

    return null
  }

  const renderPanelAction = () => {
    if (activeTab === 'tokens') {
      return (
        <Button
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => tokenManagerRef.current?.openCreate()}
        >
          <Plus className="h-4 w-4" />
          {t('dashboard.actions.createToken')}
        </Button>
      )
    }
    if (activeTab === 'orphan-images') {
      return (
        <Button
          size="sm"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => orphanImagesRef.current?.refresh()}
        >
          <RefreshCw className="h-4 w-4" />
          {t('common.refresh')}
        </Button>
      )
    }
    if (activeTab === 'schedule') {
      return (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => scheduleManagerRef.current?.openImport()}
          >
            <Upload className="h-4 w-4" />
            {t('dashboard.actions.importIcs')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => scheduleManagerRef.current?.downloadIcs()}
          >
            <Download className="h-4 w-4" />
            {t('dashboard.actions.exportIcs')}
          </Button>
        </div>
      )
    }

    return null
  }

  const renderPanelBody = () => {
    if (activeTab === 'overview') {
      return renderOverviewPanel()
    }

    return renderActivePanel()
  }

  return (
    <div className="admin-shell min-h-screen bg-background text-foreground">
      <div className="admin-shell-backdrop" />

      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/78 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="admin-brandmark">
                <MdAutoFixHigh className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 space-y-1">
                <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {t('dashboard.brandTitle')}
                </h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  {t('dashboard.welcome', { username })}
                </p>
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
              <Button variant="outline" className="admin-soft-button min-h-10" onClick={() => router.push('/')}>
                <Home className="mr-2 h-4 w-4" />
                {t('dashboard.backToSite')}
              </Button>
              <Button variant="ghost" className="admin-soft-button min-h-10" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                {t('dashboard.logout')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="admin-rail-shell">
          <div className="admin-tabs-shell">
            <div ref={tabsRailRef} className="admin-tabs-rail">
              {translatedTabs.map((item, index) => {
                const Icon = item.icon
                const selected = activeTab === item.value
                return (
                  <motion.button
                    key={item.value}
                    layout
                    ref={(node) => {
                      triggerRefs.current[item.value] = node
                    }}
                    type="button"
                    onClick={() => handleTabChange(item.value)}
                    className={`admin-tab-trigger ${selected ? 'is-active' : ''}`}
                    style={{ animationDelay: `${index * 35}ms` }}
                    aria-pressed={selected}
                  >
                    {selected ? (
                      <motion.span
                        layoutId="admin-tab-indicator"
                        className="admin-tab-indicator"
                        transition={tabIndicatorTransition}
                      />
                    ) : null}
                    <span className="relative z-10 admin-tab-icon">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="relative z-10 block min-w-0 truncate text-left text-sm font-medium">
                      {item.label}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </div>
        </section>

        <section className="admin-panel-shell">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              variants={panelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={panelTransition}
            >
              <div className="mb-5 flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-lg font-semibold tracking-tight text-foreground">
                    {activeTabMeta.label}
                  </h2>
                  <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">
                    {activeTabMeta.description}
                  </p>
                </div>
                {renderPanelAction()}
              </div>

              {renderPanelBody()}
            </motion.div>
          </AnimatePresence>
        </section>

        {renderBottomGuide()}
      </main>
    </div>
  )
}

export function AdminDashboard(props: DashboardProps) {
  return (
    <AdminQueryProvider>
      <AdminDashboardContent {...props} />
    </AdminQueryProvider>
  )
}
