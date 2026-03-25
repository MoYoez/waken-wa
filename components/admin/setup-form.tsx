'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type CropRect = {
  x: number
  y: number
  size: number
}

function clampCropSquare(
  start: { x: number; y: number },
  current: { x: number; y: number },
  maxW: number,
  maxH: number
): CropRect {
  const dx = current.x - start.x
  const dy = current.y - start.y
  const dirX = dx >= 0 ? 1 : -1
  const dirY = dy >= 0 ? 1 : -1

  let size = Math.max(Math.abs(dx), Math.abs(dy))
  const maxSizeX = dirX > 0 ? maxW - start.x : start.x
  const maxSizeY = dirY > 0 ? maxH - start.y : start.y
  size = Math.max(1, Math.min(size, maxSizeX, maxSizeY))

  return {
    x: dirX > 0 ? start.x : start.x - size,
    y: dirY > 0 ? start.y : start.y - size,
    size,
  }
}

interface SetupInitialConfig {
  userName: string
  userBio: string
  avatarUrl: string
  userNote: string
  historyWindowMinutes: number
  currentlyText: string
  earlierText: string
  updatesText: string
  adminText: string
}

interface SetupFormProps {
  needAdminSetup: boolean
  initialConfig?: SetupInitialConfig
}

export function SetupForm({ needAdminSetup, initialConfig }: SetupFormProps) {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [userName, setUserName] = useState(initialConfig?.userName ?? '')
  const [userBio, setUserBio] = useState(initialConfig?.userBio ?? '')
  const [avatarUrl, setAvatarUrl] = useState(initialConfig?.avatarUrl ?? '')
  const [userNote, setUserNote] = useState(initialConfig?.userNote ?? '')
  const [historyWindowMinutes, setHistoryWindowMinutes] = useState(
    initialConfig?.historyWindowMinutes ?? 120
  )
  const [currentlyText, setCurrentlyText] = useState(initialConfig?.currentlyText ?? '')
  const [earlierText, setEarlierText] = useState(initialConfig?.earlierText ?? '')
  const [updatesText, setUpdatesText] = useState(initialConfig?.updatesText ?? '')
  const [adminText, setAdminText] = useState(initialConfig?.adminText ?? '')
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [cropRect, setCropRect] = useState<CropRect | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const cropImageRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    return () => {
      if (cropSourceUrl) {
        URL.revokeObjectURL(cropSourceUrl)
      }
    }
  }, [cropSourceUrl])

  const onCropImageLoad = () => {
    const image = cropImageRef.current
    if (!image) return

    const width = image.clientWidth
    const height = image.clientHeight
    setDisplaySize({ width, height })
    setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight })

    const initialSize = Math.floor(Math.min(width, height) * 0.7)
    setCropRect({
      x: Math.floor((width - initialSize) / 2),
      y: Math.floor((height - initialSize) / 2),
      size: initialSize,
    })
  }

  const getRelativePoint = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>
  ): { x: number; y: number } | null => {
    const target = e.currentTarget
    const rect = target.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null
    return { x, y }
  }

  const applyCrop = () => {
    if (!cropSourceUrl || !cropRect || !cropImageRef.current) {
      setError('请先选择并框选头像区域')
      return
    }
    if (!displaySize.width || !displaySize.height || !naturalSize.width || !naturalSize.height) {
      setError('头像尺寸读取失败，请重新选择图片')
      return
    }

    const scaleX = naturalSize.width / displaySize.width
    const scaleY = naturalSize.height / displaySize.height
    const sx = Math.round(cropRect.x * scaleX)
    const sy = Math.round(cropRect.y * scaleY)
    const sw = Math.max(1, Math.round(cropRect.size * scaleX))
    const sh = Math.max(1, Math.round(cropRect.size * scaleY))

    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setError('头像处理失败，请重试')
      return
    }

    ctx.drawImage(cropImageRef.current, sx, sy, sw, sh, 0, 0, 64, 64)
    setAvatarUrl(canvas.toDataURL('image/png'))
    setCropDialogOpen(false)
    if (cropSourceUrl) {
      URL.revokeObjectURL(cropSourceUrl)
    }
    setCropSourceUrl(null)
    setCropRect(null)
    setDragStart(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (needAdminSetup && password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/setup/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: needAdminSetup ? username : undefined,
          password: needAdminSetup ? password : undefined,
          userName,
          userBio,
          avatarUrl,
          userNote,
          historyWindowMinutes,
          currentlyText,
          earlierText,
          updatesText,
          adminText,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || '初始化失败')
        return
      }

      router.push('/admin/login')
      router.refresh()
    } catch {
      setError('网络异常，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-xl rounded-2xl border border-border/70 bg-card/90 backdrop-blur-sm p-6 shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-wide text-foreground">站点初始化</h1>
          <p className="text-xs text-muted-foreground mt-2">
            {needAdminSetup ? '首次使用请配置管理员与首页信息' : '请完成首页信息配置'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 max-h-[78vh] overflow-y-auto pr-1">
          {needAdminSetup && (
            <>
              <div className="space-y-2">
                <label htmlFor="username" className="text-xs text-muted-foreground uppercase tracking-wider">
                  管理员用户名
                </label>
                <p className="text-[11px] text-muted-foreground">用于登录后台管理系统，建议使用易记且不易猜测的名称。</p>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                  autoComplete="username"
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors text-sm"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-xs text-muted-foreground uppercase tracking-wider">
                  管理员密码
                </label>
                <p className="text-[11px] text-muted-foreground">用于后台登录，至少 6 位，建议包含数字与字母。</p>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位"
                  minLength={6}
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors text-sm"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-xs text-muted-foreground uppercase tracking-wider">
                  确认管理员密码
                </label>
                <p className="text-[11px] text-muted-foreground">再次输入管理员密码，确保输入正确。</p>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入密码"
                  minLength={6}
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors text-sm"
                />
              </div>
            </>
          )}

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Homepage Profile</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">首页名称</label>
                <p className="text-[11px] text-muted-foreground">展示在头像右侧的主名称（例如昵称、品牌名）。</p>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="例如：Koi"
                  required
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">首页简介</label>
                <p className="text-[11px] text-muted-foreground">名称下方的一句话简介，用于介绍你当前的定位。</p>
                <input
                  type="text"
                  value={userBio}
                  onChange={(e) => setUserBio(e.target.value)}
                  placeholder="例如：Code with patience and optimism."
                  required
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">首页备注</label>
                <p className="text-[11px] text-muted-foreground">显示在简介下方的扩展说明，可写当前状态或想法。</p>
                <textarea
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  placeholder="例如：Writing code, sipping coffee..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">头像地址（URL / DataURL）</label>
                <p className="text-[11px] text-muted-foreground">可直接填写图片链接，或通过下方上传并裁剪后自动生成。</p>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://... 或 data:image/png;base64,..."
                  required
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  setError('')
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (cropSourceUrl) {
                    URL.revokeObjectURL(cropSourceUrl)
                  }
                  const objectUrl = URL.createObjectURL(file)
                  setCropSourceUrl(objectUrl)
                  setCropDialogOpen(true)
                  setCropRect(null)
                  setDragStart(null)
                }}
                className="w-full text-xs text-muted-foreground file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:border-border file:bg-muted/50 file:text-foreground hover:file:bg-muted file:cursor-pointer"
              />
              <p className="text-[11px] text-muted-foreground">
                上传后请拖拽框选裁剪区域，保存为 64x64 正方形（PNG DataURL）
              </p>
              {avatarUrl && (
                <div className="flex items-center gap-3 rounded-md border border-border/60 bg-background/60 p-3">
                  <img
                    src={avatarUrl}
                    alt="avatar preview"
                    className="w-10 h-10 rounded-full border border-border object-cover"
                  />
                  <span className="text-xs text-muted-foreground">头像预览（当前将保存到数据库）</span>
                </div>
              )}
              {cropSourceUrl && (
                <button
                  type="button"
                  onClick={() => setCropDialogOpen(true)}
                  className="px-3 py-2 border border-border rounded-md text-xs font-medium hover:bg-muted transition-colors"
                >
                  打开裁剪弹窗
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">历史展示窗口（分钟）</label>
                  <p className="text-[11px] text-muted-foreground">主页历史列表仅显示最近这段时间，默认 120 分钟。</p>
                  <input
                    type="number"
                    min={10}
                    max={1440}
                    step={10}
                    value={historyWindowMinutes}
                    onChange={(e) => setHistoryWindowMinutes(Number(e.target.value || 120))}
                    className="w-full px-3 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">“当前”区块标题</label>
                  <p className="text-[11px] text-muted-foreground">首页活动详情区域的标题文案。</p>
                  <input
                    type="text"
                    value={currentlyText}
                    onChange={(e) => setCurrentlyText(e.target.value)}
                    placeholder="例如：currently / 当前"
                    className="w-full px-3 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">“更早”区块标题</label>
                  <p className="text-[11px] text-muted-foreground">首页时间线区域的标题文案。</p>
                  <input
                    type="text"
                    value={earlierText}
                    onChange={(e) => setEarlierText(e.target.value)}
                    placeholder="例如：earlier / 更早"
                    className="w-full px-3 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">底部更新提示文案</label>
                  <p className="text-[11px] text-muted-foreground">显示在页脚左侧，说明刷新频率或提示信息。</p>
                  <input
                    type="text"
                    value={updatesText}
                    onChange={(e) => setUpdatesText(e.target.value)}
                    placeholder="例如：updates every 30 seconds"
                    className="w-full px-3 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">后台入口文案</label>
                  <p className="text-[11px] text-muted-foreground">显示在页脚右侧，点击后进入后台。</p>
                  <input
                    type="text"
                    value={adminText}
                    onChange={(e) => setAdminText(e.target.value)}
                    placeholder="例如：admin / 后台"
                    className="w-full px-3 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm shadow-sm"
          >
            {loading ? '保存中...' : needAdminSetup ? '创建管理员并保存配置' : '保存配置'}
          </button>
        </form>
      </div>
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>裁剪头像</DialogTitle>
            <DialogDescription>请在图片上拖拽框选区域，确认后将生成 64x64 头像。</DialogDescription>
          </DialogHeader>
          {cropSourceUrl && (
            <div
              className="relative w-full border border-border rounded-md overflow-hidden cursor-crosshair bg-black/20"
              onMouseDown={(e) => {
                const p = getRelativePoint(e)
                if (!p) return
                setDragStart(p)
                setCropRect({ x: p.x, y: p.y, size: 1 })
              }}
              onMouseMove={(e) => {
                if (!dragStart) return
                const p = getRelativePoint(e)
                if (!p) return
                setCropRect(
                  clampCropSquare(dragStart, p, displaySize.width, displaySize.height)
                )
              }}
              onMouseUp={() => setDragStart(null)}
              onMouseLeave={() => setDragStart(null)}
            >
              <img
                ref={cropImageRef}
                src={cropSourceUrl}
                alt="avatar crop preview"
                onLoad={onCropImageLoad}
                className="block w-full h-auto select-none"
                draggable={false}
              />
              {cropRect && (
                <div
                  className="absolute border-2 border-primary bg-primary/10 pointer-events-none"
                  style={{
                    left: cropRect.x,
                    top: cropRect.y,
                    width: cropRect.size,
                    height: cropRect.size,
                  }}
                />
              )}
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setCropDialogOpen(false)}
              className="px-3 py-2 border border-border rounded-md text-xs font-medium hover:bg-muted transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={applyCrop}
              className="px-3 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              确认裁剪
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
