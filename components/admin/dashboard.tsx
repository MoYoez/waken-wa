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
): string {
  return formatPattern(value, 'MM/dd', '未知时间')
}

function formatOverviewRelativeTime(value: string | null | undefined): string {
  const time = Date.parse(String(value ?? ''))
  if (!Number.isFinite(time)) return '刚刚'

  const diffMs = time - Date.now()
  const absMs = Math.abs(diffMs)
  const rtf = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' })

  if (absMs < 60_000) return '刚刚'
  if (absMs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), 'minute')
  if (absMs < 86_400_000) return rtf.format(Math.round(diffMs / 3_600_000), 'hour')
  return rtf.format(Math.round(diffMs / 86_400_000), 'day')
}

function buildRecentRecordSummary(record: ActivityFeedItem): string {
  const statusLine = typeof record.statusText === 'string' ? record.statusText.trim() : ''
  if (statusLine) return statusLine
  if (record.processTitle?.trim()) return record.processTitle.trim()
  if (record.processName?.trim()) return record.processName.trim()
  return '暂无状态描述'
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

  const activeTabMeta = useMemo(
    () =>
      ADMIN_DASHBOARD_TAB_ITEMS.find((item) => item.value === activeTab) ??
      ADMIN_DASHBOARD_TAB_ITEMS[0],
    [activeTab],
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
      toast.success('活动已结束')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.activity.recentUsage() }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.activity.feed() }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.activity.publicFeed() }),
      ])
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '结束活动失败')
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
      toast.success('已登出')
      router.push('/admin/login')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '登出失败')
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
              当前在线访客
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              与首页公开展示同步，后台只读查看，不参与人数统计。
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
                ? '读取在线访客数失败'
                : viewerCountLoading && !viewerCountUpdatedAt
                  ? '正在读取最新人数...'
                  : viewerCountUpdatedAt
                    ? `最后更新 ${formatOverviewRelativeTime(viewerCountUpdatedAt)}`
                    : '等待首个访客心跳'}
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
            快速添加活动
          </h3>
          <Button type="button" variant="outline" size="sm" onClick={() => handleTabChange('devices')}>
            <MonitorSmartphone className="h-4 w-4 mr-1" />
            打开设备管理
          </Button>
        </div>
        <AddActivityForm />
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              最近记录
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              按时间顺序看看最近在做什么。
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
            刷新
          </Button>
        </div>

        {recentActivityUsageQuery.isLoading ? (
          <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
            正在加载最近记录...
          </div>
        ) : recentActivityUsage.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
            还没有最近记录。
          </div>
        ) : (
          <div className="space-y-0">
            {recentActivityUsage.map((record, index) => {
              const recordTime = record.lastReportAt || record.updatedAt || record.startedAt
              const summary = buildRecentRecordSummary(record)
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
                      {formatOverviewDate(recordTime, formatPattern)}
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
                        <span>{formatOverviewDate(recordTime, formatPattern)}</span>
                        <span>·</span>
                        <span>{formatOverviewRelativeTime(recordTime)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-sm font-medium leading-6 text-foreground">{summary}</p>
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          {formatOverviewRelativeTime(recordTime)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {record.device || '未知设备'}
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
                                立刻结束活动
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认结束活动</AlertDialogTitle>
                                <AlertDialogDescription>
                                  确定要立刻结束「{summary}」吗？结束后这条非 Realtime 活动会立即从当前状态里移除。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                  disabled={endingThisRecord}
                                  onClick={() =>
                                    persistentRecordId !== null
                                      ? void endActivityMutation.mutateAsync(persistentRecordId)
                                      : undefined
                                  }
                                >
                                  {endingThisRecord ? '结束中...' : '确认结束'}
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
          title="API 使用说明"
          description={
            <>
              <p>用于脚本或设备侧直接上报活动数据。</p>
              <p>
                字段 <code className="rounded bg-muted px-1">generatedHashKey</code> 即设备在后台的「设备身份牌」。
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
    "process_title": "编辑 index.tsx",
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
          title="API 提交（可从脚本或设备直接上报）"
          description={
            <>
              <p>
                使用与「活动上报」相同的 <code className="rounded bg-muted px-1">API Token</code>。
                <code className="rounded bg-muted px-1">contentLexical</code> 为 Lexical JSON，
                <code className="rounded bg-muted px-1">content</code> 可作为兼容纯文本。
              </p>
              <p>
                正文内嵌图请先调用 <code className="rounded bg-muted px-1">POST /api/inspiration/assets</code>，
                再把返回的 <code className="rounded bg-muted px-1">url</code> 插入正文。若已开启设备限制，
                两个请求都需要带 <code className="rounded bg-muted px-1">X-Device-Key</code>。
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
  -d '{"title":"可选","contentLexical":{"root":{"type":"root","children":[...]}},"imageDataUrl":null,"attachCurrentStatus":true,"attachStatusDeviceHash":"your_device_generated_hash_key"}'`}
        />
      )
    }

    return null
  }

  const renderPanelAction = () => {
    if (activeTab === 'tokens') {
      return (
        <Button size="sm" className="shrink-0" onClick={() => tokenManagerRef.current?.openCreate()}>
          <Plus className="h-4 w-4" />
          创建 Token
        </Button>
      )
    }
    if (activeTab === 'orphan-images') {
      return (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => orphanImagesRef.current?.refresh()}
        >
          <RefreshCw className="h-4 w-4" />
          刷新
        </Button>
      )
    }
    if (activeTab === 'schedule') {
      return (
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" onClick={() => scheduleManagerRef.current?.openImport()}>
            <Upload className="h-4 w-4" />
            导入 ICS
          </Button>
          <Button size="sm" variant="outline" onClick={() => scheduleManagerRef.current?.downloadIcs()}>
            <Download className="h-4 w-4" />
            导出 ICS
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
                  Waken 后台
                </h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  欢迎，{username}
                </p>
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
              <Button variant="outline" className="admin-soft-button min-h-10" onClick={() => router.push('/')}>
                <Home className="mr-2 h-4 w-4" />
                返回前台
              </Button>
              <Button variant="ghost" className="admin-soft-button min-h-10" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                登出
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="admin-rail-shell">
          <div className="admin-tabs-shell">
            <div ref={tabsRailRef} className="admin-tabs-rail">
              {ADMIN_DASHBOARD_TAB_ITEMS.map((item, index) => {
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
              <div className="mb-5 flex items-start justify-between gap-4 border-b border-border/60 pb-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    {activeTabMeta.label}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
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
