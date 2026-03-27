'use client'

import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { MarkdownContent } from '@/components/admin/markdown-content'

export type InspirationHomeItem = {
  id: number
  title: string | null
  content: string
  imageDataUrl: string | null
  statusSnapshot: string | null
  createdAt: string
}

export function InspirationHomeSection({ entries }: { entries: InspirationHomeItem[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 text-sm">暂无随想记录</div>
    )
  }

  return (
    <div className="space-y-5">
      {entries.map((entry) => (
        <article
          key={entry.id}
          className="border border-border rounded-sm p-4 bg-card/80 backdrop-blur-sm hover:border-foreground/20 transition-colors space-y-3"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium text-foreground">
              {entry.title?.trim() ? entry.title : '（无标题）'}
            </h3>
            <time className="text-xs text-muted-foreground tabular-nums">
              {format(new Date(entry.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
            </time>
          </div>
          {entry.statusSnapshot ? (
            <div className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap">
              {entry.statusSnapshot}
            </div>
          ) : null}
          <MarkdownContent
            markdown={entry.content}
            className="text-sm text-muted-foreground"
            imageClassName="max-h-80 w-auto rounded-md border border-border/60 my-3"
          />
          {entry.imageDataUrl ? (
            <img
              src={entry.imageDataUrl}
              alt=""
              className="max-h-72 w-auto rounded-md border border-border"
            />
          ) : null}
        </article>
      ))}
    </div>
  )
}
