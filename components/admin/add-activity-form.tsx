'use client'

import { useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AddActivityFormProps {
  onSuccess?: () => void
}

export function AddActivityForm({ onSuccess }: AddActivityFormProps) {
  const [generatedHashKey, setGeneratedHashKey] = useState('')
  const [device, setDevice] = useState('')
  const [processName, setProcessName] = useState('')
  const [processTitle, setProcessTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/admin/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generatedHashKey: generatedHashKey.trim(),
          device,
          process_name: processName,
          process_title: processTitle || undefined,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setMessage({ type: 'success', text: '活动已添加' })
        setGeneratedHashKey('')
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
      <div className="space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px] space-y-2">
            <Label htmlFor="hashKey">GeneratedHashKey（Web 可不填）</Label>
            <Input
              id="hashKey"
              placeholder="留空则使用后台 Web 预留设备"
              value={generatedHashKey}
              onChange={(e) => setGeneratedHashKey(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              const bytes = new Uint8Array(32)
              crypto.getRandomValues(bytes)
              const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
              setGeneratedHashKey(hex)
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            生成随机 Key
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          留空时活动会记到 Web 预留设备。若填写 Key，须与「设备管理」中已启用设备的 Key 一致；生成后可在设备管理中用该 Key 新增设备。
        </p>
      </div>
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
