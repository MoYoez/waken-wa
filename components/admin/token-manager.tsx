'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Plus, Trash2, Copy, Check, QrCode, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ApiToken {
  id: number
  name: string
  token: string
  isActive: boolean
  createdAt: string
  lastUsedAt: string | null
}

export function TokenManager() {
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(true)
  const [newTokenName, setNewTokenName] = useState('')
  const [newToken, setNewToken] = useState<string | null>(null)
  const [newTokenBundle, setNewTokenBundle] = useState<string | null>(null)
  const [newEndpoint, setNewEndpoint] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrTitle, setQrTitle] = useState('')
  const [qrEndpoint, setQrEndpoint] = useState('')
  const [qrEncoded, setQrEncoded] = useState('')

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tokens')
      const data = await res.json()
      if (data.success) {
        setTokens(data.data)
      }
    } catch {
      // 忽略
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTokens()
  }, [fetchTokens])

  const handleCreate = async () => {
    if (!newTokenName.trim()) return
    
    setCreating(true)
    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTokenName }),
      })
      const data = await res.json()
      
      if (data.success) {
        setNewToken(data.data.token)
        setNewTokenBundle(data.tokenBundleBase64 || null)
        setNewEndpoint(data.endpoint || null)
        fetchTokens()
      }
    } catch {
      // 忽略
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (id: number, is_active: boolean) => {
    try {
      await fetch('/api/admin/tokens', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active }),
      })
      fetchTokens()
    } catch {
      // 忽略
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/admin/tokens?id=${id}`, { method: 'DELETE' })
      fetchTokens()
    } catch {
      // 忽略
    }
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setNewTokenName('')
    setNewToken(null)
    setNewTokenBundle(null)
    setNewEndpoint(null)
  }

  const openTokenQr = async (token: ApiToken) => {
    setQrLoading(true)
    setQrTitle(token.name)
    setQrEndpoint('')
    setQrEncoded('')
    setQrDialogOpen(true)
    try {
      const res = await fetch(`/api/admin/tokens?bundle_id=${token.id}`)
      const data = await res.json()
      if (!res.ok || !data?.success || !data?.data?.encoded) {
        return
      }
      setQrEndpoint(String(data.data.endpoint || ''))
      setQrEncoded(String(data.data.encoded || ''))
    } catch {
      // ignore
    } finally {
      setQrLoading(false)
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

  return (
    <div className="space-y-6">
      {/* 创建按钮 */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">API Token</h3>
          <p className="text-sm text-muted-foreground">管理用于上报活动的 API Token</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              创建 Token
            </Button>
          </DialogTrigger>
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
                      onClick={() => copyToClipboard(newToken)}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
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
                        onClick={() => copyToClipboard(newTokenBundle)}
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
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
                        <QrCode className="h-4 w-4 mr-1" />
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
      </div>

      {/* Token 列表 */}
      <div className="grid gap-4">
        {loading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              加载中...
            </CardContent>
          </Card>
        ) : tokens.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              暂无 Token，点击上方按钮创建
            </CardContent>
          </Card>
        ) : (
          tokens.map((token) => (
            <Card key={token.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{token.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => openTokenQr(token)}
                      title="显示接入二维码"
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
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
              <CardContent>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>接入二维码</DialogTitle>
            <DialogDescription>
              扫码可获取该 Token 的 Base64 接入配置。
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
              {qrLoading ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  生成中...
                </div>
              ) : qrEncoded ? (
                <img
                  src={getQrImageUrl(qrEncoded)}
                  alt="token qrcode"
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
                onClick={() => copyToClipboard(qrEncoded)}
              >
                <Copy className="h-4 w-4 mr-1" />
                复制接入配置
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API 使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">上报活动数据:</p>
            <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
{`curl -X POST ${typeof window !== 'undefined' ? window.location.origin : ''}/api/activity \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "device": "MacBook Pro",
    "device_type": "desktop",
    "process_name": "VS Code",
    "process_title": "编辑 index.tsx",
    "battery_level": 82,
    "push_mode": "realtime"
  }'`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
