'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

function getMinZoom(naturalW: number, naturalH: number): number {
  if (!naturalW || !naturalH) return 0.2
  const fitScale = Math.min(CROP_VIEW_SIZE / naturalW, CROP_VIEW_SIZE / naturalH)
  const baseScale = Math.max(CROP_FRAME_SIZE / naturalW, CROP_FRAME_SIZE / naturalH)
  return Math.max(0.1, fitScale / baseScale)
}

interface SiteConfig {
  userName: string
  userBio: string
  avatarUrl: string
  userNote: string
  themePreset: string
  customCss: string
  historyWindowMinutes: number
  historyWindowHintText: string
  processStaleSeconds: number
  appMessageRules: Array<{ match: string; text: string }>
  pageLockEnabled: boolean
  pageLockPassword: string
  currentlyText: string
  earlierText: string
  updatesText: string
  adminText: string
}

export function WebSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>('')
  const [rulesText, setRulesText] = useState('[]')
  // 裁剪弹窗状态
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [cropZoom, setCropZoom] = useState(1)
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const cropImageRef = useRef<HTMLImageElement | null>(null)
  const [form, setForm] = useState<SiteConfig>({
    userName: '',
    userBio: '',
    avatarUrl: '',
    userNote: '',
    themePreset: 'basic',
    customCss: '',
    historyWindowMinutes: 120,
    historyWindowHintText: '历史窗口：最近 2 小时（可在设置中调整）',
    processStaleSeconds: 500,
    appMessageRules: [],
    pageLockEnabled: false,
    pageLockPassword: '',
    currentlyText: 'currently',
    earlierText: 'earlier',
    updatesText: 'updates every 30 seconds',
    adminText: 'admin',
  })

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/settings')
        const data = await res.json()
        if (data?.success && data?.data) {
          const rules = Array.isArray(data.data.appMessageRules) ? data.data.appMessageRules : []
          setForm({
            userName: data.data.userName ?? '',
            userBio: data.data.userBio ?? '',
            avatarUrl: data.data.avatarUrl ?? '',
            userNote: data.data.userNote ?? '',
            themePreset: data.data.themePreset ?? 'basic',
            customCss: data.data.customCss ?? '',
            historyWindowMinutes: Number(data.data.historyWindowMinutes ?? 120),
            historyWindowHintText:
              data.data.historyWindowHintText ?? '历史窗口：最近 2 小时（可在设置中调整）',
            processStaleSeconds: Number(data.data.processStaleSeconds ?? 500),
            appMessageRules: rules,
            pageLockEnabled: Boolean(data.data.pageLockEnabled),
            pageLockPassword: '',
            currentlyText: data.data.currentlyText ?? 'currently',
            earlierText: data.data.earlierText ?? 'earlier',
            updatesText: data.data.updatesText ?? 'updates every 30 seconds',
            adminText: data.data.adminText ?? 'admin',
          })
          setRulesText(JSON.stringify(rules, null, 2))
        }
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const patch = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const getBaseScale = () => {
    if (!naturalSize.width || !naturalSize.height) return 1
    return Math.max(CROP_FRAME_SIZE / naturalSize.width, CROP_FRAME_SIZE / naturalSize.height)
  }

  const clampOffset = (x: number, y: number, zoom = cropZoom) => {
    if (!naturalSize.width || !naturalSize.height) return { x: 0, y: 0 }
    const totalScale = getBaseScale() * zoom
    const renderedWidth = naturalSize.width * totalScale
    const renderedHeight = naturalSize.height * totalScale
    const maxX = Math.max(0, (renderedWidth - CROP_FRAME_SIZE) / 2)
    const maxY = Math.max(0, (renderedHeight - CROP_FRAME_SIZE) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    }
  }

  const onFileSelected = (file?: File) => {
    if (!file) return
    if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl)
    const objectUrl = URL.createObjectURL(file)
    setCropSourceUrl(objectUrl)
    setCropZoom(1)
    setCropOffset({ x: 0, y: 0 })
    setDragStart(null)
    setCropDialogOpen(true)
  }

  const applyCrop = () => {
    if (!cropSourceUrl || !cropImageRef.current || !naturalSize.width || !naturalSize.height) return
    const totalScale = getBaseScale() * cropZoom
    const imageLeft = CROP_VIEW_SIZE / 2 + cropOffset.x - (naturalSize.width * totalScale) / 2
    const imageTop = CROP_VIEW_SIZE / 2 + cropOffset.y - (naturalSize.height * totalScale) / 2
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
    if (!ctx) return
    ctx.drawImage(cropImageRef.current, sx, sy, sw, sh, 0, 0, 64, 64)
    patch('avatarUrl', canvas.toDataURL('image/png'))
    setCropDialogOpen(false)
    URL.revokeObjectURL(cropSourceUrl)
    setCropSourceUrl(null)
    setDragStart(null)
  }

  const save = async () => {
    setMessage('')
    setSaving(true)
    try {
      let parsedRules: Array<{ match: string; text: string }> = []
      try {
        const parsed = JSON.parse(rulesText)
        if (!Array.isArray(parsed)) throw new Error()
        parsedRules = parsed.map((r) => ({
          match: String(r?.match ?? ''),
          text: String(r?.text ?? ''),
        }))
      } catch {
        setMessage('应用匹配规则 JSON 格式错误')
        return
      }

      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          appMessageRules: parsedRules,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setMessage(data?.error || '保存失败')
        return
      }
      setMessage('保存成功，主页刷新后生效')
    } catch {
      setMessage('网络异常，请重试')
    } finally {
      setSaving(false)
    }
  }

  const copyExportConfig = async () => {
    setMessage('')
    try {
      const res = await fetch('/api/admin/settings/export')
      const data = await res.json()
      if (!res.ok || !data?.success || !data?.data?.encoded) {
        setMessage(data?.error || '导出失败')
        return
      }

      await navigator.clipboard.writeText(data.data.encoded)
      setMessage('已复制 Base64 接入配置，可在其他设备解码后使用')
    } catch {
      setMessage('复制失败，请重试')
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">加载配置中...</div>
  }

  return (
    <div className="rounded-xl border bg-card p-6 space-y-5">
      <h3 className="font-semibold text-foreground">Web 配置</h3>

      <div className="space-y-2">
        <Label>首页名称</Label>
        <Input value={form.userName} onChange={(e) => patch('userName', e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>首页简介</Label>
        <Input value={form.userBio} onChange={(e) => patch('userBio', e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>首页备注</Label>
        <Input value={form.userNote} onChange={(e) => patch('userNote', e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>主题预设</Label>
        <select
          value={form.themePreset}
          onChange={(e) => patch('themePreset', e.target.value)}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="basic">Basic - 默认主题</option>
          <option value="obsidian">Obsidian - 纯黑极简</option>
          <option value="mono">Mono - 纯白极简</option>
          <option value="midnight">Midnight - 深邃蓝紫</option>
          <option value="ocean">Ocean - 深海蓝绿</option>
          <option value="nord">Nord - 北欧冷淡</option>
          <option value="forest">Forest - 自然森林</option>
          <option value="sakura">Sakura - 柔和樱花</option>
          <option value="lavender">Lavender - 淡雅薰衣草</option>
          <option value="amber">Amber - 温暖琥珀</option>
        </select>
        <p className="text-xs text-muted-foreground">
          深色系：Obsidian、Midnight、Ocean、Nord | 浅色系：Mono、Forest、Sakura、Lavender、Amber
        </p>
      </div>

      <div className="space-y-2">
        <Label>自定义 CSS 覆写（主界面）</Label>
        <textarea
          rows={8}
          value={form.customCss}
          onChange={(e) => patch('customCss', e.target.value)}
          className="w-full px-3 py-2 border rounded-md bg-background text-sm font-mono"
          placeholder="示例：:root { --primary: oklch(0.5 0.2 30); }"
        />
        <p className="text-xs text-muted-foreground">
          保存后会注入主页并覆盖默认样式，可用于快速主题定制。
        </p>
      </div>

      <div className="space-y-2">
        <Label>头像地址（URL / DataURL）</Label>
        <Input value={form.avatarUrl} onChange={(e) => patch('avatarUrl', e.target.value)} />
        <p className="text-xs text-muted-foreground">可直接填写图片链接，或通过下方上传并裁剪后自动生成。</p>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => { onFileSelected(e.target.files?.[0]); e.target.value = '' }}
          className="w-full text-xs text-muted-foreground file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:border-border file:bg-muted/50 file:text-foreground hover:file:bg-muted file:cursor-pointer"
        />
        {cropSourceUrl && (
          <button
            type="button"
            onClick={() => setCropDialogOpen(true)}
            className="px-3 py-1.5 border border-border rounded-md text-xs font-medium hover:bg-muted transition-colors"
          >
            重新打��裁剪
          </button>
        )}
        {form.avatarUrl && (
          <div className="flex items-center gap-3 rounded-md border border-border/60 bg-background/60 p-3">
            <img
              src={form.avatarUrl}
              alt="头像预览"
              className="w-10 h-10 rounded-full border border-border object-cover"
            />
            <span className="text-xs text-muted-foreground">头像预览</span>
          </div>
        )}
      </div>

      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>裁剪头像</DialogTitle>
            <DialogDescription>左滑缩放可看全图，放大后拖动图片选取区域，确认后生成 64×64 头像。</DialogDescription>
          </DialogHeader>
          {cropSourceUrl && (
            <div className="space-y-3">
              <div
                className="relative mx-auto border border-border rounded-md overflow-hidden bg-black/40 select-none"
                style={{ width: CROP_VIEW_SIZE, height: CROP_VIEW_SIZE }}
                onMouseDown={(e) => setDragStart({ x: e.clientX, y: e.clientY, offsetX: cropOffset.x, offsetY: cropOffset.y })}
                onMouseMove={(e) => {
                  if (!dragStart) return
                  const next = clampOffset(dragStart.offsetX + e.clientX - dragStart.x, dragStart.offsetY + e.clientY - dragStart.y)
                  setCropOffset(next)
                }}
                onMouseUp={() => setDragStart(null)}
                onMouseLeave={() => setDragStart(null)}
              >
                <img
                  ref={cropImageRef}
                  src={cropSourceUrl}
                  alt="裁剪预览"
                  onLoad={() => {
                    const img = cropImageRef.current
                    if (!img) return
                    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
                    setCropZoom(1)
                    setCropOffset({ x: 0, y: 0 })
                  }}
                  draggable={false}
                  className="absolute"
                  style={{
                    left: `calc(50% + ${cropOffset.x}px)`,
                    top: `calc(50% + ${cropOffset.y}px)`,
                    transform: 'translate(-50%, -50%)',
                    width: naturalSize.width ? `${naturalSize.width * getBaseScale() * cropZoom}px` : 'auto',
                    height: naturalSize.height ? `${naturalSize.height * getBaseScale() * cropZoom}px` : 'auto',
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

      <div className="space-y-2">
        <Label>历史窗口（分钟）</Label>
        <Input
          type="number"
          min={10}
          max={1440}
          value={form.historyWindowMinutes}
          onChange={(e) => patch('historyWindowMinutes', Number(e.target.value || 120))}
        />
      </div>
      <div className="space-y-2">
        <Label>历史窗口提示文案</Label>
        <Input
          value={form.historyWindowHintText}
          onChange={(e) => patch('historyWindowHintText', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>进程超时判定（秒）</Label>
        <Input
          type="number"
          min={30}
          max={86400}
          value={form.processStaleSeconds}
          onChange={(e) => patch('processStaleSeconds', Number(e.target.value || 500))}
        />
        <p className="text-xs text-muted-foreground">
          超过该时长仍未收到该进程新活动时，将自动判定为已结束。默认 500 秒。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>当前区块标题</Label>
          <Input value={form.currentlyText} onChange={(e) => patch('currentlyText', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>历史区块标题</Label>
          <Input value={form.earlierText} onChange={(e) => patch('earlierText', e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>底部更新文案</Label>
          <Input value={form.updatesText} onChange={(e) => patch('updatesText', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>后台入口文案</Label>
          <Input value={form.adminText} onChange={(e) => patch('adminText', e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>应用匹配文案规则（JSON）</Label>
        <textarea
          rows={6}
          value={rulesText}
          onChange={(e) => setRulesText(e.target.value)}
          className="w-full px-3 py-2 border rounded-md bg-background text-sm font-mono"
        />
        <p className="text-xs text-muted-foreground">
          示例：[{`{"match":"WindowsTerminal.exe","text":"正在编码：{title}"}`}]。支持 {'{process}'}、{'{title}'} 占位符。
        </p>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.pageLockEnabled}
            onChange={(e) => patch('pageLockEnabled', e.target.checked)}
          />
          启用页面访问密码锁
        </Label>
        <Input
          type="password"
          placeholder="设置/更新页面访问密码（留空则不修改）"
          value={form.pageLockPassword}
          onChange={(e) => patch('pageLockPassword', e.target.value)}
        />
      </div>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      <div className="flex flex-wrap gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? '保存中...' : '保存配置'}
        </Button>
        <Button type="button" variant="outline" onClick={copyExportConfig}>
          一键复制接入配置（Base64）
        </Button>
      </div>
    </div>
  )
}
