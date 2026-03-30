'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { ImageCropDialog } from '@/components/admin/image-crop-dialog'
import { DEFAULT_PAGE_TITLE, PAGE_TITLE_MAX_LEN } from '@/lib/default-page-title'
import { SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES } from '@/lib/site-config-constants'
import type { SetupInitialConfig } from '@/types/components'

export type { SetupInitialConfig } from '@/types/components'

interface SetupFormProps {
  needAdminSetup: boolean
  initialConfig?: SetupInitialConfig
}

export function SetupForm({ needAdminSetup, initialConfig }: SetupFormProps) {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pageTitle, setPageTitle] = useState(
    initialConfig?.pageTitle ?? DEFAULT_PAGE_TITLE
  )
  const [userName, setUserName] = useState(initialConfig?.userName ?? '')
  const [userBio, setUserBio] = useState(initialConfig?.userBio ?? '')
  const [avatarUrl, setAvatarUrl] = useState(initialConfig?.avatarUrl ?? '')
  const [userNote, setUserNote] = useState(initialConfig?.userNote ?? '')
  const [historyWindowMinutes, setHistoryWindowMinutes] = useState(
    initialConfig?.historyWindowMinutes ?? SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
  )
  const [currentlyText, setCurrentlyText] = useState(initialConfig?.currentlyText ?? '')
  const [earlierText, setEarlierText] = useState(initialConfig?.earlierText ?? '')
  const [adminText, setAdminText] = useState(initialConfig?.adminText ?? '')
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    return () => {
      if (cropSourceUrl) {
        URL.revokeObjectURL(cropSourceUrl)
      }
    }
  }, [cropSourceUrl])

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
          pageTitle: pageTitle.slice(0, PAGE_TITLE_MAX_LEN),
          userName,
          userBio,
          avatarUrl,
          userNote,
          historyWindowMinutes,
          currentlyText,
          earlierText,
          adminText,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || '初始化失败')
        return
      }

      // 首次初始化成功后，直接登录并进入后台首页，避免再次回到 setup 流程。
      if (needAdminSetup) {
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password,
          }),
        })
        const loginData = await loginRes.json()
        if (!loginRes.ok || !loginData?.success) {
          setError(loginData?.error || '初始化成功，但自动登录失败，请手动登录')
          router.push('/admin/login')
          router.refresh()
          return
        }
      }

      router.push('/admin')
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
                <label className="text-xs font-medium text-foreground">网页标题（浏览器标签页）</label>
                <p className="text-[11px] text-muted-foreground">浏览器标签上显示的站点标题，最多 {PAGE_TITLE_MAX_LEN} 字。</p>
                <input
                  type="text"
                  value={pageTitle}
                  maxLength={PAGE_TITLE_MAX_LEN}
                  onChange={(e) => setPageTitle(e.target.value)}
                  placeholder={DEFAULT_PAGE_TITLE}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
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
                  e.target.value = ''
                }}
                className="w-full text-xs text-muted-foreground file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:border-border file:bg-muted/50 file:text-foreground hover:file:bg-muted file:cursor-pointer"
              />
              <p className="text-[11px] text-muted-foreground">
                上传后在弹窗中拖动和缩放图片，确认后保存为 128×128 正方形（PNG DataURL）
              </p>
              {avatarUrl && (
                <div className="flex items-center gap-3 rounded-md border border-border/60 bg-background/60 p-3">
                  <Image
                    src={avatarUrl}
                    alt="avatar preview"
                    width={40}
                    height={40}
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
                  <p className="text-[11px] text-muted-foreground">
                    主页历史列表仅显示最近这段时间，默认 {SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES}{' '}
                    分钟。
                  </p>
                  <input
                    type="number"
                    min={10}
                    max={1440}
                    step={10}
                    value={historyWindowMinutes}
                    onChange={(e) =>
                      setHistoryWindowMinutes(
                        Number(e.target.value || SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES),
                      )
                    }
                    onWheel={(e) => e.currentTarget.blur()}
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
                    placeholder="例如：当前状态"
                    className="w-full px-3 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">随想录区块标题</label>
                  <p className="text-[11px] text-muted-foreground">首页第二区块（最近随想录列表）的标题文案。</p>
                  <input
                    type="text"
                    value={earlierText}
                    onChange={(e) => setEarlierText(e.target.value)}
                    placeholder="例如：最近的随想录"
                    className="w-full px-3 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
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
      <ImageCropDialog
        open={cropDialogOpen}
        onOpenChange={(open) => {
          setCropDialogOpen(open)
          if (!open) {
            setCropSourceUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev)
              return null
            })
          }
        }}
        sourceUrl={cropSourceUrl}
        aspectMode="square"
        outputSize={128}
        title="裁剪头像"
        description="拖动选区或边角调整范围，滑块缩放图片；确认后生成 128×128 头像。"
        onComplete={(dataUrl) => {
          setAvatarUrl(dataUrl)
        }}
      />
    </div>
  )
}
