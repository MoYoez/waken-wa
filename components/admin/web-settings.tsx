'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

interface AdminUser {
  id: number
  username: string
  createdAt: string
}

export function WebSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>('')
  const [rulesText, setRulesText] = useState('[]')
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [newAdminUsername, setNewAdminUsername] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [creatingAdmin, setCreatingAdmin] = useState(false)
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
        const usersRes = await fetch('/api/admin/users')
        const usersData = await usersRes.json()
        if (usersData?.success) setAdmins(usersData.data || [])
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const patch = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const onFileSelected = async (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (result) patch('avatarUrl', result)
    }
    reader.readAsDataURL(file)
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

  const createAdmin = async () => {
    setMessage('')
    setCreatingAdmin(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newAdminUsername,
          password: newAdminPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setMessage(data?.error || '创建管理员失败')
        return
      }
      setNewAdminUsername('')
      setNewAdminPassword('')
      setAdmins((prev) => [data.data, ...prev])
      setMessage('管理员创建成功')
    } catch {
      setMessage('网络异常，请重试')
    } finally {
      setCreatingAdmin(false)
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
          <option value="basic">Basic（默认）</option>
          <option value="midnight">Midnight（深夜蓝）</option>
          <option value="forest">Forest（森林绿）</option>
          <option value="sakura">Sakura（樱花粉）</option>
        </select>
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
        <input
          type="file"
          accept="image/*"
          onChange={(e) => void onFileSelected(e.target.files?.[0])}
          className="w-full text-xs text-muted-foreground"
        />
      </div>

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

      <div className="space-y-2">
        <Label>管理员账号（支持多个）</Label>
        <div className="rounded-md border p-3 space-y-2">
          {admins.length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无管理员</p>
          ) : (
            admins.map((u) => (
              <div key={u.id} className="text-xs text-muted-foreground">
                {u.username}
              </div>
            ))
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input
            placeholder="新管理员用户名"
            value={newAdminUsername}
            onChange={(e) => setNewAdminUsername(e.target.value)}
          />
          <Input
            type="password"
            placeholder="新管理员密码"
            value={newAdminPassword}
            onChange={(e) => setNewAdminPassword(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={creatingAdmin || !newAdminUsername || !newAdminPassword}
            onClick={createAdmin}
          >
            {creatingAdmin ? '创建中...' : '新增管理员'}
          </Button>
        </div>
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
