'use client'

import { ChevronRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { MarkdownContent } from '@/components/admin/markdown-content'
import { FormattedTime } from '@/components/formatted-time'
import { LexicalContent } from '@/components/lexical-content'
import { Card } from '@/components/ui/card'
import {
  inspirationLooksLikeMarkdown,
  inspirationNeedsFullPageAny,
  inspirationPlainPreviewAny,
} from '@/lib/inspiration-preview'
import { cn } from '@/lib/utils'
import type { InspirationHomeItem } from '@/types/components'

export type { InspirationHomeItem } from '@/types/components'

const PREVIEW_CHARS = 220

/** Matches site Card primitive: solid surface, clear elevation (not just rounded corners). */
const inspirationCardClassName = cn(
  'gap-0 py-0 shadow-md ring-1 ring-border/60',
  'transition-[box-shadow,border-color,ring-color] duration-200',
  'hover:shadow-lg hover:ring-primary/20 hover:border-primary/25',
)

function EntryBody({
  entry,
  detailHref,
  needFull,
  previewText,
}: {
  entry: InspirationHomeItem
  detailHref: string
  needFull: boolean
  previewText: string
}) {
  return (
    <div className="min-w-0 flex-1 flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-1.5">
        <Link
          href={detailHref}
          className="text-xs font-semibold text-foreground hover:text-primary transition-colors"
        >
          {entry.title?.trim() ? entry.title : '（无标题）'}
        </Link>
        <FormattedTime 
          date={entry.createdAt} 
          timezone={entry.displayTimezone}
          className="text-[0.65rem] text-muted-foreground tabular-nums shrink-0 leading-none"
        />
      </div>

      {entry.statusSnapshot ? (
        <div className="rounded-md border border-dashed border-border/80 bg-muted/20 px-2 py-1.5 text-[0.65rem] text-muted-foreground whitespace-pre-wrap max-h-[4.5rem] overflow-y-auto leading-snug">
          {entry.statusSnapshot}
        </div>
      ) : null}

      {needFull ? (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{previewText}</p>
          <Link
            href={detailHref}
            className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
          >
            查看全文
            <ChevronRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      ) : (
        <>
          {entry.contentLexical ? (
            inspirationLooksLikeMarkdown(entry.content) ? (
              <MarkdownContent
                markdown={entry.content}
                className="text-xs text-muted-foreground"
                imageClassName="max-h-44 w-auto rounded-md border border-border/60 my-2"
              />
            ) : (
              <LexicalContent content={entry.contentLexical} className="text-xs text-muted-foreground" />
            )
          ) : (
            <MarkdownContent
              markdown={entry.content}
              className="text-xs text-muted-foreground"
              imageClassName="max-h-44 w-auto rounded-md border border-border/60 my-2"
            />
          )}
        </>
      )}
    </div>
  )
}

export function InspirationHomeSection({
  entries,
  showArchiveLink,
}: {
  entries: InspirationHomeItem[]
  /** True when there are more entries than shown on the home page */
  showArchiveLink?: boolean
}) {
  if (entries.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 text-sm">暂无随想记录</div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {entries.map((entry) => {
          const detailHref = `/inspiration/${entry.id}`
          const needFull = inspirationNeedsFullPageAny(entry.content, entry.contentLexical, PREVIEW_CHARS)
          const { text: previewText } = inspirationPlainPreviewAny(
            entry.content,
            entry.contentLexical,
            PREVIEW_CHARS,
          )

          if (entry.imageDataUrl) {
            return (
              <article key={entry.id}>
                <Card className={cn(inspirationCardClassName, 'p-2.5 sm:p-3')}>
                  <div className="flex flex-row gap-2 sm:gap-3 items-stretch">
                    <Link
                      href={detailHref}
                      className={cn(
                        'group relative block shrink-0 self-start overflow-hidden rounded-lg',
                        'w-16 h-16 sm:w-[4.667rem] sm:h-[4.667rem]',
                        'border border-border/70 bg-card shadow-sm ring-1 ring-[color:var(--home-card-overlay)] dark:ring-[color:var(--home-card-overlay-dark)]',
                        'transition-[box-shadow,border-color,ring-color] duration-200',
                        'hover:border-primary/25 hover:shadow-md hover:ring-primary/15',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      )}
                    >
                      <Image
                        src={entry.imageDataUrl}
                        alt=""
                        fill
                        className="object-cover object-center transition-transform duration-200 group-hover:scale-[1.04]"
                        sizes="(max-width: 640px) 64px, 75px"
                      />
                    </Link>
                    <EntryBody
                      entry={entry}
                      detailHref={detailHref}
                      needFull={needFull}
                      previewText={previewText}
                    />
                  </div>
                </Card>
              </article>
            )
          }

          return (
            <article key={entry.id}>
              <Card className={cn(inspirationCardClassName, 'p-2.5 sm:p-3')}>
                <EntryBody
                  entry={entry}
                  detailHref={detailHref}
                  needFull={needFull}
                  previewText={previewText}
                />
              </Card>
            </article>
          )
        })}
      </div>

      {showArchiveLink ? (
        <div className="flex justify-center pt-1">
          <Link
            href="/inspiration"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-0.5"
          >
            查看更多随想录
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      ) : null}
    </div>
  )
}
