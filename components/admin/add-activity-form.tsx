'use client'

import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  USER_ACTIVITY_PERSIST_MAX_MINUTES,
  USER_ACTIVITY_PERSIST_MIN_MINUTES_UI,
} from '@/lib/user-activity-persist'

interface AddActivityFormProps {
  onSuccess?: () => void
}

export function AddActivityForm({ onSuccess }: AddActivityFormProps) {
  const [device, setDevice] = useState('')
  const [processName, setProcessName] = useState('')
  const [processTitle, setProcessTitle] = useState('')
  const [persistMinutes, setPersistMinutes] = useState('30')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const parsedPersist = Math.round(Number(persistMinutes))
      const safePersist =
        Number.isFinite(parsedPersist) && parsedPersist > 0
          ? Math.min(
              Math.max(parsedPersist, USER_ACTIVITY_PERSIST_MIN_MINUTES_UI),
              USER_ACTIVITY_PERSIST_MAX_MINUTES,
            )
          : 30

      const res = await fetch('/api/admin/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generatedHashKey: '',
          device,
          process_name: processName,
          process_title: processTitle || undefined,
          persist_minutes: safePersist,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setMessage({ type: 'success', text: '活动已添加' })
        setDevice('')
        setProcessName('')
        setProcessTitle('')
        onSuccess?.()
      } else {
        setMessage({ type: 'error', text: data.error || '添加失败' })
      }
    } catch {
      setMessage({ type: 'error', text: '网络错误' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="device">设备名称</Label>
          <Input
            id="device"
            placeholder="例如：MacBook Pro"
            value={device}
            onChange={(e) => setDevice(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="process">进程名称</Label>
          <Input
            id="process"
            placeholder="例如：VS Code"
            value={processName}
            onChange={(e) => setProcessName(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">进程标题（可选）</Label>
        <Input
          id="title"
          placeholder="例如：编辑 index.tsx"
          value={processTitle}
          onChange={(e) => setProcessTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="persist">常驻时长（分钟）</Label>
        <Input
          id="persist"
          type="number"
          inputMode="numeric"
          min={USER_ACTIVITY_PERSIST_MIN_MINUTES_UI}
          max={USER_ACTIVITY_PERSIST_MAX_MINUTES}
          value={persistMinutes}
          onChange={(e) => setPersistMinutes(e.target.value)}
        />
        <p className="text-xs text-muted-foreground leading-relaxed">
          无客户端上报时，超过该时间后活动会从首页「当前状态」自动结束（1–1440 分钟，与站点「进程无上报判定间隔」规则一致）。
        </p>
      </div>

      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-emerald-500' : 'text-destructive'}`}>
          {message.text}
        </p>
      )}

      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        添加活动
      </Button>
    </form>
  )
}
