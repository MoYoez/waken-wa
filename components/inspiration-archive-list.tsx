'use client'

import { Loader2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { useT } from 'next-i18next/client'
import { useCallback, useEffect, useRef, useState } from 'react'

import { FormattedTime } from '@/components/formatted-time'
import type { InspirationHomeItem } from '@/components/inspiration-home-section'
import {
  getSiteSectionTransition,
  getSiteSectionVariants,
} from '@/components/site-motion'
import {
  extractInspirationLeadImage,
  inspirationPlainPreview,
  inspirationPlainPreviewAny,
} from '@/lib/inspiration-preview'
import { normalizeTimezone } from '@/lib/timezone'
import { cn } from '@/lib/utils'

const PAGE = 10

const cardShell =
  'border border-border rounded-lg shadow-sm bg-card/80 backdrop-blur-sm transition-all hover:shadow-md hover:border-primary/20'

export function InspirationArchiveList({ displayTimezone }: { displayTimezone: string }) {
  const { t } = useT('common')
  const prefersReducedMotion = Boolean(useReducedMotion())
  const [items, setItems] = useState<InspirationHomeItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [initialDone, setInitialDone] = useState(false)
  const [reachedEnd, setReachedEnd] = useState(false)
  const [activeTimezone, setActiveTimezone] = useState(() => normalizeTimezone(displayTimezone))

  const itemsRef = useRef<InspirationHomeItem[]>([])
  const totalRef = useRef(0)
  const loadingLock = useRef(false)
  const doneRef = useRef(false)
  const sectionTransition = getSiteSectionTransition(prefersReducedMotion)
  const sectionVariants = getSiteSectionVariants(prefersReducedMotion, {
    enterY: 12,
    exitY: 8,
    scale: 0.996,
  })

  itemsRef.current = items
  totalRef.current = total

  const loadNext = useCallback(async () => {
    if (loadingLock.current) return
    if (doneRef.current) return
    const len = itemsRef.current.length
    const t = totalRef.current
    if (t > 0 && len >= t) {
      doneRef.current = true
      if (len > 0) setReachedEnd(true)
      return
    }

    loadingLock.current = true
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(len) })
      const res = await fetch(`/api/inspiration/entries?${params}`)
      const data = await res.json()
      if (!data?.success) {
        doneRef.current = true
        if (len > 0) setReachedEnd(true)
        return
      }

      const normalizedTz = normalizeTimezone(data.displayTimezone ?? activeTimezone)
      setActiveTimezone(normalizedTz)
      const batch: InspirationHomeItem[] = (data.data || []).map(
        (row: { createdAt: string | Date; [k: string]: unknown }) => ({
          ...row,
          createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(row.createdAt).toISOString(),
          displayTimezone: normalizedTz,
        })
      )
      const nextTotal = data.pagination?.total ?? 0
      setTotal(nextTotal)

      if (batch.length === 0) {
        doneRef.current = true
        if (len > 0) setReachedEnd(true)
        return
      }

      setItems((prev) => {
        const merged = [...prev, ...batch]
        if (nextTotal > 0 && merged.length >= nextTotal) doneRef.current = true
        return merged
      })
    } finally {
      loadingLock.current = false
      setLoading(false)
      setInitialDone(true)
    }
  }, [activeTimezone])

  useEffect(() => {
    void loadNext()
  }, [loadNext])

  useEffect(() => {
    if (!initialDone || loading) return
    if (items.length === 0 || total <= 0) return
    if (items.length >= total) setReachedEnd(true)
  }, [initialDone, loading, items.length, total])

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadNext()
      },
      { rootMargin: '160px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadNext])

  if (!initialDone && items.length === 0 && loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-label={t('site.loading.ariaLabel')} />
      </div>
    )
  }

  if (initialDone && items.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-12">{t('site.inspiration.noEntries')}</p>
  }

  return (
    <div className="space-y-3">
      <motion.div layout className="space-y-3">
        <AnimatePresence initial={false}>
          {items.map((entry) => {
            const href = `/inspiration/${entry.id}`
            const inlineLead = !entry.imageDataUrl ? extractInspirationLeadImage(entry.content) : null
            const cardImageSrc = entry.imageDataUrl ?? inlineLead?.imageSrc ?? null
            const preview = inlineLead?.imageSrc
              ? inspirationPlainPreview(inlineLead.contentWithoutImage, 120).text
              : inspirationPlainPreviewAny(entry.content, entry.contentLexical, 120).text
            const statusText = String(entry.statusSnapshot ?? '').trim()

            return (
              <motion.article
                key={entry.id}
                className={`${cardShell} h-[7.75rem] overflow-hidden p-2.5 sm:p-3`}
                variants={sectionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={sectionTransition}
                layout
              >
                <div className={cn('flex h-full items-stretch gap-2 sm:gap-3', cardImageSrc ? 'flex-row' : 'flex-col')}>
                  {cardImageSrc ? (
                    <Link
                      href={href}
                      className={cn(
                        'group relative block shrink-0 self-start overflow-hidden rounded-lg',
                        'w-14 h-14 sm:w-16 sm:h-16',
                        'border border-border/70 bg-card shadow-sm ring-1 ring-[color:var(--home-card-overlay)] dark:ring-[color:var(--home-card-overlay-dark)]',
                        'transition-[box-shadow,border-color,ring-color] duration-200',
                        'hover:border-primary/25 hover:shadow-md hover:ring-primary/15',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      )}
                    >
                      <Image
                        src={cardImageSrc}
                        alt=""
                        fill
                        loading="eager"
                        className="object-cover object-center transition-transform duration-200 group-hover:scale-[1.04]"
                        sizes="(max-width: 640px) 56px, 64px"
                      />
                    </Link>
                  ) : null}
                  <div className="flex h-full min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex min-h-4 items-baseline justify-between gap-1.5">
                      <Link href={href} className="min-w-0 truncate text-xs font-semibold transition-colors hover:text-primary">
                        {entry.title?.trim() ? entry.title : t('site.inspiration.untitled')}
                      </Link>
                      <FormattedTime
                        date={entry.createdAt}
                        timezone={entry.displayTimezone ?? activeTimezone}
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
                        {preview || t('site.inspiration.openFull')}
                      </p>
                    </div>
                    <Link href={href} className="text-xs font-medium text-primary hover:underline w-fit">
                      {t('site.inspiration.openFull')}
                    </Link>
                  </div>
                </div>
              </motion.article>
            )
          })}
        </AnimatePresence>
      </motion.div>

      <div ref={sentinelRef} className="h-4 w-full shrink-0" aria-hidden />

      <AnimatePresence initial={false}>
        {loading ? (
          <motion.div
            className="flex justify-center py-4 text-muted-foreground"
            variants={sectionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={sectionTransition}
          >
            <Loader2 className="h-6 w-6 animate-spin" aria-label={t('site.loading.moreAriaLabel')} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {reachedEnd ? (
          <motion.p
            className="text-center text-xs text-muted-foreground pt-2 pb-1"
            role="status"
            variants={sectionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={sectionTransition}
          >
            {t('site.inspiration.reachedEnd')}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
