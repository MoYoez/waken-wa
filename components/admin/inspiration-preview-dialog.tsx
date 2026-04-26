'use client'

import Image from 'next/image'
import { useT } from 'next-i18next/client'

import { MarkdownContent } from '@/components/admin/markdown-content'
import { LexicalContent } from '@/components/lexical-content'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  inspirationLooksLikeMarkdown,
} from '@/lib/inspiration-preview'
import type { AdminInspirationEntry } from '@/types'

interface InspirationPreviewDialogProps {
  entry: AdminInspirationEntry | null
  onClose: () => void
  formatPattern: (date: string | Date, pattern: string, fallback: string) => string
}

export function InspirationPreviewDialog({
  entry,
  onClose,
  formatPattern,
}: InspirationPreviewDialogProps) {
  const { t } = useT('admin')

  return (
    <Dialog open={Boolean(entry)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[min(90vh,56rem)] overflow-y-auto">
        {entry?.imageDataUrl ? (
          <div className="-mx-6 -mt-6 mb-4 overflow-hidden rounded-t-lg border-b border-border/60 bg-muted/20">
            <Image
              src={entry.imageDataUrl}
              alt={t('inspirationManager.preview.headerImageAlt')}
              width={1200}
              height={800}
              loading="eager"
              className="h-auto max-h-[min(42vh,18rem)] w-full object-cover object-center"
            />
          </div>
        ) : null}
        <DialogHeader>
          <DialogTitle>{entry?.title?.trim() || t('inspirationManager.common.untitled')}</DialogTitle>
          <DialogDescription>
            {entry
              ? formatPattern(entry.createdAt, 'yyyy-MM-dd HH:mm', '—')
              : ''}
          </DialogDescription>
        </DialogHeader>
        {entry?.statusSnapshot ? (
          <div className="rounded-md border border-dashed border-border/70 bg-muted/15 px-2 py-1.5 text-xs text-muted-foreground whitespace-pre-wrap">
            {entry.statusSnapshot}
          </div>
        ) : null}
        {entry?.contentLexical ? (
          inspirationLooksLikeMarkdown(entry.content) ? (
            <MarkdownContent
              markdown={entry.content}
              className="text-sm text-muted-foreground"
              imageClassName="max-h-56 w-auto rounded-md border border-border my-2"
            />
          ) : (
            <LexicalContent content={entry.contentLexical} className="text-sm text-muted-foreground" />
          )
        ) : entry ? (
          <MarkdownContent
            markdown={entry.content}
            className="text-sm text-muted-foreground"
            imageClassName="max-h-56 w-auto rounded-md border border-border my-2"
          />
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('inspirationManager.preview.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
