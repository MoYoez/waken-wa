'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, Link2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

interface DeviceItem {
  id: number
  displayName: string
  generatedHashKey: string
  status: 'active' | 'pending' | 'revoked'
  apiTokenId: number | null
  lastSeenAt: string | null
  updatedAt: string
  apiToken?: { id: number; name: string; isActive: boolean } | null
}

interface TokenOption {
  id: number
  name: string
  isActive: boolean
}

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
  const [message, setMessage] = useState('')

  const limit = 20
  const totalPages = useMemo(() => Math.ceil(total / limit), [total])

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

  const fetchDevices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
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
      setLoading(false)
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
    setMessage('')
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
        setMessage(data?.error || '创建设备失败')
        return
      }
      setNewName('')
      setNewTokenId('')
      setNewHashKey('')
      setMessage('设备已创建')
      setPage(0)
      await fetchDevices()
    } catch {
      setMessage('网络错误')
    } finally {
      setCreating(false)
    }
  }

  const updateStatus = async (id: number, nextStatus: 'active' | 'pending' | 'revoked') => {
    await fetch('/api/admin/devices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: nextStatus }),
    })
    await fetchDevices()
  }

  const removeDevice = async (id: number) => {
    await fetch(`/api/admin/devices?id=${id}`, { method: 'DELETE' })
    await fetchDevices()
  }

  const copyHash = async (hash: string) => {
    await navigator.clipboard.writeText(hash)
    setMessage('GeneratedHashKey 已复制')
  }

  const copyApprovalLink = async (hash: string) => {
    const path = `/admin?tab=devices&hash=${encodeURIComponent(hash)}`
    const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path
    await navigator.clipboard.writeText(url)
    setMessage('审核链接已复制（登录后台后可直达该设备）')
  }

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
          <Label htmlFor="new-device-hash">自定义 GeneratedHashKey（可选）</Label>
          <Input
            id="new-device-hash"
            value={newHashKey}
            onChange={(e) => setNewHashKey(e.target.value)}
            placeholder="留空则系统自动生成；可与「快速添加活动」中生成的 Key 一致"
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            8～128 字符，须唯一。可与概览中「生成随机 Key」结果一致后在此粘贴创建设备。
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
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
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
              placeholder="按显示名或 HashKey 搜索"
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
                <SelectItem value="active">active</SelectItem>
                <SelectItem value="pending">pending</SelectItem>
                <SelectItem value="revoked">revoked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">加载中...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无设备</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                id={`device-row-${item.id}`}
                className={
                  highlightHashKey?.trim() && item.generatedHashKey === highlightHashKey.trim()
                    ? 'rounded-md border p-3 space-y-2 ring-2 ring-primary ring-offset-2 ring-offset-background'
                    : 'rounded-md border p-3 space-y-2'
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      状态: {item.status} | 最后在线: {item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleString() : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => void copyHash(item.generatedHashKey)}>
                      <Copy className="h-4 w-4 mr-1" />
                      复制 Key
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void updateStatus(item.id, item.status === 'active' ? 'revoked' : 'active')}
                    >
                      {item.status === 'active' ? '停用' : '启用'}
                    </Button>
                    {item.status === 'pending' ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void copyApprovalLink(item.generatedHashKey)}
                        >
                          <Link2 className="h-4 w-4 mr-1" />
                          复制审核链接
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void updateStatus(item.id, 'active')}
                        >
                          通过
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void updateStatus(item.id, 'revoked')}
                        >
                          拒绝
                        </Button>
                      </>
                    ) : null}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除设备</AlertDialogTitle>
                          <AlertDialogDescription>
                            删除后该 GeneratedHashKey 将无法继续上报活动。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void removeDevice(item.id)}>删除</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <p className="text-xs font-mono break-all text-muted-foreground">{item.generatedHashKey}</p>
                {item.apiToken ? (
                  <p className="text-xs text-muted-foreground">Token: {item.apiToken.name}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Token: 未绑定</p>
                )}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">共 {total} 条</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                上一页
              </Button>
              <span className="text-sm text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
              >
                下一页
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

