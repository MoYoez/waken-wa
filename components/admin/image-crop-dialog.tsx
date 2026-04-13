'use client'

import 'react-image-crop/dist/ReactCrop.css'

import { useT } from 'next-i18next/client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import ReactCrop, {
  centerCrop,
  convertToPixelCrop,
  type Crop,
  makeAspectCrop,
  type PixelCrop,
} from 'react-image-crop'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ImageCropAspectMode, ImageCropDialogProps } from '@/types/components'

export type { ImageCropDialogProps } from '@/types/components'

const MAX_VIEW = 320

function toOutputPng(
  image: HTMLImageElement,
  pixelCrop: PixelCrop,
  aspectMode: ImageCropAspectMode,
  outputSize: number,
): string {
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  let sx = pixelCrop.x * scaleX
  let sy = pixelCrop.y * scaleY
  let sw = pixelCrop.width * scaleX
  let sh = pixelCrop.height * scaleY

  sx = Math.max(0, Math.min(sx, image.naturalWidth - 1))
  sy = Math.max(0, Math.min(sy, image.naturalHeight - 1))
  sw = Math.max(1, Math.min(sw, image.naturalWidth - sx))
  sh = Math.max(1, Math.min(sh, image.naturalHeight - sy))

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  if (aspectMode === 'square') {
    canvas.width = outputSize
    canvas.height = outputSize
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outputSize, outputSize)
  } else {
    const cap = Math.max(64, outputSize)
    const longEdge = Math.max(sw, sh)
    const outScale = longEdge > cap ? cap / longEdge : 1
    canvas.width = Math.max(1, Math.round(sw * outScale))
    canvas.height = Math.max(1, Math.round(sh * outScale))
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  }

  return canvas.toDataURL('image/png')
}

export function ImageCropDialog({
  open,
  onOpenChange,
  sourceUrl,
  outputSize,
  aspectMode = 'square',
  title,
  description,
  onComplete,
}: ImageCropDialogProps) {
  const { t } = useT('admin')
  const [crop, setCrop] = useState<Crop>()
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const imgRef = useRef<HTMLImageElement>(null)
  const initUrlRef = useRef<string | null>(null)

  const isSquare = aspectMode === 'square'

  const baseFit =
    natural.w > 0 && natural.h > 0
      ? Math.min(MAX_VIEW / natural.w, MAX_VIEW / natural.h)
      : 1
  const dispW = Math.max(1, Math.round(natural.w * baseFit))
  const dispH = Math.max(1, Math.round(natural.h * baseFit))

  const initCropForImage = useCallback(
    (img: HTMLImageElement) => {
      const w = img.width
      const h = img.height
      if (!w || !h) return
      const next = isSquare
        ? centerCrop(makeAspectCrop({ unit: '%', width: 75 }, 1, w, h), w, h)
        : centerCrop({ unit: '%', width: 85, height: 80 }, w, h)
      setCrop(next)
    },
    [isSquare],
  )

  useEffect(() => {
    initUrlRef.current = null
  }, [sourceUrl])

  // Init crop after `natural`/`dispW`/`dispH` commit so `img.width`/`img.height` match the layout
  // (avoid racing onLoad rAF when displayed size was still the 1×1 placeholder).
  useLayoutEffect(() => {
    if (!open || !sourceUrl) return
    const img = imgRef.current
    if (!img || !natural.w || !natural.h) return
    if (initUrlRef.current === sourceUrl) return
    if (!img.complete || img.naturalWidth < 1) return
    if (img.width !== dispW || img.height !== dispH) return
    initUrlRef.current = sourceUrl
    initCropForImage(img)
  }, [
    open,
    sourceUrl,
    natural.w,
    natural.h,
    dispW,
    dispH,
    initCropForImage,
  ])

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      initUrlRef.current = null
      setCrop(undefined)
      setNatural({ w: 0, h: 0 })
    }
    onOpenChange(next)
  }

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setNatural({ w: img.naturalWidth, h: img.naturalHeight })
  }

  const applyCrop = () => {
    const img = imgRef.current
    if (!img || !crop || !natural.w) return
    const pixel = convertToPixelCrop(crop, img.width, img.height)
    const dataUrl = toOutputPng(img, pixel, aspectMode, outputSize)
    onComplete(dataUrl)
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[min(92dvh,900px)] overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        {sourceUrl && (
          <div className="space-y-4">
            <div className="flex max-h-[min(65dvh,420px)] w-full justify-center overflow-auto rounded-md border border-border bg-muted/30 p-2">
              <ReactCrop
                crop={crop}
                aspect={isSquare ? 1 : undefined}
                minWidth={24}
                minHeight={24}
                keepSelection
                ruleOfThirds
                onChange={(_, percentCrop) => setCrop(percentCrop)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- need HTMLImageElement + natural dimensions for canvas export */}
                <img
                  ref={imgRef}
                  src={sourceUrl}
                  alt=""
                  width={dispW}
                  height={dispH}
                  onLoad={onImageLoad}
                  draggable={false}
                  className="max-w-none"
                />
              </ReactCrop>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={applyCrop} disabled={!crop || !natural.w}>
            {t('common.complete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
