'use client'

import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DEVICE_BATTERY_PERCENT_MAX,
  DEVICE_BATTERY_PERCENT_MIN,
} from '@/lib/activity-api-constants'
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
  const [batteryLevel, setBatteryLevel] = useState('')
  const [isCharging, setIsCharging] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const parsedPersist = Math.round(Number(persistMinutes))
      const safePersist =
        Number.isFinite(parsedPersist) && parsedPersist > 0
          ? Math.min(
              Math.max(parsedPersist, USER_ACTIVITY_PERSIST_MIN_MINUTES_UI),
              USER_ACTIVITY_PERSIST_MAX_MINUTES,
            )
          : 30

      const payload: Record<string, unknown> = {
        generatedHashKey: '',
        device,
        process_name: processName,
        process_title: processTitle || undefined,
        persist_minutes: safePersist,
        is_charging: isCharging,
      }
      const trimmedBatt = batteryLevel.trim()
      if (trimmedBatt !== '') {
        const n = Math.round(Number(trimmedBatt))
        if (Number.isFinite(n)) {
          payload.battery_level = Math.min(
            Math.max(n, DEVICE_BATTERY_PERCENT_MIN),
            DEVICE_BATTERY_PERCENT_MAX,
          )
        }
      }

      const res = await fetch('/api/admin/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (data.success) {
        toast.success('活动已添加')
        setDevice('')
        setProcessName('')
        setProcessTitle('')
        setBatteryLevel('')
        setIsCharging(false)
        onSuccess?.()
      } else {
        toast.error(data.error || '添加失败')
      }
    } catch {
      toast.error('网络错误')
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="battery-level">电量（可选，0–100）</Label>
          <Input
            id="battery-level"
            type="number"
            inputMode="numeric"
            min={DEVICE_BATTERY_PERCENT_MIN}
            max={DEVICE_BATTERY_PERCENT_MAX}
            placeholder="留空则不上报"
            value={batteryLevel}
            onChange={(e) => setBatteryLevel(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2 pb-2">
          <Checkbox
            id="is-charging"
            checked={isCharging}
            onCheckedChange={(v) => setIsCharging(v === true)}
          />
          <Label htmlFor="is-charging" className="text-sm font-normal cursor-pointer">
            充电中
          </Label>
        </div>
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

      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        添加活动
      </Button>
    </form>
  )
}
