'use client'

import { PencilLine, Trash2 } from 'lucide-react'
import type { Transition,Variants } from 'motion/react'
import { AnimatePresence, motion } from 'motion/react'
import Image from 'next/image'
import { useT } from 'next-i18next/client'

import {
  INSPIRATION_LIST_MAX_HEIGHT,
  INSPIRATION_LIST_PAGE_SIZE,
} from '@/components/admin/inspiration-manager-constants'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  inspirationPlainPreviewAny,
} from '@/lib/inspiration-preview'
import type { AdminInspirationEntry } from '@/types'

interface InspirationEntryListProps {
  entries: AdminInspirationEntry[]
  total: number
  loading: boolean
  page: number
  totalPages: number
  q: string
  onQChange: (q: string) => void
  onPageChange: (page: number) => void
  onEdit: (entry: AdminInspirationEntry) => void
  onDelete: (id: number) => void
  onPreview: (entry: AdminInspirationEntry) => void
  formatPattern: (date: string | Date, pattern: string, fallback: string) => string
  compactSectionVariants: Variants
  sectionTransition: Transition
}

export function InspirationEntryList({
  entries,
  total,
  loading,
  page,
  totalPages,
  q,
  onQChange,
  onPageChange,
  onEdit,
  onDelete,
  onPreview,
  formatPattern,
  compactSectionVariants,
  sectionTransition,
}: InspirationEntryListProps) {
  const { t } = useT('admin')

  return (
    <>
      <div className="mt-8 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t('inspirationManager.search.title')}</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px] space-y-2">
            <Label htmlFor="insp-search">{t('inspirationManager.search.keyword')}</Label>
            <Input
              id="insp-search"
              value={q}
              onChange={(e) => {
                onQChange(e.target.value)
                onPageChange(0)
              }}
              placeholder={t('inspirationManager.search.placeholder')}
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
            <div className="py-10 text-center text-muted-foreground">{t('inspirationManager.list.empty')}</div>
          ) : (
            <motion.div
              className="divide-y overflow-y-auto overscroll-contain"
              style={{ maxHeight: INSPIRATION_LIST_MAX_HEIGHT }}
              layout
            >
              <AnimatePresence initial={false}>
                {entries.map((entry) => (
                  <motion.div
                    key={entry.id}
                    className="p-4 sm:p-5 space-y-3"
                    variants={compactSectionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={sectionTransition}
                    layout
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-foreground truncate max-w-[420px]">
                            {entry.title ? entry.title : t('inspirationManager.common.untitled')}
                          </h4>
                          <span className="text-xs text-muted-foreground">
                            {formatPattern(entry.createdAt, 'yyyy-MM-dd HH:mm', '—')}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                          {
                            inspirationPlainPreviewAny(
                              entry.content,
                              entry.contentLexical,
                              140,
                            ).text
                          }
                        </div>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="mt-1 h-auto px-0 text-xs"
                          onClick={() => onPreview(entry)}
                        >
                          {t('inspirationManager.list.viewMore')}
                        </Button>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => onEdit(entry)}
                        >
                          <PencilLine className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('inspirationManager.deleteDialog.title')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('inspirationManager.deleteDialog.description')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDelete(entry.id)}>
                                {t('common.delete')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    {entry.imageDataUrl ? (
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <Image
                          src={entry.imageDataUrl}
                          alt={t('inspirationManager.list.imageAlt')}
                          width={800}
                          height={600}
                          loading="eager"
                          className="max-h-64 w-auto rounded-md border bg-background"
                        />
                      </div>
                    ) : null}
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <span>
            {t('common.countSummary', { total })}
            {entries.length > 0 ? (
              <>
                {' '}
                ·{' '}
                {t('common.pageSummary', {
                  start: page * INSPIRATION_LIST_PAGE_SIZE + 1,
                  end: page * INSPIRATION_LIST_PAGE_SIZE + entries.length,
                })}
              </>
            ) : null}
          </span>
          {total > INSPIRATION_LIST_PAGE_SIZE ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => onPageChange(Math.max(0, page - 1))}
                disabled={page <= 0}
              >
                {t('common.previousPage')}
              </Button>
              <span className="tabular-nums text-sm">
                {page + 1} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages - 1}
              >
                {t('common.nextPage')}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
