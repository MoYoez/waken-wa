'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { ImageCropDialog } from '@/components/admin/image-crop-dialog'
import { MarkdownContent } from '@/components/admin/markdown-content'

interface InspirationEntry {
  id: number
  title: string | null
  content: string
  imageDataUrl: string | null
  statusSnapshot: string | null
  createdAt: string
}

const LIMIT = 20
/** Max long edge (px) for cropped PNG DataURL (cover + inline body images). */
const INSPIRATION_MAX_OUTPUT_EDGE = 1200

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
  const [attachCurrentStatus, setAttachCurrentStatus] = useState(false)

  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [cropTarget, setCropTarget] = useState<'cover' | 'body'>('cover')
  const bodyImageInputRef = useRef<HTMLInputElement>(null)

  const totalPages = useMemo(() => Math.ceil(total / LIMIT), [total])

  useEffect(() => {
    return () => {
      if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl)
    }
  }, [cropSourceUrl])

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

  const openCropForFile = (file: File | undefined, target: 'cover' | 'body') => {
    if (!file) return
    setMessage('')
    setCropTarget(target)
    if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl)
    const objectUrl = URL.createObjectURL(file)
    setCropSourceUrl(objectUrl)
    setCropDialogOpen(true)
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
          attachCurrentStatus,
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
      setAttachCurrentStatus(false)
      setMessage('提交成功')
      setPage(0)
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
                正文支持 Markdown 与内联图片；封面图与正文配图均在弹窗中自由比例裁剪，导出 PNG DataURL
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
                <Label htmlFor="insp-file">图片（可选，裁剪后写入）</Label>
                <Input
                  id="insp-file"
                  type="file"
                  accept="image/*"
                  onChange={(e) => openCropForFile(e.target.files?.[0], 'cover')}
                />
                <p className="text-xs text-muted-foreground">
                  长边上限约 {INSPIRATION_MAX_OUTPUT_EDGE}px，比例可任意调整
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="insp-attach-status"
                type="checkbox"
                checked={attachCurrentStatus}
                onChange={(e) => setAttachCurrentStatus(e.target.checked)}
                className="rounded border-input"
              />
              <Label htmlFor="insp-attach-status" className="font-normal text-sm cursor-pointer">
                附上提交时首页「当前」状态快照（仅管理员提交有效）
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="insp-content">正文（Markdown，必填）</Label>
              <Tabs defaultValue="edit" className="w-full">
                <TabsList className="mb-2">
                  <TabsTrigger value="edit">编辑</TabsTrigger>
                  <TabsTrigger value="preview">预览</TabsTrigger>
                </TabsList>
                <TabsContent value="edit" className="mt-0 space-y-2">
                  <input
                    ref={bodyImageInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      openCropForFile(e.target.files?.[0], 'body')
                      e.target.value = ''
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => bodyImageInputRef.current?.click()}
                  >
                    <ImagePlus className="h-4 w-4 mr-1" />
                    插入正文配图
                  </Button>
                  <Textarea
                    id="insp-content"
                    rows={12}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={'支持 Markdown，例如：\n\n## 小标题\n\n- 列表项\n\n**粗体** 与 `代码`'}
                    className="font-mono text-sm min-h-[220px]"
                  />
                </TabsContent>
                <TabsContent value="preview" className="mt-0">
                  <div className="rounded-md border border-border bg-muted/20 p-3 min-h-[220px] max-h-[360px] overflow-y-auto">
                    {content.trim() ? (
                      <MarkdownContent markdown={content} imageClassName="max-h-72 w-auto rounded-md border border-border my-2" />
                    ) : (
                      <p className="text-sm text-muted-foreground">暂无内容</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {imageDataUrl.trim() ? (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-2">图片预览</p>
                <img
                  src={imageDataUrl.trim()}
                  alt="inspiration preview"
                  className="max-h-56 w-auto rounded-md border bg-background"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setImageDataUrl('')}
                >
                  移除图片
                </Button>
              </div>
            ) : null}

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
                  setAttachCurrentStatus(false)
                  setMessage('')
                }}
              >
                清空
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
        aspectMode="free"
        outputSize={INSPIRATION_MAX_OUTPUT_EDGE}
        title={cropTarget === 'body' ? '裁剪正文配图' : '裁剪封面配图'}
        description="拖动图片平移，滑块缩放，拖角点调整裁剪框；确认后导出 PNG。"
        onComplete={(dataUrl) => {
          if (cropTarget === 'body') {
            setContent((c) => {
              const line = c.trim().length > 0 ? '\n\n' : ''
              return `${c}${line}![](${dataUrl})`
            })
          } else {
            setImageDataUrl(dataUrl)
          }
        }}
      />

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">API 提交（可从脚本/设备直接上报）</h3>
          <p className="text-sm text-muted-foreground">
            使用与「活动上报」相同的 `API Token`（在管理后台 -&gt; API Token 查看/复制）。字段 `content` 为
            Markdown 字符串；`imageDataUrl` 可选，可为 PNG/JPEG 等 DataURL。
          </p>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
            {`curl -X POST /api/inspiration/entries \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"可选","content":"# Markdown 正文\\\\n\\\\n支持 **加粗**。","imageDataUrl":null}'`}
          </pre>
        </CardContent>
      </Card>

      <div className="mt-8 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">搜索记录</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px] space-y-2">
            <Label htmlFor="insp-search">关键字</Label>
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
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-foreground truncate max-w-[420px]">
                          {entry.title ? entry.title : '（无标题）'}
                        </h4>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(entry.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                        </span>
                      </div>
                      {entry.statusSnapshot ? (
                        <div className="mt-2 rounded-md border border-dashed border-border/70 bg-muted/15 px-2 py-1.5 text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {entry.statusSnapshot}
                        </div>
                      ) : null}
                      <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-border/60 bg-background/50 p-2">
                        <MarkdownContent
                          markdown={entry.content}
                          className="text-muted-foreground"
                          imageClassName="max-h-56 w-auto rounded-md border border-border my-2"
                        />
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        >
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
