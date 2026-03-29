'use client'

import { Copy, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toastSwitchLabel } from '@/lib/admin-switch-toast'
import { cn } from '@/lib/utils'

interface DeviceItem {
  id: number
  displayName: string
  generatedHashKey: string
  showSteamNowPlaying?: boolean
  status: 'active' | 'pending' | 'revoked'
  apiTokenId: number | null
  lastSeenAt: string | null
  updatedAt: string
  apiToken?: { id: number; name: string; isActive: boolean } | null
  approvalUrl?: string
}

interface TokenOption {
  id: number
  name: string
  isActive: boolean
}

const DEVICE_STATUS_LABEL: Record<DeviceItem['status'], string> = {
  active: '已启用',
  pending: '待审核',
  revoked: '已撤销',
}

function deviceStatusLabel(status: DeviceItem['status']): string {
  return DEVICE_STATUS_LABEL[status]
}

function DeviceListItemActions({
  item,
  variant,
  onCopyHash,
  onToggleActive,
  onReview,
}: {
  item: DeviceItem
  variant: 'mobile' | 'desktop'
  onCopyHash: () => void
  onToggleActive: () => void
  onReview: () => void
}) {
  if (variant === 'mobile') {
    return (
      <div className="flex w-full flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9 h-auto gap-1.5 py-2"
            onClick={onCopyHash}
          >
            <Copy className="h-4 w-4 shrink-0" />
            <span className="truncate text-left">复制身份牌</span>
          </Button>
          <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={onToggleActive}>
            {item.status === 'active' ? '停用' : '启用'}
          </Button>
        </div>
        {item.status === 'pending' ? (
          <Button type="button" variant="outline" size="sm" className="min-h-9 w-full" onClick={onReview}>
            审核
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={onCopyHash}>
        <Copy className="h-4 w-4 shrink-0" />
        复制身份牌
      </Button>
      <Button type="button" variant="outline" size="sm" className="h-8" onClick={onToggleActive}>
        {item.status === 'active' ? '停用' : '启用'}
      </Button>
      {item.status === 'pending' ? (
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={onReview}>
          审核
        </Button>
      ) : null}
    </div>
  )
}

/** Server page size; smaller pages keep the admin panel from growing too tall. */
const DEVICE_LIST_PAGE_SIZE = 10
/** Max scroll height for the device list block inside the card. */
const DEVICE_LIST_MAX_HEIGHT = 'min(70vh,48rem)'

export function DeviceManager({
  initialHashKey,
  highlightHashKey,
}: {
  initialHashKey?: string
  highlightHashKey?: string
} = {}) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<DeviceItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [q, setQ] = useState(() => initialHashKey?.trim() ?? '')
  const [status, setStatus] = useState('')
  const [tokens, setTokens] = useState<TokenOption[]>([])

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTokenId, setNewTokenId] = useState('')
  const [newHashKey, setNewHashKey] = useState('')
  const [reviewDevice, setReviewDevice] = useState<DeviceItem | null>(null)
  const highlightHandledRef = useRef(false)

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / DEVICE_LIST_PAGE_SIZE)),
    [total],
  )

  useEffect(() => {
    if (loading || total <= 0) return
    const maxPage = Math.max(0, Math.ceil(total / DEVICE_LIST_PAGE_SIZE) - 1)
    if (page > maxPage) setPage(maxPage)
  }, [loading, total, page])

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tokens')
      const data = await res.json()
      if (data?.success && Array.isArray(data.data)) {
        setTokens(data.data)
      }
    } catch {
      // ignore
    }
  }, [])

  /** When `silent`, skip the list loading overlay so controlled Switches keep mounting and CSS transitions run. */
  const fetchDevices = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(DEVICE_LIST_PAGE_SIZE),
        offset: String(page * DEVICE_LIST_PAGE_SIZE),
      })
      if (q.trim()) params.set('q', q.trim())
      if (status) params.set('status', status)

      const res = await fetch(`/api/admin/devices?${params}`)
      const data = await res.json()
      if (data?.success) {
        setItems(data.data || [])
        setTotal(data.pagination?.total || 0)
      }
    } catch {
      // ignore
    } finally {
      if (!silent) setLoading(false)
    }
  }, [page, q, status])

  useEffect(() => {
    void fetchTokens()
  }, [fetchTokens])

  useEffect(() => {
    void fetchDevices()
  }, [fetchDevices])

  useEffect(() => {
    if (!highlightHashKey?.trim() || items.length === 0) return
    const match = items.find((i) => i.generatedHashKey === highlightHashKey.trim())
    if (!match) return
    const el = document.getElementById(`device-row-${match.id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightHashKey, items])

  const createDevice = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const apiTokenId = newTokenId ? Number(newTokenId) : undefined
      const body: Record<string, unknown> = {
        displayName: newName.trim(),
        apiTokenId: Number.isFinite(apiTokenId) ? apiTokenId : undefined,
      }
      const hk = newHashKey.trim()
      if (hk) body.generatedHashKey = hk

      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        toast.error(data?.error || '创建设备失败')
        return
      }
      setNewName('')
      setNewTokenId('')
      setNewHashKey('')
      toast.success('设备已创建')
      setPage(0)
      await fetchDevices()
    } catch {
      toast.error('网络错误')
    } finally {
      setCreating(false)
    }
  }

  const updateStatus = async (id: number, nextStatus: 'active' | 'pending' | 'revoked') => {
    try {
      const res = await fetch('/api/admin/devices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: nextStatus }),
      })
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !data?.success) {
        toast.error(typeof data?.error === 'string' ? data.error : '更新失败')
        return
      }
      await fetchDevices({ silent: true })
      setReviewDevice((d) => (d?.id === id ? null : d))
      toast.success(`设备状态已更新为「${DEVICE_STATUS_LABEL[nextStatus]}」`)
    } catch {
      toast.error('网络错误')
    }
  }

  const updateShowSteamNowPlaying = async (id: number, showSteamNowPlaying: boolean) => {
    const prev = items.find((i) => i.id === id)
    setItems((rows) =>
      rows.map((i) => (i.id === id ? { ...i, showSteamNowPlaying } : i)),
    )
    try {
      const res = await fetch('/api/admin/devices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, showSteamNowPlaying }),
      })
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !data?.success) {
        if (prev) {
          setItems((rows) =>
            rows.map((i) =>
              i.id === id ? { ...i, showSteamNowPlaying: prev.showSteamNowPlaying } : i,
            ),
          )
        }
        toast.error(typeof data?.error === 'string' ? data.error : '更新失败')
        return
      }
      await fetchDevices({ silent: true })
      toastSwitchLabel('状态卡片显示 Steam 正在游玩', showSteamNowPlaying)
    } catch {
      if (prev) {
        setItems((rows) =>
          rows.map((i) =>
            i.id === id ? { ...i, showSteamNowPlaying: prev.showSteamNowPlaying } : i,
          ),
        )
      }
      toast.error('网络错误')
    }
  }

  const removeDevice = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/devices?id=${id}`, { method: 'DELETE' })
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !data?.success) {
        toast.error(typeof data?.error === 'string' ? data.error : '删除失败')
        return
      }
      await fetchDevices({ silent: true })
      toast.success('设备已删除')
    } catch {
      toast.error('网络错误')
    }
  }

  const copyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash)
      toast.success('设备身份牌已复制')
    } catch {
      toast.error('复制失败，请检查浏览器权限')
    }
  }

  useEffect(() => {
    const h = highlightHashKey?.trim()
    if (!h || loading) return
    if (highlightHandledRef.current) return

    const match = items.find((i) => i.generatedHashKey === h)
    if (match) {
      highlightHandledRef.current = true
      if (match.status === 'pending') {
        setReviewDevice(match)
      } else {
        toast.info('该设备已审核')
      }
      return
    }

    if (q.trim() !== h) return

    highlightHandledRef.current = true
    toast.warning('未找到该设备身份牌对应的设备')
  }, [highlightHashKey, loading, items, q])

  useEffect(() => {
    setReviewDevice((d) => {
      if (!d) return d
      const next = items.find((i) => i.id === d.id)
      if (!next || next.status !== 'pending') return null
      return next
    })
  }, [items])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="font-semibold text-foreground">设备管理</h3>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="new-device-name">设备显示名</Label>
            <Input
              id="new-device-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例如：Office-Laptop"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-device-token">绑定 Token（可选）</Label>
            <Select
              value={newTokenId || 'none'}
              onValueChange={(v) => setNewTokenId(v === 'none' ? '' : v)}
            >
              <SelectTrigger id="new-device-token" className="w-full">
                <SelectValue placeholder="不绑定" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不绑定</SelectItem>
                {tokens.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                    {!t.isActive ? ' (disabled)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-device-hash">自定义设备身份牌（可选）</Label>
          <Input
            id="new-device-hash"
            value={newHashKey}
            onChange={(e) => setNewHashKey(e.target.value)}
            placeholder="留空则系统自动生成；可与「快速添加活动」中的设备身份牌一致"
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            8～128 字符，须唯一。可与概览中「生成随机 Key」得到的设备身份牌一致后在此粘贴创建设备。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" onClick={createDevice} disabled={creating || !newName.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            {creating ? '创建中...' : '新增设备'}
          </Button>
          <Button type="button" variant="outline" onClick={() => void fetchDevices()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            刷新
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 sm:p-6 space-y-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-2 flex-1 min-w-[220px]">
            <Label htmlFor="device-q">搜索</Label>
            <Input
              id="device-q"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(0)
              }}
              placeholder="按显示名或设备身份牌搜索"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="device-status">状态</Label>
            <Select
              value={status || 'all'}
              onValueChange={(v) => {
                setStatus(v === 'all' ? '' : v)
                setPage(0)
              }}
            >
              <SelectTrigger id="device-status" className="w-full min-w-[10rem] sm:w-[11rem]">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="active">{DEVICE_STATUS_LABEL.active}</SelectItem>
                <SelectItem value="pending">{DEVICE_STATUS_LABEL.pending}</SelectItem>
                <SelectItem value="revoked">{DEVICE_STATUS_LABEL.revoked}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">加载中...</p>
        ) : items.length === 0 && total > 0 ? (
          <p className="text-sm text-muted-foreground">正在同步页码…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无设备</p>
        ) : (
          <div
            className="space-y-3 overflow-y-auto overscroll-contain pr-1"
            style={{ maxHeight: DEVICE_LIST_MAX_HEIGHT }}
          >
            {items.map((item) => (
              <div
                key={item.id}
                id={`device-row-${item.id}`}
                className={cn(
                  'relative rounded-md border p-2.5 sm:p-3',
                  highlightHashKey?.trim() && item.generatedHashKey === highlightHashKey.trim()
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                    : null,
                )}
              >
                <div className="pointer-events-none absolute right-1 top-1 z-10 sm:right-2 sm:top-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="pointer-events-auto h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label="删除设备"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认删除设备</AlertDialogTitle>
                        <AlertDialogDescription>
                          删除后该设备身份牌将无法继续上报活动。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void removeDevice(item.id)}>删除</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="space-y-2">
                  <div className="pr-10 sm:pr-11">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium break-words">{item.displayName}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        <span className="block sm:inline">状态: {deviceStatusLabel(item.status)}</span>
                        <span className="hidden sm:inline">{' | '}</span>
                        <span className="mt-0.5 block sm:mt-0 sm:inline">
                          最后在线: {item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleString() : '—'}
                        </span>
                      </p>
                    </div>
                    <div className="mt-3 sm:hidden">
                      <DeviceListItemActions
                        item={item}
                        variant="mobile"
                        onCopyHash={() => void copyHash(item.generatedHashKey)}
                        onToggleActive={() =>
                          void updateStatus(item.id, item.status === 'active' ? 'revoked' : 'active')
                        }
                        onReview={() => setReviewDevice(item)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-sans">设备身份牌 </span>
                    <span className="font-mono break-all">{item.generatedHashKey}</span>
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <p className="text-xs text-muted-foreground min-w-0 sm:flex-1">
                      {item.apiToken ? `Token: ${item.apiToken.name}` : 'Token: 未绑定'}
                    </p>
                    <div className="hidden sm:block sm:shrink-0">
                      <DeviceListItemActions
                        item={item}
                        variant="desktop"
                        onCopyHash={() => void copyHash(item.generatedHashKey)}
                        onToggleActive={() =>
                          void updateStatus(item.id, item.status === 'active' ? 'revoked' : 'active')
                        }
                        onReview={() => setReviewDevice(item)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-3">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <Label htmlFor={`steam-card-${item.id}`} className="text-xs font-medium cursor-pointer">
                        状态卡片显示 Steam 正在游玩
                      </Label>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        使用网站设置中的全站 Steam ID；当本设备在线且 Steam 上报「正在游戏」时，主页状态卡片会在媒体信息旁显示当前游戏。
                      </p>
                    </div>
                    <Switch
                      id={`steam-card-${item.id}`}
                      className="shrink-0 self-end sm:self-auto"
                      checked={Boolean(item.showSteamNowPlaying)}
                      onCheckedChange={(v) => void updateShowSteamNowPlaying(item.id, v)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <span>
              共 {total} 条
              {items.length > 0 ? (
                <>
                  {' '}
                  · 本页 {page * DEVICE_LIST_PAGE_SIZE + 1}–{page * DEVICE_LIST_PAGE_SIZE + items.length}
                </>
              ) : null}
            </span>
            {total > DEVICE_LIST_PAGE_SIZE ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page <= 0}
                >
                  上一页
                </Button>
                <span className="tabular-nums text-sm">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  下一页
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <Dialog
        open={reviewDevice !== null}
        onOpenChange={(open) => {
          if (!open) setReviewDevice(null)
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          {reviewDevice ? (
            <>
              <DialogHeader>
                <DialogTitle>设备审核</DialogTitle>
                <DialogDescription>
                  确认是否同意该设备接入。通过后可正常上报活动；拒绝将标记为不可用。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">显示名：</span>
                  {reviewDevice.displayName}
                </p>
                <p className="text-xs">
                  <span className="text-muted-foreground">设备身份牌：</span>
                  <span className="font-mono break-all">{reviewDevice.generatedHashKey}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">状态：</span>
                  {deviceStatusLabel(reviewDevice.status)}
                </p>
                <p>
                  <span className="text-muted-foreground">最后在线：</span>
                  {reviewDevice.lastSeenAt
                    ? new Date(reviewDevice.lastSeenAt).toLocaleString()
                    : '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">绑定 Token：</span>
                  {reviewDevice.apiToken ? reviewDevice.apiToken.name : '未绑定'}
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void updateStatus(reviewDevice.id, 'revoked')}
                >
                  拒绝
                </Button>
                <Button type="button" onClick={() => void updateStatus(reviewDevice.id, 'active')}>
                  通过
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

