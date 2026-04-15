'use client'

import { ChevronRight } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { useT } from 'next-i18next/client'

import { MarkdownContent } from '@/components/admin/markdown-content'
import { FormattedTime } from '@/components/formatted-time'
import { LexicalContent } from '@/components/lexical-content'
import {
  getSiteSectionTransition,
  getSiteSectionVariants,
} from '@/components/site-motion'
import { Card } from '@/components/ui/card'
import {
  inspirationLooksLikeMarkdown,
  inspirationNeedsFullPageAny,
} from '@/lib/inspiration-preview'
import { cn } from '@/lib/utils'
import type { InspirationHomeItem } from '@/types/components'

export type { InspirationHomeItem } from '@/types/components'

const PREVIEW_CHARS = 220

/** Matches site Card primitive: solid surface, clear elevation (not just rounded corners). */
const inspirationCardClassName = cn(
  'home-glass-card gap-0 border-t-0 border-r-0 py-0 shadow-md',
  'transition-[box-shadow,border-color] duration-200',
  'hover:shadow-lg hover:border-primary/25',
)

function EntryBody({
  entry,
  detailHref,
  needFull,
}: {
  entry: InspirationHomeItem
  detailHref: string
  needFull: boolean
}) {
  const { t } = useT('common')
  const renderedContent = entry.contentLexical ? (
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
  )

  return (
    <div className="min-w-0 flex-1 flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-1.5">
        <Link
          href={detailHref}
          className="text-xs font-semibold text-foreground hover:text-primary transition-colors"
        >
          {entry.title?.trim() ? entry.title : t('site.inspiration.untitled')}
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
          <div className="relative max-h-24 overflow-hidden">
            {renderedContent}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
          </div>
          <Link
            href={detailHref}
            className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
          >
            {t('site.inspiration.viewFull')}
            <ChevronRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      ) : (
        renderedContent
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
  const { t } = useT('common')
  const prefersReducedMotion = Boolean(useReducedMotion())
  const sectionTransition = getSiteSectionTransition(prefersReducedMotion)
  const sectionVariants = getSiteSectionVariants(prefersReducedMotion, {
    enterY: 12,
    exitY: 8,
    scale: 0.996,
  })

  if (entries.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 text-sm">{t('site.inspiration.noEntries')}</div>
    )
  }

  return (
    <div className="space-y-4">
      <motion.div className="space-y-3" layout>
        <AnimatePresence initial={false}>
          {entries.map((entry) => {
          const detailHref = `/inspiration/${entry.id}`
          const needFull = inspirationNeedsFullPageAny(entry.content, entry.contentLexical, PREVIEW_CHARS)

          if (entry.imageDataUrl) {
            return (
              <motion.article
                key={entry.id}
                variants={sectionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={sectionTransition}
                layout
              >
                <Card className={cn(inspirationCardClassName, 'p-2.5 sm:p-3')}>
                  <div className="flex flex-row gap-2 sm:gap-3 items-stretch">
                    <Link
                      href={detailHref}
                      className={cn(
                        'group relative block shrink-0 self-start overflow-hidden rounded-lg',
                        'w-16 h-16 sm:w-[4.667rem] sm:h-[4.667rem]',
                        'border border-t-0 border-r-0 border-border/70 bg-card shadow-sm',
                        'transition-[box-shadow,border-color] duration-200',
                        'hover:border-primary/25 hover:shadow-md',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      )}
                    >
                      <Image
                        src={entry.imageDataUrl}
                        alt=""
                        fill
                        loading="eager"
                        className="object-cover object-center transition-transform duration-200 group-hover:scale-[1.04]"
                        sizes="(max-width: 640px) 64px, 75px"
                      />
                    </Link>
                    <EntryBody
                      entry={entry}
                      detailHref={detailHref}
                      needFull={needFull}
                    />
                  </div>
                </Card>
              </motion.article>
            )
          }

          return (
            <motion.article
              key={entry.id}
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={sectionTransition}
              layout
            >
              <Card className={cn(inspirationCardClassName, 'p-2.5 sm:p-3')}>
                <EntryBody
                  entry={entry}
                  detailHref={detailHref}
                  needFull={needFull}
                />
              </Card>
            </motion.article>
          )
          })}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence initial={false}>
        {showArchiveLink ? (
          <motion.div
            className="flex justify-center pt-1"
            variants={sectionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={sectionTransition}
          >
            <Link
              href="/inspiration"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-0.5"
            >
              {t('site.inspiration.viewMore')}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
