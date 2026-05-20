'use client'

import { Copy, ExternalLink } from 'lucide-react'
import Image from 'next/image'
import { useT } from 'next-i18next/client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type StatusCardPreviewDevice = {
  displayName: string
}

export function StatusCardPreviewResultPanel({
  path,
  absoluteUrl,
  embedHtml,
  previewWidth,
  previewHeight,
  selectedDevice,
  onCopyText,
}: {
  path: string
  absoluteUrl: string
  embedHtml: string
  previewWidth: number
  previewHeight: number
  selectedDevice: StatusCardPreviewDevice | null | undefined
  onCopyText: (value: string) => void
}) {
  const { t } = useT('admin')

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-border bg-white p-3">
        <div className="flex min-h-40 items-center justify-center overflow-auto">
          <Image
            src={path}
            alt={t('webSettingsActivity.statusCard.previewAlt')}
            width={previewWidth}
            height={previewHeight}
            unoptimized
            className="max-w-full rounded-md"
            style={{ width: Math.min(previewWidth, 360), height: 'auto' }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('webSettingsActivity.statusCard.urlLabel')}</Label>
        <div className="flex gap-2">
          <Input readOnly value={absoluteUrl || path} className="font-mono text-xs" />
          <Button type="button" variant="outline" size="icon" onClick={() => onCopyText(absoluteUrl || path)}>
            <Copy className="h-4 w-4" aria-hidden />
            <span className="sr-only">{t('webSettingsActivity.statusCard.copyUrl')}</span>
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('webSettingsActivity.statusCard.htmlLabel')}</Label>
        <div className="flex gap-2">
          <Input readOnly value={embedHtml} className="font-mono text-xs" />
          <Button type="button" variant="outline" size="icon" onClick={() => onCopyText(embedHtml)}>
            <Copy className="h-4 w-4" aria-hidden />
            <span className="sr-only">{t('webSettingsActivity.statusCard.copyHtml')}</span>
          </Button>
        </div>
      </div>

      {absoluteUrl ? (
        <Button type="button" variant="outline" size="sm" asChild>
          <a href={absoluteUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            {t('webSettingsActivity.statusCard.openPreview')}
          </a>
        </Button>
      ) : null}

      {selectedDevice ? (
        <p className="text-xs text-muted-foreground">
          {t('webSettingsActivity.statusCard.currentDevice', {
            value: selectedDevice.displayName,
          })}
        </p>
      ) : null}
    </div>
  )
}
