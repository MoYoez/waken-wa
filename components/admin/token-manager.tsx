'use client'

import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Check, Copy, Plus, QrCode, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { ApiTokenListRow } from '@/types/admin'

const TOKEN_LIST_PAGE_SIZE = 10
const TOKEN_LIST_MAX_HEIGHT = 'min(70vh,48rem)'

export interface TokenManagerHandle {
  openCreate: () => void
}

export const TokenManager = forwardRef<TokenManagerHandle, object>(function TokenManager(_, ref) {
  const [tokens, setTokens] = useState<ApiTokenListRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [listTick, setListTick] = useState(0)
  const [loading, setLoading] = useState(true)
  const [newTokenName, setNewTokenName] = useState('')
  const [newToken, setNewToken] = useState<string | null>(null)
  const [newTokenBundle, setNewTokenBundle] = useState<string | null>(null)
  const [newEndpoint, setNewEndpoint] = useState<string | null>(null)
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null)
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrTitle, setQrTitle] = useState('')
  const [qrEndpoint, setQrEndpoint] = useState('')
  const [qrEncoded, setQrEncoded] = useState('')

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / TOKEN_LIST_PAGE_SIZE)),
    [total],
  )

  useEffect(() => {
    if (loading) return
    if (total <= 0) {
      if (page !== 0) setPage(0)
      return
    }
    const maxPage = Math.max(0, Math.ceil(total / TOKEN_LIST_PAGE_SIZE) - 1)
    if (page > maxPage) setPage(maxPage)
  }, [loading, total, page])

  /** When `silent`, skip the list loading overlay so controlled Switches keep mounting and CSS transitions run. */
  const fetchTokens = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(TOKEN_LIST_PAGE_SIZE),
        offset: String(page * TOKEN_LIST_PAGE_SIZE),
      })
      const res = await fetch(`/api/admin/tokens?${params}`)
      const data = await res.json()
      if (data.success) {
        setTokens(data.data || [])
        setTotal(typeof data.pagination?.total === 'number' ? data.pagination.total : (data.data?.length ?? 0))
      }
    } catch {
      // ignore
    } finally {
      if (!silent) setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void fetchTokens()
  }, [fetchTokens, listTick])

  const handleCreate = async () => {
    if (!newTokenName.trim()) return

    setCreating(true)
    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTokenName }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean
        error?: string
        data?: { token: string }
        tokenBundleBase64?: string | null
        endpoint?: string | null
      }

      if (!res.ok || !data?.success || !data.data?.token) {
        toast.error(typeof data?.error === 'string' ? data.error : '创建失败')
        return
      }
      setNewToken(data.data.token)
      setNewTokenBundle(data.tokenBundleBase64 || null)
      setNewEndpoint(data.endpoint || null)
      setPage(0)
      setListTick((t) => t + 1)
      toast.success('Token 已创建')
    } catch {
      toast.error('网络错误')
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (id: number, is_active: boolean) => {
    const prev = tokens.find((t) => t.id === id)
    if (prev) {
      setTokens((rows) => rows.map((t) => (t.id === id ? { ...t, isActive: is_active } : t)))
    }
    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active }),
      })
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !data?.success) {
        if (prev) {
          setTokens((rows) => rows.map((t) => (t.id === id ? { ...t, isActive: prev.isActive } : t)))
        }
        toast.error(typeof data?.error === 'string' ? data.error : '更新失败')
        return
      }
      await fetchTokens({ silent: true })
      toast.success(is_active ? 'Token 已启用' : 'Token 已禁用', { duration: 2200 })
    } catch {
      if (prev) {
        setTokens((rows) => rows.map((t) => (t.id === id ? { ...t, isActive: prev.isActive } : t)))
      }
      toast.error('网络错误')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/tokens?id=${id}`, { method: 'DELETE' })
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !data?.success) {
        toast.error(typeof data?.error === 'string' ? data.error : '删除失败')
        return
      }
      await fetchTokens({ silent: true })
      toast.success('Token 已删除')
    } catch {
      toast.error('网络错误')
    }
  }

  const copyToClipboard = async (text: string, target: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('已复制到剪贴板')
    } catch {
      toast.error('复制失败，请检查浏览器权限')
      return
    }
    if (copyFeedbackTimerRef.current) clearTimeout(copyFeedbackTimerRef.current)
    setCopiedTarget(target)
    copyFeedbackTimerRef.current = setTimeout(() => {
      setCopiedTarget(null)
      copyFeedbackTimerRef.current = null
    }, 2000)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setNewTokenName('')
    setNewToken(null)
    setNewTokenBundle(null)
    setNewEndpoint(null)
    setCopiedTarget(null)
    if (copyFeedbackTimerRef.current) {
      clearTimeout(copyFeedbackTimerRef.current)
      copyFeedbackTimerRef.current = null
    }
  }

  const getQrImageUrl = (text: string) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(text)}`

  const safeFormat = (value: string | null, fmt: string) => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return format(date, fmt, { locale: zhCN })
  }

  useImperativeHandle(ref, () => ({
    openCreate: () => setDialogOpen(true),
  }))

  return (
    <div className="space-y-6">
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        {/* DialogTrigger intentionally omitted – opened via ref from parent */}
        <DialogContent>
            <DialogHeader>
              <DialogTitle>创建 API Token</DialogTitle>
              <DialogDescription>
                创建一个新的 API Token 用于上报活动数据
              </DialogDescription>
            </DialogHeader>
            
            {newToken ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground mb-2">请保存以下 Token，它只会显示一次：</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono break-all bg-background p-2 rounded">
                      {newToken}
                    </code>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => void copyToClipboard(newToken, 'create-raw-token')}
                    >
                      {copiedTarget === 'create-raw-token' ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                {newTokenBundle && (
                  <div className="rounded-lg bg-muted p-4 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      一键接入配置（Base64，含 endpoint + key）
                    </p>
                    {newEndpoint && (
                      <p className="text-xs text-muted-foreground">Endpoint: {newEndpoint}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono break-all bg-background p-2 rounded">
                        {newTokenBundle}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => void copyToClipboard(newTokenBundle, 'create-token-bundle')}
                      >
                        {copiedTarget === 'create-token-bundle' ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setQrTitle(newTokenName || '新 Token')
                          setQrEndpoint(newEndpoint || '')
                          setQrEncoded(newTokenBundle)
                          setQrDialogOpen(true)
                        }}
                      >
                        <QrCode className="h-4 w-4" />
                        显示接入二维码
                      </Button>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button onClick={closeDialog}>完成</Button>
                </DialogFooter>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="tokenName">Token 名称</Label>
                  <Input
                    id="tokenName"
                    placeholder="例如：我的电脑"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={closeDialog}>取消</Button>
                  <Button onClick={handleCreate} disabled={creating || !newTokenName.trim()}>
                    {creating ? '创建中...' : '创建'}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
      </Dialog>

      {/* Token list (paginated + scroll) */}
      <div className="space-y-3">
        {loading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              加载中...
            </CardContent>
          </Card>
        ) : tokens.length === 0 && total > 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              正在同步页码…
            </CardContent>
          </Card>
        ) : tokens.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              暂无 Token，点击「创建 Token」开始
            </CardContent>
          </Card>
        ) : (
          <div
            className="grid gap-4 overflow-y-auto overscroll-contain pr-1"
            style={{ maxHeight: TOKEN_LIST_MAX_HEIGHT }}
          >
            {tokens.map((token) => (
            <Card key={token.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{token.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={token.isActive}
                      onCheckedChange={(checked) => handleToggle(token.id, checked)}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>删除 Token</AlertDialogTitle>
                          <AlertDialogDescription>
                            确定要删除 Token &quot;{token.name}&quot; 吗？使用此 Token 的设备将无法继续上报数据。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(token.id)}>
                            删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <CardDescription>
                  Token: {token.token}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    创建于 {safeFormat(token.createdAt, 'yyyy-MM-dd') ?? '—'}
                  </span>
                  {safeFormat(token.lastUsedAt, 'MM-dd HH:mm') && (
                    <span>
                      最后使用 {safeFormat(token.lastUsedAt, 'MM-dd HH:mm')}
                    </span>
                  )}
                  <span className={token.isActive ? 'text-emerald-500' : 'text-muted-foreground'}>
                    {token.isActive ? '已启用' : '已禁用'}
                  </span>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs font-medium text-foreground mb-2">最近使用设备（按最后在线）</p>
                  {!token.recentDevices || token.recentDevices.length === 0 ? (
                    <p className="text-xs text-muted-foreground">暂无关联设备（上报过且绑定此 Token 的设备会出现在此）</p>
                  ) : (
                    <ul className="space-y-2">
                      {token.recentDevices.map((d) => (
                        <li
                          key={`${token.id}-${d.generatedHashKey}`}
                          className="text-xs space-y-1 border-b border-border/40 pb-2 last:border-0 last:pb-0"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium text-foreground">{d.displayName}</span>
                            <span className="text-muted-foreground shrink-0">
                              {d.lastSeenAt
                                ? safeFormat(d.lastSeenAt, 'yyyy-MM-dd HH:mm') ?? '—'
                                : '从未在线'}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">设备身份牌</p>
                          <code className="block font-mono break-all text-muted-foreground">
                            {d.generatedHashKey}
                          </code>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
            ))}
          </div>
        )}

        {total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <span>
              共 {total} 条
              {tokens.length > 0 ? (
                <>
                  {' '}
                  · 本页 {page * TOKEN_LIST_PAGE_SIZE + 1}–{page * TOKEN_LIST_PAGE_SIZE + tokens.length}
                </>
              ) : null}
            </span>
            {total > TOKEN_LIST_PAGE_SIZE ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page <= 0 || loading}
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
                  disabled={page >= totalPages - 1 || loading}
                >
                  下一页
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <Dialog
        open={qrDialogOpen}
        onOpenChange={(open) => {
          setQrDialogOpen(open)
          if (!open) {
            setQrTitle('')
            setQrEndpoint('')
            setQrEncoded('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>接入二维码</DialogTitle>
            <DialogDescription>
              仅本次创建成功时可生成；关闭对话框后请用已保存的 Base64 或新建 Token。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              Token: <span className="font-medium">{qrTitle || '-'}</span>
            </p>
            {qrEndpoint && (
              <p className="text-xs text-muted-foreground break-all">Endpoint: {qrEndpoint}</p>
            )}
            <div className="rounded-lg border p-4 flex items-center justify-center min-h-[280px]">
              {qrEncoded ? (
                <Image
                  src={getQrImageUrl(qrEncoded)}
                  alt="token qrcode"
                  width={260}
                  height={260}
                  className="h-[260px] w-[260px]"
                />
              ) : (
                <div className="text-sm text-muted-foreground">暂无二维码数据</div>
              )}
            </div>
            {qrEncoded && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void copyToClipboard(qrEncoded, 'qr-encoded')}
              >
                {copiedTarget === 'qr-encoded' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copiedTarget === 'qr-encoded' ? '已复制' : '复制接入配置'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
})
