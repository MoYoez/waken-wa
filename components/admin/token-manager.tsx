'use client'

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Check, Copy, Plus, QrCode, Trash2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'

import {
  getAdminPanelTransition,
  getAdminSectionVariants,
} from '@/components/admin/admin-motion'
import {
  fetchAdminTokenPage,
} from '@/components/admin/admin-query-fetchers'
import { adminQueryKeys } from '@/components/admin/admin-query-keys'
import {
  createAdminToken,
  deleteAdminToken,
  patchAdminToken,
} from '@/components/admin/admin-query-mutations'
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
  const queryClient = useQueryClient()
  const prefersReducedMotion = Boolean(useReducedMotion())
  const [page, setPage] = useState(0)
  const [newTokenName, setNewTokenName] = useState('')
  const [newToken, setNewToken] = useState<string | null>(null)
  const [newTokenBundle, setNewTokenBundle] = useState<string | null>(null)
  const [newEndpoint, setNewEndpoint] = useState<string | null>(null)
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null)
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrTitle, setQrTitle] = useState('')
  const [qrEndpoint, setQrEndpoint] = useState('')
  const [qrEncoded, setQrEncoded] = useState('')

  const tokensQuery = useQuery({
    queryKey: adminQueryKeys.tokens.page({ page }),
    queryFn: () => fetchAdminTokenPage({ page, pageSize: TOKEN_LIST_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  const tokens = useMemo(() => tokensQuery.data?.rows ?? [], [tokensQuery.data?.rows])
  const total = tokensQuery.data?.total ?? 0
  const loading = tokensQuery.isLoading
  const refreshing = tokensQuery.isFetching && !tokensQuery.isLoading
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / TOKEN_LIST_PAGE_SIZE)), [total])
  const safePage = useMemo(() => Math.min(page, Math.max(0, totalPages - 1)), [page, totalPages])
  const sectionTransition = getAdminPanelTransition(prefersReducedMotion)
  const sectionVariants = getAdminSectionVariants(prefersReducedMotion, {
    enterY: 10,
    exitY: 8,
    scale: 0.996,
  })

  useEffect(() => {
    if (page <= safePage) return
    const timer = window.setTimeout(() => {
      setPage(safePage)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [page, safePage])

  const createTokenMutation = useMutation({
    mutationFn: async () => {
      return createAdminToken(newTokenName)
    },
    onSuccess: async (data) => {
      setNewToken(data.token ?? null)
      setNewTokenBundle(data.tokenBundleBase64 || null)
      setNewEndpoint(data.endpoint || null)
      setPage(0)
      toast.success('Token 已创建')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'tokens'] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '网络错误')
    },
  })

  const toggleTokenMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      await patchAdminToken({ id, is_active: isActive })
      return { isActive }
    },
    onSuccess: async ({ isActive }) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'tokens'] })
      toast.success(isActive ? 'Token 已启用' : 'Token 已禁用', { duration: 2200 })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '网络错误')
    },
  })

  const deleteTokenMutation = useMutation({
    mutationFn: async (id: number) => {
      await deleteAdminToken(id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'tokens'] })
      toast.success('Token 已删除')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '网络错误')
    },
  })

  const refreshTokens = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'tokens'] })
      await tokensQuery.refetch()
    } catch {
      toast.error('刷新失败，请重试')
    }
  }

  const handleCreate = async () => {
    if (!newTokenName.trim()) return
    await createTokenMutation.mutateAsync()
  }

  const handleToggle = async (id: number, isActive: boolean) => {
    await toggleTokenMutation.mutateAsync({ id, isActive })
  }

  const handleDelete = async (id: number) => {
    await deleteTokenMutation.mutateAsync(id)
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建 API Token</DialogTitle>
            <DialogDescription>
              创建一个新的 API Token 用于上报活动数据
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait" initial={false}>
            {newToken ? (
              <motion.div
                key="token-created"
                className="space-y-4"
                variants={sectionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={sectionTransition}
              >
              <div className="rounded-lg bg-muted p-4">
                <p className="mb-2 text-sm text-muted-foreground">请保存以下 Token，它只会显示一次：</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded bg-background p-2 text-sm font-mono">
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

              {newTokenBundle ? (
                <div className="space-y-2 rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">
                    一键接入配置（Base64，含 endpoint + key）
                  </p>
                  {newEndpoint ? (
                    <p className="text-xs text-muted-foreground">Endpoint: {newEndpoint}</p>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all rounded bg-background p-2 text-xs font-mono">
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
              ) : null}

              <DialogFooter>
                <Button onClick={closeDialog}>完成</Button>
              </DialogFooter>
              </motion.div>
            ) : (
              <motion.div
                key="token-create-form"
                className="space-y-4"
                variants={sectionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={sectionTransition}
              >
              <div className="space-y-2">
                <Label htmlFor="tokenName">Token 名称</Label>
                <Input
                  id="tokenName"
                  placeholder="例如：我的电脑"
                  value={newTokenName}
                  onChange={(event) => setNewTokenName(event.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>
                  取消
                </Button>
                <Button
                  onClick={() => void handleCreate()}
                  disabled={createTokenMutation.isPending || !newTokenName.trim()}
                >
                  {createTokenMutation.isPending ? '创建中...' : '创建'}
                </Button>
              </DialogFooter>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={() => void refreshTokens()}>
          <Plus className="mr-1 h-4 w-4 opacity-0" />
          {refreshing ? '刷新中...' : '刷新列表'}
        </Button>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="wait" initial={false}>
          {loading ? (
            <motion.div
              key="tokens-loading"
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={sectionTransition}
            >
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">加载中...</CardContent>
              </Card>
            </motion.div>
          ) : tokens.length === 0 && total > 0 ? (
            <motion.div
              key="tokens-syncing"
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={sectionTransition}
            >
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">正在同步页码…</CardContent>
              </Card>
            </motion.div>
          ) : tokens.length === 0 ? (
            <motion.div
              key="tokens-empty"
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={sectionTransition}
            >
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  暂无 Token，点击「创建 Token」开始
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="tokens-list"
              className="grid gap-4 overflow-y-auto overscroll-contain pr-1"
              style={{ maxHeight: TOKEN_LIST_MAX_HEIGHT }}
              layout
            >
              <AnimatePresence initial={false}>
                {tokens.map((token) => (
                  <motion.div
                    key={token.id}
                    variants={sectionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={sectionTransition}
                    layout
                  >
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{token.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={token.isActive}
                        onCheckedChange={(checked) => void handleToggle(token.id, checked)}
                        disabled={toggleTokenMutation.isPending}
                      />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
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
                            <AlertDialogAction
                              onClick={() => void handleDelete(token.id)}
                              disabled={deleteTokenMutation.isPending}
                            >
                              删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <CardDescription>Token: {token.token}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span>创建于 {safeFormat(token.createdAt, 'yyyy-MM-dd') ?? '—'}</span>
                    {safeFormat(token.lastUsedAt, 'MM-dd HH:mm') ? (
                      <span>最后使用 {safeFormat(token.lastUsedAt, 'MM-dd HH:mm')}</span>
                    ) : null}
                    <span className={token.isActive ? 'text-emerald-500' : 'text-muted-foreground'}>
                      {token.isActive ? '已启用' : '已禁用'}
                    </span>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                    <p className="mb-2 text-xs font-medium text-foreground">最近使用设备（按最后在线）</p>
                    {!token.recentDevices || token.recentDevices.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        暂无关联设备（上报过且绑定此 Token 的设备会出现在此）
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {token.recentDevices.map((device) => (
                          <li
                            key={`${token.id}-${device.generatedHashKey}`}
                            className="space-y-1 border-b border-border/40 pb-2 text-xs last:border-0 last:pb-0"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium text-foreground">{device.displayName}</span>
                              <span className="shrink-0 text-muted-foreground">
                                {device.lastSeenAt
                                  ? safeFormat(device.lastSeenAt, 'yyyy-MM-dd HH:mm') ?? '—'
                                  : '从未在线'}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">设备身份牌</p>
                            <code className="block break-all font-mono text-muted-foreground">
                              {device.generatedHashKey}
                            </code>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <span>
              共 {total} 条
              {tokens.length > 0 ? (
                <>
                  {' '}
                  · 本页 {safePage * TOKEN_LIST_PAGE_SIZE + 1}–
                  {safePage * TOKEN_LIST_PAGE_SIZE + tokens.length}
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
                  onClick={() => setPage((currentPage) => Math.max(0, currentPage - 1))}
                  disabled={safePage <= 0 || loading}
                >
                  上一页
                </Button>
                <span className="tabular-nums text-sm">
                  {safePage + 1} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() =>
                    setPage((currentPage) => Math.min(totalPages - 1, currentPage + 1))
                  }
                  disabled={safePage >= totalPages - 1 || loading}
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
            {qrEndpoint ? (
              <p className="break-all text-xs text-muted-foreground">Endpoint: {qrEndpoint}</p>
            ) : null}
            <div className="flex min-h-[280px] items-center justify-center rounded-lg border p-4">
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
            {qrEncoded ? (
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
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
})
