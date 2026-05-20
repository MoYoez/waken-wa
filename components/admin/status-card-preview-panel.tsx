'use client'

import { useAtom } from 'jotai'
import { RotateCcw, Upload } from 'lucide-react'
import { useT } from 'next-i18next/client'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'

import { uploadImageSource } from '@/components/admin/admin-query-mutations'
import { ImageCropDialog } from '@/components/admin/image-crop-dialog'
import {
  formatNumberRange,
  NumberSettingInput,
} from '@/components/admin/number-setting-input'
import { StatusCardColorInput } from '@/components/admin/status-card-color-input'
import { StatusCardPreviewResultPanel } from '@/components/admin/status-card-preview-result-panel'
import {
  WebSettingsInset,
  WebSettingsRow,
  WebSettingsRows,
} from '@/components/admin/web-settings-layout'
import {
  webSettingsFormAtom,
  webSettingsInspirationDevicesAtom,
} from '@/components/admin/web-settings-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  STATUS_CARD_BACKGROUND_CROP_ASPECT_RATIO,
  STATUS_CARD_COVER_CROP_ASPECT_RATIO,
  STATUS_CARD_COVER_CROP_OUTPUT_EDGE,
  STATUS_CARD_DEFAULTS,
  STATUS_CARD_PREVIEW_DEFAULT_DRAFT,
  STATUS_CARD_SIGNATURE_HEIGHT,
  STATUS_CARD_SIGNATURE_WIDTH,
} from '@/constants/status-card'
import { normalizeStatusCardTag } from '@/lib/status-card-options'
import {
  BuildStatusCardPreviewPath,
  EscapeHtmlAttribute,
  ExtractStatusCardAssetKeyFromImageSourceUrl,
  FormatStatusCardDimensionValue,
  GetStatusCardDimensions,
  HashStatusCardPreviewText,
  ToStatusCardHexColor,
} from '@/lib/status-card-preview'
import type {
  StatusCardPreviewDeviceMode,
  StatusCardPreviewDraft,
  StatusCardVariant,
} from '@/types/status-card'

