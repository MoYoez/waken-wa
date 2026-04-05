'use client'

import { Loader2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { MarkdownContent } from '@/components/admin/markdown-content'
import type { InspirationHomeItem } from '@/components/inspiration-home-section'
import { LexicalContent } from '@/components/lexical-content'
import {
  getSiteSectionTransition,
  getSiteSectionVariants,
} from '@/components/site-motion'
import { inspirationLooksLikeMarkdown } from '@/lib/inspiration-preview'
import { formatDateTimeShort, normalizeTimezone } from '@/lib/timezone'
import { cn } from '@/lib/utils'

const PAGE = 10

const cardShell =
  'border border-border rounded-lg shadow-sm bg-card/80 backdrop-blur-sm transition-all hover:shadow-md hover:border-primary/20'

export function InspirationArchiveList({ displayTimezone }: { displayTimezone: string }) {
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
        <Loader2 className="h-8 w-8 animate-spin" aria-label="Loading" />
      </div>
    )
  }

  if (initialDone && items.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-12">暂无随想记录</p>
  }

  return (
    <div className="space-y-3">
      <motion.div layout className="space-y-3">
        <AnimatePresence initial={false}>
          {items.map((entry) => {
            const href = `/inspiration/${entry.id}`
            const renderedContent = entry.contentLexical ? (
              inspirationLooksLikeMarkdown(entry.content) ? (
                <MarkdownContent
                  markdown={entry.content}
                  className="text-xs text-muted-foreground"
                  imageClassName="max-h-40 w-auto rounded-md border border-border/60 my-2"
                />
              ) : (
                <LexicalContent content={entry.contentLexical} className="text-xs text-muted-foreground" />
              )
            ) : (
              <MarkdownContent
                markdown={entry.content}
                className="text-xs text-muted-foreground"
                imageClassName="max-h-40 w-auto rounded-md border border-border/60 my-2"
              />
            )
            return (
              <motion.article
                key={entry.id}
                className={`${cardShell} p-2.5 sm:p-3`}
                variants={sectionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={sectionTransition}
                layout
              >
                <div className="flex flex-row gap-2 sm:gap-3 items-stretch">
                  {entry.imageDataUrl ? (
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
                        src={entry.imageDataUrl}
                        alt=""
                        fill
                        className="object-cover object-center transition-transform duration-200 group-hover:scale-[1.04]"
                        sizes="(max-width: 640px) 56px, 64px"
                      />
                    </Link>
                  ) : null}
                  <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-1.5">
                      <Link href={href} className="text-xs font-semibold hover:text-primary transition-colors">
                        {entry.title?.trim() ? entry.title : '（无标题）'}
                      </Link>
                      <time className="text-[0.65rem] text-muted-foreground tabular-nums shrink-0 leading-none">
                        {formatDateTimeShort(entry.createdAt, entry.displayTimezone ?? activeTimezone)}
                      </time>
                    </div>
                    <div className="relative max-h-24 overflow-hidden">
                      {renderedContent}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
                    </div>
                    <Link href={href} className="text-xs font-medium text-primary hover:underline w-fit">
                      打开全文
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
            <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading more" />
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
            到底了！
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
