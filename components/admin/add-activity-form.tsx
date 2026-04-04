'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Monitor } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  fetchAdminDeviceSummaries,
} from '@/components/admin/admin-query-fetchers'
import { adminQueryKeys } from '@/components/admin/admin-query-keys'
import { createAdminActivity } from '@/components/admin/admin-query-mutations'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

type DeviceOption = {
  id: number
  displayName: string
  generatedHashKey: string
  status: string
}

/** Sentinel value representing the built-in Web quick-add device (empty hash key). */
const WEB_RESERVED_HASH = '__web_reserved__'

export function AddActivityForm({ onSuccess }: AddActivityFormProps) {
  const queryClient = useQueryClient()
  const [selectedHash, setSelectedHash] = useState<string>(WEB_RESERVED_HASH)

  const [device, setDevice] = useState('')
  const [processName, setProcessName] = useState('')
  const [processTitle, setProcessTitle] = useState('')
  const [persistMinutes, setPersistMinutes] = useState('30')
  const [batteryLevel, setBatteryLevel] = useState('')
  const [isCharging, setIsCharging] = useState(false)
  const devicesQuery = useQuery({
    queryKey: adminQueryKeys.devices.list({ limit: 200, status: 'active' }),
    queryFn: () => fetchAdminDeviceSummaries({ limit: 200, status: 'active' }),
  })
  const devices: DeviceOption[] = devicesQuery.data ?? []

  const addActivityMutation = useMutation({
    mutationFn: createAdminActivity,
    onSuccess: async () => {
      toast.success('活动已添加')
      setDevice('')
      setProcessName('')
      setProcessTitle('')
      setBatteryLevel('')
      setIsCharging(false)
      setSelectedHash(WEB_RESERVED_HASH)
      onSuccess?.()
      await queryClient.invalidateQueries({ queryKey: ['admin', 'activity-history'] })
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.devices.list() })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '网络错误')
    },
  })

  // When a known device is selected, pre-fill the device name field
  const handleDeviceSelect = (hash: string) => {
    setSelectedHash(hash)
    if (hash === WEB_RESERVED_HASH) {
      setDevice('')
      return
    }
    const found = devices.find((d) => d.generatedHashKey === hash)
    if (found) setDevice(found.displayName)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const parsedPersist = Math.round(Number(persistMinutes))
      const safePersist =
        Number.isFinite(parsedPersist) && parsedPersist > 0
          ? Math.min(
              Math.max(parsedPersist, USER_ACTIVITY_PERSIST_MIN_MINUTES_UI),
              USER_ACTIVITY_PERSIST_MAX_MINUTES,
            )
          : 30

      const resolvedHash = selectedHash === WEB_RESERVED_HASH ? '' : selectedHash

      const payload: Record<string, unknown> = {
        generatedHashKey: resolvedHash,
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

      await addActivityMutation.mutateAsync(payload)
    } catch {
      // mutation handles toast
    }
  }

  const isWebReserved = selectedHash === WEB_RESERVED_HASH

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Device selector */}
      <div className="space-y-2">
        <Label htmlFor="device-select">归属设备</Label>
        <Select value={selectedHash} onValueChange={handleDeviceSelect}>
          <SelectTrigger id="device-select" className="w-full">
            <SelectValue placeholder="选择设备…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={WEB_RESERVED_HASH}>
              <span className="flex items-center gap-2">
                <Monitor className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                Web（后台快速添加）
              </span>
            </SelectItem>
            {devices.map((d) => (
              <SelectItem key={d.generatedHashKey} value={d.generatedHashKey}>
                {d.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isWebReserved && (
          <p className="text-[11px] text-muted-foreground">
            活动将以所选设备身份上报，设备名称已自动填入，可手动修改。
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="device">
            设备显示名称
            {isWebReserved && <span className="ml-1 text-muted-foreground">（可自定义）</span>}
          </Label>
          <Input
            id="device"
            placeholder={isWebReserved ? '例如：MacBook Pro' : '已从设备列表填入，可修改'}
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
            onWheel={(e) => e.currentTarget.blur()}
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
          <Label htmlFor="is-charging" className="cursor-pointer text-sm font-normal">
            充电中
          </Label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="persist">常驻时长（分钟）</Label>
        <Input
          id="persist"
          type="number"
          onWheel={(e) => e.currentTarget.blur()}
          inputMode="numeric"
          min={USER_ACTIVITY_PERSIST_MIN_MINUTES_UI}
          max={USER_ACTIVITY_PERSIST_MAX_MINUTES}
          value={persistMinutes}
          onChange={(e) => setPersistMinutes(e.target.value)}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          无客户端上报时，超过该时间后活动会从首页「当前状态」自动结束（1–1440 分钟，与站点「进程无上报判定间隔」规则一致）。
        </p>
      </div>

      <Button type="submit" disabled={addActivityMutation.isPending}>
        {addActivityMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        添加活动
      </Button>
    </form>
  )
}
