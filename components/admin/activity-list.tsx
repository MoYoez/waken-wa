'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Search, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Skeleton } from '@/components/ui/skeleton'

interface ActivityLog {
  id: number
  generatedHashKey: string
  device: string
  processName: string
  processTitle: string | null
  startedAt: string
  endedAt: string | null
  createdAt: string
}

export function ActivityList() {
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const limit = 20

  const fetchActivities = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      })
      if (search) {
        params.set('search', search)
      }
      
      const res = await fetch(`/api/admin/activity?${params}`)
      const data = await res.json()
      
      if (data.success) {
        setActivities(data.data)
        setTotal(data.pagination.total)
      }
    } catch {
      // 忽略
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/activity?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        fetchActivities()
      }
    } catch {
      // 忽略
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(0)
    fetchActivities()
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">搜索活动</h3>
        <div className="flex flex-wrap items-start gap-4">
          <form onSubmit={handleSearch} className="flex flex-1 min-w-[240px] flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px] max-w-sm space-y-2">
              <label htmlFor="activity-search" className="text-sm font-medium text-foreground">
                关键字
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="activity-search"
                  placeholder="搜索进程名或标题..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  aria-label="按进程名或标题搜索活动"
                />
              </div>
            </div>
            <Button type="submit" variant="secondary" className="shrink-0">
              搜索
            </Button>
          </form>
          <Button variant="outline" size="icon" onClick={fetchActivities} className="shrink-0" aria-label="刷新列表">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 表格 */}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>设备</TableHead>
              <TableHead className="hidden lg:table-cell">HashKey</TableHead>
              <TableHead>进程</TableHead>
              <TableHead className="hidden md:table-cell">标题</TableHead>
              <TableHead>时间</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : activities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  暂无活动记录
                </TableCell>
              </TableRow>
            ) : (
              activities.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell className="font-medium">{activity.device}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs font-mono text-muted-foreground">
                    {activity.generatedHashKey?.slice(0, 10) || '-'}
                  </TableCell>
                  <TableCell>{activity.processName}</TableCell>
                  <TableCell className="hidden md:table-cell max-w-xs truncate text-muted-foreground">
                    {activity.processTitle || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(activity.startedAt), 'MM/dd HH:mm', { locale: zhCN })}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除</AlertDialogTitle>
                          <AlertDialogDescription>
                            确定要删除这条活动记录吗？此操作无法撤销。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(activity.id)}>
                            删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            共 {total} 条记录
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
