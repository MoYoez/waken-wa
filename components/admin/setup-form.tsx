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

const CROP_VIEW_SIZE = 320
const CROP_FRAME_SIZE = 220

// 让图片缩小到能完整看到全貌的最小缩放比例
function getMinZoom(naturalW: number, naturalH: number): number {
  if (!naturalW || !naturalH) return 0.2
  const fitScale = Math.min(CROP_VIEW_SIZE / naturalW, CROP_VIEW_SIZE / naturalH)
  // baseScale 是 max(frame/w, frame/h)，minZoom 让总缩放等于 fitScale
  const baseScale = Math.max(CROP_FRAME_SIZE / naturalW, CROP_FRAME_SIZE / naturalH)
  return Math.max(0.1, fitScale / baseScale)
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
  const [cropZoom, setCropZoom] = useState(1)
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState<{
    x: number
    y: number
    offsetX: number
    offsetY: number
  } | null>(null)
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
    const nw = image.naturalWidth
    const nh = image.naturalHeight
    setNaturalSize({ width: nw, height: nh })
    // 初始缩放让图片恰好填满裁剪框（min 1.0 of baseScale）
    setCropZoom(1)
    setCropOffset({ x: 0, y: 0 })
  }

  const getBaseScale = (nw = naturalSize.width, nh = naturalSize.height) => {
    if (!nw || !nh) return 1
    return Math.max(CROP_FRAME_SIZE / nw, CROP_FRAME_SIZE / nh)
  }

  const clampOffset = (x: number, y: number, zoom = cropZoom) => {
    if (!naturalSize.width || !naturalSize.height) return { x: 0, y: 0 }
    const totalScale = getBaseScale() * zoom
    const renderedWidth = naturalSize.width * totalScale
    const renderedHeight = naturalSize.height * totalScale
    // 当图片小于视口时，允许图片在视口内自由移动但不超出视口边界
    const halfView = CROP_VIEW_SIZE / 2
    const halfW = renderedWidth / 2
    const halfH = renderedHeight / 2
    const maxX = Math.max(0, halfW - CROP_FRAME_SIZE / 2)
    const maxY = Math.max(0, halfH - CROP_FRAME_SIZE / 2)
    const minX = Math.min(0, halfView - halfW - (CROP_VIEW_SIZE - CROP_FRAME_SIZE) / 2)
    const minY = Math.min(0, halfView - halfH - (CROP_VIEW_SIZE - CROP_FRAME_SIZE) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, Math.min(Math.max(x, minX), maxX))),
      y: Math.min(maxY, Math.max(-maxY, Math.min(Math.max(y, minY), maxY))),
    }
  }

  const applyCrop = () => {
    if (!cropSourceUrl || !cropImageRef.current || !naturalSize.width || !naturalSize.height) {
      setError('请先选择并调整头像区域')
      return
    }
    const totalScale = getBaseScale() * cropZoom
    const imageLeft =
      CROP_VIEW_SIZE / 2 + cropOffset.x - (naturalSize.width * totalScale) / 2
    const imageTop =
      CROP_VIEW_SIZE / 2 + cropOffset.y - (naturalSize.height * totalScale) / 2
    const frameLeft = (CROP_VIEW_SIZE - CROP_FRAME_SIZE) / 2
    const frameTop = (CROP_VIEW_SIZE - CROP_FRAME_SIZE) / 2

    let sx = (frameLeft - imageLeft) / totalScale
    let sy = (frameTop - imageTop) / totalScale
    let sw = CROP_FRAME_SIZE / totalScale
    let sh = CROP_FRAME_SIZE / totalScale

    sx = Math.max(0, Math.min(sx, naturalSize.width - sw))
    sy = Math.max(0, Math.min(sy, naturalSize.height - sh))
    sw = Math.max(1, Math.min(sw, naturalSize.width))
    sh = Math.max(1, Math.min(sh, naturalSize.height))

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
                  setCropZoom(1)
                  setCropOffset({ x: 0, y: 0 })
                  setDragStart(null)
                }}
                className="w-full text-xs text-muted-foreground file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:border-border file:bg-muted/50 file:text-foreground hover:file:bg-muted file:cursor-pointer"
              />
              <p className="text-[11px] text-muted-foreground">
                上传后在弹窗中拖动和缩放图片，确认后保存为 64x64 正方形（PNG DataURL）
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
                  <label className="text-xs font-medium text-foreground">“当前”区块标���</label>
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
            <div className="space-y-3">
              <div
                className="relative mx-auto border border-border rounded-md overflow-hidden bg-black/40"
                style={{ width: CROP_VIEW_SIZE, height: CROP_VIEW_SIZE }}
                onMouseDown={(e) => {
                  setDragStart({
                    x: e.clientX,
                    y: e.clientY,
                    offsetX: cropOffset.x,
                    offsetY: cropOffset.y,
                  })
                }}
                onMouseMove={(e) => {
                  if (!dragStart) return
                  const dx = e.clientX - dragStart.x
                  const dy = e.clientY - dragStart.y
                  const next = clampOffset(
                    dragStart.offsetX + dx,
                    dragStart.offsetY + dy
                  )
                  setCropOffset(next)
                }}
                onMouseUp={() => setDragStart(null)}
                onMouseLeave={() => setDragStart(null)}
              >
              <img
                ref={cropImageRef}
                src={cropSourceUrl}
                alt="avatar crop preview"
                onLoad={onCropImageLoad}
                className="absolute select-none"
                draggable={false}
                style={{
                  left: `calc(50% + ${cropOffset.x}px)`,
                  top: `calc(50% + ${cropOffset.y}px)`,
                  transform: 'translate(-50%, -50%)',
                  width: naturalSize.width
                    ? `${naturalSize.width * getBaseScale() * cropZoom}px`
                    : 'auto',
                  height: naturalSize.height
                    ? `${naturalSize.height * getBaseScale() * cropZoom}px`
                    : 'auto',
                  cursor: dragStart ? 'grabbing' : 'grab',
                }}
              />
                <div
                  className="absolute border-2 border-primary pointer-events-none"
                  style={{
                    left: (CROP_VIEW_SIZE - CROP_FRAME_SIZE) / 2,
                    top: (CROP_VIEW_SIZE - CROP_FRAME_SIZE) / 2,
                    width: CROP_FRAME_SIZE,
                    height: CROP_FRAME_SIZE,
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)',
                  }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">缩放（左滑缩小可看全图，右滑放大后拖动选取区域）</label>
                <input
                  type="range"
                  min={getMinZoom(naturalSize.width, naturalSize.height)}
                  max={4}
                  step={0.01}
                  value={cropZoom}
                  onChange={(e) => {
                    const nextZoom = Number(e.target.value)
                    const nextOffset = clampOffset(cropOffset.x, cropOffset.y, nextZoom)
                    setCropZoom(nextZoom)
                    setCropOffset(nextOffset)
                  }}
                  className="w-full"
                />
              </div>
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
