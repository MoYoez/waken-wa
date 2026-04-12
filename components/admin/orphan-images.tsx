'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImageOff, Loader2, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  fetchAdminInspirationOrphanAssets,
} from '@/components/admin/admin-query-fetchers'
import { adminQueryKeys } from '@/components/admin/admin-query-keys'
import { deleteAdminInspirationOrphanAssets } from '@/components/admin/admin-query-mutations'
import { FormattedTime } from '@/components/formatted-time'
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

export const OrphanImages = forwardRef<OrphanImagesHandle, object>(function OrphanImages(_, ref) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const rowsQuery = useQuery({
    queryKey: adminQueryKeys.inspiration.orphanAssets(),
    queryFn: fetchAdminInspirationOrphanAssets,
  })
  const rows = useMemo<OrphanAssetRow[]>(
    () => rowsQuery.data ?? [],
    [rowsQuery.data],
  )

  const deleteOrphansMutation = useMutation({
    mutationFn: deleteAdminInspirationOrphanAssets,
    onSuccess: async ({ deleted, skipped }) => {
      toast.success(`已删除 ${deleted} 张，跳过 ${skipped} 张`)
      clearSelection()
      await queryClient.invalidateQueries({
        queryKey: adminQueryKeys.inspiration.orphanAssets(),
      })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '网络错误')
    },
  })

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
    refresh: () => {
      void queryClient.invalidateQueries({
        queryKey: adminQueryKeys.inspiration.orphanAssets(),
      })
    },
  }))

  const doDelete = async (keys: string[]) => {
    if (keys.length === 0) return
    await deleteOrphansMutation.mutateAsync(keys)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          {rows.length > 0 && !rowsQuery.isLoading && (
            <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={rowsQuery.isLoading || deleteOrphansMutation.isPending || eligibleKeys.length === 0}
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
                    disabled={rowsQuery.isLoading || deleteOrphansMutation.isPending || selectedEligibleKeys.length === 0}
                  >
                    {deleteOrphansMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
                    <AlertDialogCancel disabled={deleteOrphansMutation.isPending}>取消</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={deleteOrphansMutation.isPending}
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
          {rowsQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">加载中…</div>
          ) : rows.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 bg-muted/10 px-4 py-8">
              <div className="flex flex-col items-center justify-center gap-2 text-center">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground">
                  <ImageOff className="h-4 w-4" />
                </span>
                <p className="text-sm font-medium text-foreground/85">暂无孤儿图片</p>
                <p className="text-xs text-muted-foreground">
                  当前素材都已被灵感正文或封面引用。
                </p>
              </div>
            </div>
          ) : (
            <div
              className="overflow-y-auto rounded-md border border-border/60 bg-background/60 p-3"
              style={{ maxHeight: ORPHAN_LIST_MAX_HEIGHT }}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rows.map((r) => {
                  const checked = Boolean(selected[r.publicKey])
                  return (
                    <div
                      key={r.publicKey}
                      className={cn(
                        'space-y-2.5 rounded-md border border-border/50 bg-muted/[0.04] p-2.5 transition-colors',
                        checked && 'border-primary/40 bg-primary/[0.04]',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex min-w-0 flex-1 items-start gap-2">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => toggleSelect(r.publicKey, v === true)}
                            disabled={!r.eligibleForDelete && checked === false}
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="break-all text-[11px] font-mono leading-relaxed text-foreground/85" title={r.publicKey}>
                              {r.publicKey}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span className="rounded-full border border-border/50 bg-background/80 px-2 py-0.5">
                                {typeof r.ageMinutes === 'number' ? `${r.ageMinutes} 分钟前` : '时间未知'}
                              </span>
                              <span
                                className={cn(
                                  'rounded-full border px-2 py-0.5',
                                  r.eligibleForDelete
                                    ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-700/90 dark:text-emerald-300'
                                    : 'border-border/50 bg-background/80',
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
                              variant="ghost"
                              size="sm"
                              className="h-7 shrink-0 px-2 text-muted-foreground hover:text-destructive"
                              disabled={deleteOrphansMutation.isPending || !r.eligibleForDelete}
                              title={r.eligibleForDelete ? '删除' : '当前不可删除'}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
                              <AlertDialogCancel disabled={deleteOrphansMutation.isPending}>取消</AlertDialogCancel>
                              <AlertDialogAction
                                disabled={deleteOrphansMutation.isPending}
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
                          className="h-32 w-full rounded-md border border-border/50 bg-muted/5 object-contain"
                          loading="eager"
                        />
                      </a>

                      <div className="rounded-md border border-border/50 bg-background/70 px-2.5 py-2 text-[11px] text-muted-foreground">
                        <div className="font-medium text-foreground/75">创建时间</div>
                        <div className="mt-1 break-all">
                          <FormattedTime
                            date={r.createdAt}
                            pattern="yyyy-MM-dd HH:mm:ss"
                            fallback="—"
                          />
                        </div>
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