export function StatusCardPreviewPanel() {
  const { t } = useT('admin')
  const [form, setForm] = useAtom(webSettingsFormAtom)
  const [devices] = useAtom(webSettingsInspirationDevicesAtom)
  const origin = useSyncExternalStore(
    () => () => undefined,
    () => window.location.origin,
    () => '',
  )
  const [draft, setDraft] = useState<StatusCardPreviewDraft>(() => ({
    ...STATUS_CARD_PREVIEW_DEFAULT_DRAFT,
  }))
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [isUploadingBackground, setIsUploadingBackground] = useState(false)
  const [coverCropSourceUrl, setCoverCropSourceUrl] = useState<string | null>(null)
  const [coverCropDialogOpen, setCoverCropDialogOpen] = useState(false)
  const [backgroundCropSourceUrl, setBackgroundCropSourceUrl] = useState<string | null>(null)
  const [backgroundCropDialogOpen, setBackgroundCropDialogOpen] = useState(false)

  const selectedDevice = devices.find((device) => {
    switch (draft.deviceMode) {
      case 'deviceId':
        return String(device.id) === draft.deviceValue
      case 'deviceKey':
        return device.generatedHashKey === draft.deviceValue
      case 'auto':
        return false
    }
  })
  const pathDraft = BuildStatusCardPreviewPath(draft, {
    statusCardVariant: form.statusCardVariant,
    statusCardTag: form.statusCardTag,
    statusCardBackgroundKey: form.statusCardBackgroundKey,
    statusCardBackgroundRev: form.statusCardBackgroundRev,
    statusCardCoverKey: form.statusCardCoverKey,
    statusCardCoverRev: form.statusCardCoverRev,
    statusCardShowHeader: form.statusCardShowHeader,
    statusCardShowAvatar: form.statusCardShowAvatar,
    statusCardShowName: form.statusCardShowName,
    statusCardShowBio: form.statusCardShowBio,
    statusCardShowNote: form.statusCardShowNote,
    statusCardPreferGame: form.statusCardPreferGame,
    statusCardShowInClassStatus: form.statusCardShowInClassStatus,
    statusCardWidth: form.statusCardWidth,
    statusCardHeight: form.statusCardHeight,
    statusCardRadius: form.statusCardRadius,
    statusCardBg: form.statusCardBg,
    statusCardSignatureBg: form.statusCardSignatureBg,
    statusCardFg: form.statusCardFg,
    statusCardMuted: form.statusCardMuted,
    statusCardAccent: form.statusCardAccent,
    statusCardBorder: form.statusCardBorder,
  })
  const [path, setPath] = useState(pathDraft)
  useEffect(() => {
    const timer = window.setTimeout(() => setPath(pathDraft), 700)
    return () => window.clearTimeout(timer)
  }, [pathDraft])
  const absoluteUrl = `${origin}${path}`
  const embedAlt = form.currentlyText.trim() || t('webSettingsBasic.currentlyTextDefault')
  const embedHtml = `<img src="${EscapeHtmlAttribute(absoluteUrl || path)}" alt="${EscapeHtmlAttribute(embedAlt)}" />`

  const patchForm = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const setVariant = (value: StatusCardVariant) => {
    setForm((prev) => ({
      ...prev,
      statusCardVariant: value,
      ...(value === 'signature'
        ? {
            statusCardWidth: STATUS_CARD_SIGNATURE_WIDTH,
            statusCardHeight: STATUS_CARD_SIGNATURE_HEIGHT,
          }
        : {}),
    }))
  }

  const patchDraft = <K extends keyof StatusCardPreviewDraft>(
    key: K,
    value: StatusCardPreviewDraft[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(t('common.copiedToClipboard'))
    } catch {
      toast.error(t('common.copyFailedBrowserPermission'))
    }
  }

  const openCoverCropForFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error(t('webSettingsActivity.statusCard.coverUploadInvalid'))
      return
    }
    if (coverCropSourceUrl) URL.revokeObjectURL(coverCropSourceUrl)
    setCoverCropSourceUrl(URL.createObjectURL(file))
    setCoverCropDialogOpen(true)
  }

  const openBackgroundCropForFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error(t('webSettingsActivity.statusCard.backgroundUploadInvalid'))
      return
    }
    if (backgroundCropSourceUrl) URL.revokeObjectURL(backgroundCropSourceUrl)
    setBackgroundCropSourceUrl(URL.createObjectURL(file))
    setBackgroundCropDialogOpen(true)
  }

  const uploadCoverDataUrl = async (dataUrl: string) => {
    setIsUploadingCover(true)
    try {
      const [url, contentHash] = await Promise.all([
        uploadImageSource(dataUrl, 'status-card.cover'),
        HashStatusCardPreviewText(dataUrl),
      ])
      const coverKey = ExtractStatusCardAssetKeyFromImageSourceUrl(url)
      if (!coverKey) throw new Error('Missing image key')
      setForm((prev) => ({
        ...prev,
        statusCardCoverKey: coverKey,
        statusCardCoverRev: contentHash.slice(0, 16),
      }))
      toast.success(t('webSettingsActivity.statusCard.coverUploadSuccess'))
    } catch {
      toast.error(t('webSettingsActivity.statusCard.coverUploadFailed'))
    } finally {
      setIsUploadingCover(false)
    }
  }

  const uploadBackgroundDataUrl = async (dataUrl: string) => {
    setIsUploadingBackground(true)
    try {
      const [url, contentHash] = await Promise.all([
        uploadImageSource(dataUrl, 'status-card.background'),
        HashStatusCardPreviewText(dataUrl),
      ])
      const backgroundKey = ExtractStatusCardAssetKeyFromImageSourceUrl(url)
      if (!backgroundKey) throw new Error('Missing image key')
      setForm((prev) => ({
        ...prev,
        statusCardBackgroundKey: backgroundKey,
        statusCardBackgroundRev: contentHash.slice(0, 16),
      }))
      toast.success(t('webSettingsActivity.statusCard.backgroundUploadSuccess'))
    } catch {
      toast.error(t('webSettingsActivity.statusCard.backgroundUploadFailed'))
    } finally {
      setIsUploadingBackground(false)
    }
  }

  const reset = () => {
    setDraft({ ...STATUS_CARD_PREVIEW_DEFAULT_DRAFT })
    setForm((prev) => ({
      ...prev,
      statusCardVariant: STATUS_CARD_DEFAULTS.statusCardVariant,
      statusCardTag: STATUS_CARD_DEFAULTS.statusCardTag,
      statusCardBackgroundKey: STATUS_CARD_DEFAULTS.statusCardBackgroundKey,
      statusCardBackgroundRev: STATUS_CARD_DEFAULTS.statusCardBackgroundRev,
      statusCardCoverKey: STATUS_CARD_DEFAULTS.statusCardCoverKey,
      statusCardCoverRev: STATUS_CARD_DEFAULTS.statusCardCoverRev,
      statusCardShowHeader: STATUS_CARD_DEFAULTS.statusCardShowHeader,
      statusCardShowAvatar: STATUS_CARD_DEFAULTS.statusCardShowAvatar,
      statusCardShowName: STATUS_CARD_DEFAULTS.statusCardShowName,
      statusCardShowBio: STATUS_CARD_DEFAULTS.statusCardShowBio,
      statusCardShowNote: STATUS_CARD_DEFAULTS.statusCardShowNote,
      statusCardPreferGame: STATUS_CARD_DEFAULTS.statusCardPreferGame,
      statusCardShowInClassStatus: STATUS_CARD_DEFAULTS.statusCardShowInClassStatus,
      statusCardWidth: STATUS_CARD_DEFAULTS.statusCardWidth,
      statusCardHeight: STATUS_CARD_DEFAULTS.statusCardHeight,
      statusCardRadius: STATUS_CARD_DEFAULTS.statusCardRadius,
      statusCardBg: STATUS_CARD_DEFAULTS.statusCardBg,
      statusCardSignatureBg: STATUS_CARD_DEFAULTS.statusCardSignatureBg,
      statusCardFg: STATUS_CARD_DEFAULTS.statusCardFg,
      statusCardMuted: STATUS_CARD_DEFAULTS.statusCardMuted,
      statusCardAccent: ToStatusCardHexColor(
        prev.profileOnlineAccentColor || STATUS_CARD_DEFAULTS.statusCardAccent,
        STATUS_CARD_DEFAULTS.statusCardAccent,
      ),
      statusCardBorder: STATUS_CARD_DEFAULTS.statusCardBorder,
    }))
  }

  const previewDimensions = GetStatusCardDimensions(
    form.statusCardWidth,
    form.statusCardHeight,
    form.statusCardRadius,
  )
  const previewWidthInput = FormatStatusCardDimensionValue(form.statusCardWidth)
  const previewHeightInput = FormatStatusCardDimensionValue(form.statusCardHeight)
  const widthAuto = previewWidthInput === 'auto'
  const heightAuto = previewHeightInput === 'auto'

  return (
    <WebSettingsInset className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-foreground">
            {t('webSettingsActivity.statusCard.title')}
          </h4>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t('webSettingsActivity.statusCard.descriptionPrefix')}{' '}
            <code className="rounded bg-muted px-1">img</code>
            {t('webSettingsActivity.statusCard.descriptionSuffix')}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={reset}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          {t('webSettingsActivity.statusCard.reset')}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
        <div className="space-y-4">
          <WebSettingsRows>
            <WebSettingsRow
              htmlFor="status-card-enabled"
              title={t('webSettingsActivity.statusCard.enabledTitle')}
              description={t('webSettingsActivity.statusCard.enabledDescription')}
              action={
                <Switch
                  id="status-card-enabled"
                  checked={form.statusCardEnabled}
                  onCheckedChange={(value) => patchForm('statusCardEnabled', value)}
                />
              }
            />
            <WebSettingsRow
              htmlFor="status-card-show-header"
              title={t('webSettingsActivity.statusCard.showHeaderTitle')}
              description={t('webSettingsActivity.statusCard.showHeaderDescription')}
              action={
                <Switch
                  id="status-card-show-header"
                  checked={form.statusCardShowHeader}
                  onCheckedChange={(value) => patchForm('statusCardShowHeader', value)}
                />
              }
            />
            <WebSettingsRow
              htmlFor="status-card-show-note"
              title={t('webSettingsActivity.statusCard.showNoteTitle')}
              description={t('webSettingsActivity.statusCard.showNoteDescription')}
              action={
                <Switch
                  id="status-card-show-note"
                  checked={form.statusCardShowNote}
                  onCheckedChange={(value) => patchForm('statusCardShowNote', value)}
                  disabled={!form.statusCardShowHeader}
                />
              }
            />
            <WebSettingsRow
              htmlFor="status-card-prefer-game"
              title={t('webSettingsActivity.statusCard.preferGameTitle')}
              description={t('webSettingsActivity.statusCard.preferGameDescription')}
              action={
                <Switch
                  id="status-card-prefer-game"
                  checked={form.statusCardPreferGame}
                  onCheckedChange={(value) => patchForm('statusCardPreferGame', value)}
                />
              }
            />
            <WebSettingsRow
              htmlFor="status-card-show-in-class"
              title={t('webSettingsActivity.statusCard.showInClassTitle')}
              description={t('webSettingsActivity.statusCard.showInClassDescription')}
              action={
                <Switch
                  id="status-card-show-in-class"
                  checked={form.statusCardShowInClassStatus}
                  onCheckedChange={(value) => patchForm('statusCardShowInClassStatus', value)}
                />
              }
            />
          </WebSettingsRows>

          {form.statusCardShowHeader ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['statusCardShowAvatar', t('webSettingsActivity.statusCard.showAvatar')],
                ['statusCardShowName', t('webSettingsActivity.statusCard.showName')],
                ['statusCardShowBio', t('webSettingsActivity.statusCard.showBio')],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm"
                >
                  <span>{label}</span>
                  <Switch
                    checked={Boolean(form[key as 'statusCardShowAvatar' | 'statusCardShowName' | 'statusCardShowBio'])}
                    onCheckedChange={(value) => patchForm(key as 'statusCardShowAvatar' | 'statusCardShowName' | 'statusCardShowBio', value)}
                  />
                </label>
              ))}
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="status-card-variant">
                {t('webSettingsActivity.statusCard.variantLabel')}
              </Label>
              <Select
                value={form.statusCardVariant}
                onValueChange={(value) => setVariant(value as StatusCardVariant)}
              >
                <SelectTrigger id="status-card-variant" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aurora">
                    {t('webSettingsActivity.statusCard.variants.aurora')}
                  </SelectItem>
                  <SelectItem value="cover">
                    {t('webSettingsActivity.statusCard.variants.cover')}
                  </SelectItem>
                  <SelectItem value="signature">
                    {t('webSettingsActivity.statusCard.variants.signature')}
                  </SelectItem>
                  <SelectItem value="classic">
                    {t('webSettingsActivity.statusCard.variants.classic')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-card-tag">
                {t('webSettingsActivity.statusCard.tagLabel')}
              </Label>
              <Input
                id="status-card-tag"
                value={form.statusCardTag}
                onChange={(event) => patchForm('statusCardTag', normalizeStatusCardTag(event.target.value))}
                placeholder={t('webSettingsActivity.statusCard.tagPlaceholder')}
              />
            </div>
            {form.statusCardVariant === 'signature' ? (
              <div className="space-y-2">
                <Label htmlFor="status-card-background-key">
                  {t('webSettingsActivity.statusCard.backgroundKeyLabel')}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="status-card-background-key"
                    value={form.statusCardBackgroundKey}
                    onChange={(event) => patchForm('statusCardBackgroundKey', event.target.value)}
                    placeholder={t('webSettingsActivity.statusCard.backgroundKeyPlaceholder')}
                    className="font-mono text-xs"
                  />
                  <Button type="button" variant="outline" size="sm" disabled={isUploadingBackground} asChild>
                    <label className="cursor-pointer">
                      <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      {isUploadingBackground
                        ? t('webSettingsActivity.statusCard.backgroundUploading')
                        : t('webSettingsActivity.statusCard.backgroundUpload')}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) => {
                          openBackgroundCropForFile(event.target.files?.[0])
                          event.target.value = ''
                        }}
                      />
                    </label>
                  </Button>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t('webSettingsActivity.statusCard.backgroundKeyHint')}
                </p>
              </div>
            ) : null}
            {form.statusCardVariant === 'cover' ? (
              <div className="space-y-2">
                <Label htmlFor="status-card-cover-key">
                  {t('webSettingsActivity.statusCard.coverKeyLabel')}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="status-card-cover-key"
                    value={form.statusCardCoverKey}
                    onChange={(event) => patchForm('statusCardCoverKey', event.target.value)}
                    placeholder={t('webSettingsActivity.statusCard.coverKeyPlaceholder')}
                    className="font-mono text-xs"
                  />
                  <Button type="button" variant="outline" size="sm" disabled={isUploadingCover} asChild>
                    <label className="cursor-pointer">
                      <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      {isUploadingCover
                        ? t('webSettingsActivity.statusCard.coverUploading')
                        : t('webSettingsActivity.statusCard.coverUpload')}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) => {
                          openCoverCropForFile(event.target.files?.[0])
                          event.target.value = ''
                        }}
                      />
                    </label>
                  </Button>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t('webSettingsActivity.statusCard.coverKeyHint')}
                </p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="status-card-device-mode">
                {t('webSettingsActivity.statusCard.deviceModeLabel')}
              </Label>
              <Select
                value={draft.deviceMode}
                onValueChange={(value) => {
                  patchDraft('deviceMode', value as StatusCardPreviewDeviceMode)
                  patchDraft('deviceValue', '')
                }}
              >
                <SelectTrigger id="status-card-device-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    {t('webSettingsActivity.statusCard.deviceModes.auto')}
                  </SelectItem>
                  <SelectItem value="deviceId">
                    {t('webSettingsActivity.statusCard.deviceModes.deviceId')}
                  </SelectItem>
                  <SelectItem value="deviceKey">
                    {t('webSettingsActivity.statusCard.deviceModes.deviceKey')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {draft.deviceMode === 'auto' ? null : (
              <div className="space-y-2">
                <Label htmlFor="status-card-device-value">
                  {t('webSettingsActivity.statusCard.deviceValueLabel')}
                </Label>
                <Select value={draft.deviceValue} onValueChange={(value) => patchDraft('deviceValue', value)}>
                  <SelectTrigger id="status-card-device-value" className="w-full">
                    <SelectValue placeholder={t('webSettingsActivity.statusCard.deviceValuePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((device) => (
                      <SelectItem
                        key={`${draft.deviceMode}-${device.id}`}
                        value={draft.deviceMode === 'deviceId' ? String(device.id) : device.generatedHashKey}
                      >
                        {device.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {draft.deviceMode === 'deviceKey' ? (
            <p className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
              {t('webSettingsActivity.statusCard.deviceKeyWarning')}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <div className="flex min-h-5 items-center justify-between gap-2">
                <Label htmlFor="status-card-width" className="text-xs text-muted-foreground">
                  {t('webSettingsActivity.statusCard.widthLabel')}
                </Label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{t('webSettingsActivity.statusCard.autoLabel')}</span>
                  <Switch
                    checked={widthAuto}
                    onCheckedChange={(checked) =>
                      patchForm(
                        'statusCardWidth',
                        checked ? 'auto' : STATUS_CARD_DEFAULTS.statusCardWidth,
                      )
                    }
                    aria-label={t('webSettingsActivity.statusCard.widthAutoLabel')}
                  />
                </label>
              </div>
              <NumberSettingInput
                id="status-card-width"
                min={280}
                max={1200}
                value={widthAuto ? STATUS_CARD_DEFAULTS.statusCardWidth : previewWidthInput}
                rangeMessage={formatNumberRange(280, 1200)}
                onValueChange={(value) => patchForm('statusCardWidth', value)}
                disabled={widthAuto}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex min-h-5 items-center justify-between gap-2">
                <Label htmlFor="status-card-height" className="text-xs text-muted-foreground">
                  {t('webSettingsActivity.statusCard.heightLabel')}
                </Label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{t('webSettingsActivity.statusCard.autoLabel')}</span>
                  <Switch
                    checked={heightAuto}
                    onCheckedChange={(checked) =>
                      patchForm(
                        'statusCardHeight',
                        checked ? 'auto' : STATUS_CARD_DEFAULTS.statusCardHeight,
                      )
                    }
                    aria-label={t('webSettingsActivity.statusCard.heightAutoLabel')}
                  />
                </label>
              </div>
              <NumberSettingInput
                id="status-card-height"
                min={1}
                max={720}
                value={heightAuto ? STATUS_CARD_DEFAULTS.statusCardHeight : previewHeightInput}
                rangeMessage={formatNumberRange(1, 720)}
                onValueChange={(value) => patchForm('statusCardHeight', value)}
                disabled={heightAuto}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status-card-radius" className="text-xs text-muted-foreground">
                {t('webSettingsActivity.statusCard.radiusLabel')}
              </Label>
              <NumberSettingInput
                id="status-card-radius"
                min={0}
                max={80}
                value={form.statusCardRadius}
                rangeMessage={formatNumberRange(0, 80)}
                onValueChange={(value) => patchForm('statusCardRadius', value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatusCardColorInput id="status-card-bg" label={t('webSettingsActivity.statusCard.bgLabel')} value={form.statusCardBg} onChange={(value) => patchForm('statusCardBg', value)} />
            {form.statusCardVariant === 'signature' ? (
              <StatusCardColorInput id="status-card-signature-bg" label={t('webSettingsActivity.statusCard.signatureBgLabel')} value={form.statusCardSignatureBg} onChange={(value) => patchForm('statusCardSignatureBg', value)} />
            ) : null}
            <StatusCardColorInput id="status-card-fg" label={t('webSettingsActivity.statusCard.fgLabel')} value={form.statusCardFg} onChange={(value) => patchForm('statusCardFg', value)} />
            <StatusCardColorInput id="status-card-muted" label={t('webSettingsActivity.statusCard.mutedLabel')} value={form.statusCardMuted} onChange={(value) => patchForm('statusCardMuted', value)} />
            <StatusCardColorInput id="status-card-accent" label={t('webSettingsActivity.statusCard.accentLabel')} value={form.statusCardAccent} onChange={(value) => patchForm('statusCardAccent', value)} />
            <StatusCardColorInput id="status-card-border" label={t('webSettingsActivity.statusCard.borderLabel')} value={form.statusCardBorder} onChange={(value) => patchForm('statusCardBorder', value)} />
          </div>
        </div>

        <StatusCardPreviewResultPanel
          path={path}
          absoluteUrl={absoluteUrl}
          embedHtml={embedHtml}
          previewWidth={previewDimensions.width}
          previewHeight={previewDimensions.height}
          selectedDevice={selectedDevice}
          onCopyText={(value) => void copyText(value)}
        />
      </div>
      <ImageCropDialog
        open={coverCropDialogOpen}
        onOpenChange={(open) => {
          setCoverCropDialogOpen(open)
          if (!open) {
            setCoverCropSourceUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev)
              return null
            })
          }
        }}
        sourceUrl={coverCropSourceUrl}
        aspectMode="free"
        aspectRatio={STATUS_CARD_COVER_CROP_ASPECT_RATIO}
        outputSize={STATUS_CARD_COVER_CROP_OUTPUT_EDGE}
        outputFormat="webp"
        outputQuality={0.9}
        title={t('webSettingsActivity.statusCard.coverCropTitle')}
        description={t('webSettingsActivity.statusCard.coverCropDescription')}
        onComplete={(dataUrl) => {
          void uploadCoverDataUrl(dataUrl)
        }}
      />
      <ImageCropDialog
        open={backgroundCropDialogOpen}
        onOpenChange={(open) => {
          setBackgroundCropDialogOpen(open)
          if (!open) {
            setBackgroundCropSourceUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev)
              return null
            })
          }
        }}
        sourceUrl={backgroundCropSourceUrl}
        aspectMode="free"
        aspectRatio={STATUS_CARD_BACKGROUND_CROP_ASPECT_RATIO}
        outputSize={STATUS_CARD_COVER_CROP_OUTPUT_EDGE}
        outputFormat="webp"
        outputQuality={0.88}
        title={t('webSettingsActivity.statusCard.backgroundCropTitle')}
        description={t('webSettingsActivity.statusCard.backgroundCropDescription')}
        onComplete={(dataUrl) => {
          void uploadBackgroundDataUrl(dataUrl)
        }}
      />
    </WebSettingsInset>
  )
}

