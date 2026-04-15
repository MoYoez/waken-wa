'use client'

import { ChevronRight } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { useT } from 'next-i18next/client'

import { FormattedTime } from '@/components/formatted-time'
import {
  getSiteSectionTransition,
  getSiteSectionVariants,
} from '@/components/site-motion'
import { Card } from '@/components/ui/card'
import {
  extractInspirationLeadImage,
  inspirationPlainPreview,
  inspirationPlainPreviewAny,
} from '@/lib/inspiration-preview'
import { cn } from '@/lib/utils'
import type { InspirationHomeItem } from '@/types/components'

export type { InspirationHomeItem } from '@/types/components'

/** Matches site Card primitive: solid surface, clear elevation (not just rounded corners). */
const inspirationCardClassName = cn(
  'home-glass-card gap-0 border-t-0 border-r-0 py-0 shadow-md',
  'transition-[box-shadow,border-color] duration-200',
  'hover:shadow-lg hover:border-primary/25',
)

function EntryBody({
  detailHref,
  previewText,
  statusText,
  title,
  createdAt,
  displayTimezone,
}: {
  detailHref: string
  previewText: string
  statusText: string
  title: string | null
  createdAt: string
  displayTimezone?: string
}) {
  const { t } = useT('common')

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col gap-2">
      <div className="flex min-h-4 items-baseline justify-between gap-1.5">
        <Link
          href={detailHref}
          className="min-w-0 truncate text-xs font-semibold text-foreground transition-colors hover:text-primary"
        >
          {title?.trim() ? title : t('site.inspiration.untitled')}
        </Link>
        <FormattedTime
          date={createdAt}
          timezone={displayTimezone}
          className="text-[0.65rem] text-muted-foreground tabular-nums shrink-0 leading-none"
        />
      </div>

      <div className="space-y-1">
        {statusText ? (
          <div className="rounded-md border border-dashed border-border/80 bg-muted/20 px-2 py-1 text-[0.65rem] leading-snug text-muted-foreground line-clamp-1">
            {statusText}
          </div>
        ) : null}
        <p
          className={cn(
            'text-xs leading-relaxed text-muted-foreground',
            statusText ? 'min-h-5 line-clamp-1' : 'min-h-10 line-clamp-2',
          )}
        >
          {previewText || t('site.inspiration.viewFull')}
        </p>
        <Link
          href={detailHref}
          className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
        >
          {t('site.inspiration.viewFull')}
          <ChevronRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
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
            const inlineLead = !entry.imageDataUrl ? extractInspirationLeadImage(entry.content) : null
            const cardImageSrc = entry.imageDataUrl ?? inlineLead?.imageSrc ?? null
            const preview = inlineLead?.imageSrc
              ? inspirationPlainPreview(inlineLead.contentWithoutImage, 96).text
              : inspirationPlainPreviewAny(entry.content, entry.contentLexical, 96).text
            const statusText = String(entry.statusSnapshot ?? '').trim()

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
                <Card className={cn(inspirationCardClassName, 'h-[7.75rem] overflow-hidden p-2.5 sm:p-3')}>
                  <div
                    className={cn(
                      'flex h-full items-stretch gap-2 sm:gap-3',
                      cardImageSrc ? 'flex-row' : 'flex-col',
                    )}
                  >
                    {cardImageSrc ? (
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
                          src={cardImageSrc}
                          alt=""
                          fill
                          loading="eager"
                          className="object-cover object-center transition-transform duration-200 group-hover:scale-[1.04]"
                          sizes="(max-width: 640px) 64px, 75px"
                        />
                      </Link>
                    ) : null}
                    <EntryBody
                      detailHref={detailHref}
                      previewText={preview}
                      statusText={statusText}
                      title={entry.title}
                      createdAt={entry.createdAt}
                      displayTimezone={entry.displayTimezone}
                    />
                  </div>
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
