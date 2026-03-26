'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface InspirationEntry {
  id: number
  title: string | null
  content: string
  imageDataUrl: string | null
  createdAt: string
}

const LIMIT = 20

function contentPreview(text: string, maxLen: number) {
  const t = text || ''
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen)}...`
}

export function InspirationManager() {
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<InspirationEntry[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageDataUrl, setImageDataUrl] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string>('')

  const totalPages = useMemo(() => Math.ceil(total / LIMIT), [total])

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(page * LIMIT),
      })
      if (q.trim()) params.set('q', q.trim())

      const res = await fetch(`/api/inspiration/entries?${params}`)
      const data = await res.json()
      if (data.success) {
        setEntries(data.data || [])
        setTotal(data.pagination?.total || 0)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [page, q])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const handleFileToDataUrl = async (file?: File) => {
    if (!file) return
    setMessage('')

    const reader = new FileReader()
    const result = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(new Error('read file failed'))
      reader.readAsDataURL(file)
    })

    setImageDataUrl(result)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage('')

    try {
      const res = await fetch('/api/inspiration/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || undefined,
          content: content.trim(),
          imageDataUrl: imageDataUrl.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data?.success) {
        setMessage(data?.error || '提交失败')
        return
      }

      setTitle('')
      setContent('')
      setImageDataUrl('')
      setMessage('提交成功')
      setPage(0)
      // After submitting, go back to page 1 and refresh
      setTimeout(() => void fetchEntries(), 0)
    } catch {
      setMessage('网络错误，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/inspiration/entries?id=${id}`, { method: 'DELETE' })
      // After deletion, refresh the list
      setTimeout(() => void fetchEntries(), 0)
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">灵感随想录</h3>
              <p className="text-sm text-muted-foreground">
                支持 `dataURL` 方式提交图片，并自动写入数据库
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="insp-title">标题（可选）</Label>
                <Input
                  id="insp-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：某次灵感 / 片段标题"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="insp-file">图片（可选，自动转 dataURL）</Label>
                <Input
                  id="insp-file"
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleFileToDataUrl(e.target.files?.[0])}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="insp-content">正文（必填）</Label>
              <Textarea
                id="insp-content"
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="把灵感随手记下来：可以是文字、短句、或你希望保留的想法。"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="insp-dataurl">图片 dataURL（可选，可直接粘贴）</Label>
              <Textarea
                id="insp-dataurl"
                rows={3}
                value={imageDataUrl}
                onChange={(e) => setImageDataUrl(e.target.value)}
                placeholder="例如：data:image/png;base64,iVBORw0KGgo..."
              />
              {imageDataUrl.trim() ? (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground mb-2">预览</p>
                  <img
                    src={imageDataUrl.trim()}
                    alt="inspiration preview"
                    className="max-h-56 w-auto rounded-md border bg-background"
                  />
                </div>
              ) : null}
            </div>

            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

            <div className="flex items-center gap-3 flex-wrap">
              <Button type="submit" disabled={submitting || !content.trim()}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    提交中...
                  </>
                ) : (
                  '提交灵感'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => {
                  setTitle('')
                  setContent('')
                  setImageDataUrl('')
                  setMessage('')
                }}
              >
                清空
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">API 提交（可从脚本/设备直接上报）</h3>
          <p className="text-sm text-muted-foreground">
            使用与“活动上报”相同的 `API Token`（在管理后台 -> API Token 查看/复制）
          </p>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
{`curl -X POST /api/inspiration/entries \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "可选标题",
    "content": "你的灵感正文",
    "imageDataUrl": "data:image/png;base64,iVBORw0K..."
  }'`}
          </pre>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <Label htmlFor="insp-search">搜索</Label>
          <Input
            id="insp-search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(0)
            }}
            placeholder="按标题或正文关键字过滤"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-52" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">暂无灵感记录</div>
          ) : (
            <div className="divide-y">
              {entries.map((entry) => (
                <div key={entry.id} className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-foreground truncate max-w-[420px]">
                          {entry.title ? entry.title : '（无标题）'}
                        </h4>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(entry.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                        {contentPreview(entry.content, 180)}
                      </p>
                    </div>
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
                            确定要删除这条灵感吗？此操作无法撤销。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(entry.id)}>
                            删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {entry.imageDataUrl ? (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <img
                        src={entry.imageDataUrl}
                        alt="inspiration"
                        className="max-h-64 w-auto rounded-md border bg-background"
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">共 {total} 条记录</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
              上一页
            </Button>
            <span className="text-sm text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
            >
              下一页
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

