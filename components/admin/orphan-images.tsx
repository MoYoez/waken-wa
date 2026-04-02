'use client'

import { Loader2, RefreshCw, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { toast } from 'sonner'

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
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { OrphanAssetRow } from '@/types'

const ORPHAN_LIST_MAX_HEIGHT = 'min(75vh,56rem)'

export interface OrphanImagesHandle {
  refresh: () => void
}

function formatCreatedAt(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export const OrphanImages = forwardRef<OrphanImagesHandle, object>(function OrphanImages(_, ref) {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)
  const [rows, setRows] = useState<OrphanAssetRow[]>([])
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const eligibleKeys = useMemo(
    () => rows.filter((r) => r.eligibleForDelete).map((r) => r.publicKey),
    [rows],
  )

  const selectedKeys = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected],
  )

  const selectedEligibleKeys = useMemo(() => {
    const eligible = new Set(eligibleKeys)
    return selectedKeys.filter((k) => eligible.has(k))
  }, [selectedKeys, eligibleKeys])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/inspiration/orphan-assets')
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success || !Array.isArray(data.data)) {
        toast.error(typeof data?.error === 'string' ? data.error : '读取失败')
        return
      }
      const nextRows = data.data as OrphanAssetRow[]
      setRows(nextRows)
      setSelected((prev) => {
        const next: Record<string, boolean> = {}
        for (const r of nextRows) {
          if (prev[r.publicKey]) next[r.publicKey] = true
        }
        return next
      })
    } catch {
      toast.error('网络错误')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchRows()
  }, [fetchRows, tick])

  const toggleSelect = (key: string, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [key]: checked }))
  }

  const selectAllEligible = () => {
    setSelected((prev) => {
      const next = { ...prev }
      for (const k of eligibleKeys) next[k] = true
      return next
    })
  }

  const clearSelection = () => setSelected({})

  useImperativeHandle(ref, () => ({
    refresh: () => setTick((t) => t + 1),
  }))

  const doDelete = async (keys: string[]) => {
    if (keys.length === 0) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/inspiration/orphan-assets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKeys: keys }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        toast.error(typeof data?.error === 'string' ? data.error : '删除失败')
        return
      }
      const deleted = typeof data?.data?.deleted === 'number' ? data.data.deleted : 0
      const skipped = typeof data?.data?.skipped === 'number' ? data.data.skipped : 0
      toast.success(`已删除 ${deleted} 张，跳过 ${skipped} 张`)
      clearSelection()
      setTick((t) => t + 1)
    } catch {
      toast.error('网络错误')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-4">
          {rows.length > 0 && !loading && (
            <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || busy || eligibleKeys.length === 0}
                onClick={selectAllEligible}
              >
                全选可清理
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    disabled={loading || busy || selectedEligibleKeys.length === 0}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    清理所选（{selectedEligibleKeys.length}）
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认清理</AlertDialogTitle>
                    <AlertDialogDescription>
                      将删除 {selectedEligibleKeys.length} 张未被引用的孤儿图片，此操作不可撤销。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={busy}
                      onClick={() => {
                        void doDelete(selectedEligibleKeys)
                      }}
                    >
                      删除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
          {loading ? (
            <div className="text-sm text-muted-foreground">加载中…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无孤儿图片</div>
          ) : (
            <div
              className="rounded-md border bg-muted/10 p-3 overflow-y-auto"
              style={{ maxHeight: ORPHAN_LIST_MAX_HEIGHT }}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rows.map((r) => {
                  const checked = Boolean(selected[r.publicKey])
                  return (
                    <div
                      key={r.publicKey}
                      className={cn(
                        'rounded-lg border bg-background p-3 space-y-3',
                        checked && 'ring-1 ring-primary/40',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => toggleSelect(r.publicKey, v === true)}
                            disabled={!r.eligibleForDelete && checked === false}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-mono truncate" title={r.publicKey}>
                              {r.publicKey}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5">
                                {typeof r.ageMinutes === 'number' ? `${r.ageMinutes} 分钟前` : '时间未知'}
                              </span>
                              <span
                                className={cn(
                                  'rounded-full border px-2 py-0.5',
                                  r.eligibleForDelete
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                    : 'border-border/60 bg-muted/30',
                                )}
                              >
                                {r.eligibleForDelete ? '可删除' : '不可删除'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              disabled={busy || !r.eligibleForDelete}
                              title={r.eligibleForDelete ? '删除' : '当前不可删除'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>确认删除</AlertDialogTitle>
                              <AlertDialogDescription>
                                将删除该未被引用的孤儿图片。此操作不可撤销。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
                              <AlertDialogAction
                                disabled={busy}
                                onClick={() => {
                                  void doDelete([r.publicKey])
                                }}
                              >
                                删除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>

                      <a href={r.url} target="_blank" rel="noreferrer" className="block">
                        <Image
                          src={r.url}
                          alt={r.publicKey}
                          width={640}
                          height={160}
                          className="w-full h-40 object-contain rounded-md border bg-muted/10"
                          loading="lazy"
                        />
                      </a>

                      <div className="rounded-md border border-border/60 bg-muted/10 px-2.5 py-2 text-[11px] text-muted-foreground">
                        <div className="font-medium text-foreground/80">创建时间</div>
                        <div className="mt-1 break-all">{formatCreatedAt(r.createdAt)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
})
