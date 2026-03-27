'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const CROP_VIEW_SIZE = 320
const CROP_FRAME_SIZE = 220

function getMinZoom(naturalW: number, naturalH: number): number {
  if (!naturalW || !naturalH) return 0.2
  const fitScale = Math.min(CROP_VIEW_SIZE / naturalW, CROP_VIEW_SIZE / naturalH)
  const baseScale = Math.max(CROP_FRAME_SIZE / naturalW, CROP_FRAME_SIZE / naturalH)
  return Math.max(0.1, fitScale / baseScale)
}

export interface ImageCropDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Object URL from URL.createObjectURL(file); caller revokes after close */
  sourceUrl: string | null
  /** Square PNG output side length in pixels */
  outputSize: number
  title: string
  description?: string
  onComplete: (dataUrl: string) => void
}

export function ImageCropDialog({
  open,
  onOpenChange,
  sourceUrl,
  outputSize,
  title,
  description,
  onComplete,
}: ImageCropDialogProps) {
  const [cropZoom, setCropZoom] = useState(1)
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState<{
    x: number
    y: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const cropImageRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!sourceUrl) return
    setCropZoom(1)
    setCropOffset({ x: 0, y: 0 })
    setNaturalSize({ width: 0, height: 0 })
    setDragStart(null)
  }, [sourceUrl])

  const onCropImageLoad = () => {
    const image = cropImageRef.current
    if (!image) return
    setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight })
    setCropZoom(1)
    setCropOffset({ x: 0, y: 0 })
  }

  const getBaseScale = (nw = naturalSize.width, nh = naturalSize.height) => {
    if (!nw || !nh) return 1
    return Math.max(CROP_FRAME_SIZE / nw, CROP_FRAME_SIZE / nh)
  }

  const clampOffset = (x: number, y: number, zoom = cropZoom) => {
    if (!naturalSize.width || !naturalSize.height) return { x: 0, y: 0 }
    const totalScale = getBaseScale() * zoom
    const renderedWidth = naturalSize.width * totalScale
    const renderedHeight = naturalSize.height * totalScale
    const maxX = Math.max(0, (renderedWidth - CROP_FRAME_SIZE) / 2)
    const maxY = Math.max(0, (renderedHeight - CROP_FRAME_SIZE) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    }
  }

  const applyCrop = () => {
    if (!sourceUrl || !cropImageRef.current || !naturalSize.width || !naturalSize.height) {
      return
    }
    const totalScale = getBaseScale() * cropZoom
    const imageLeft =
      CROP_VIEW_SIZE / 2 + cropOffset.x - (naturalSize.width * totalScale) / 2
    const imageTop =
      CROP_VIEW_SIZE / 2 + cropOffset.y - (naturalSize.height * totalScale) / 2
    const frameLeft = (CROP_VIEW_SIZE - CROP_FRAME_SIZE) / 2
    const frameTop = (CROP_VIEW_SIZE - CROP_FRAME_SIZE) / 2

    let sx = (frameLeft - imageLeft) / totalScale
    let sy = (frameTop - imageTop) / totalScale
    let sw = CROP_FRAME_SIZE / totalScale
    let sh = CROP_FRAME_SIZE / totalScale

    sx = Math.max(0, Math.min(sx, naturalSize.width - sw))
    sy = Math.max(0, Math.min(sy, naturalSize.height - sh))
    sw = Math.max(1, Math.min(sw, naturalSize.width))
    sh = Math.max(1, Math.min(sh, naturalSize.height))

    const canvas = document.createElement('canvas')
    canvas.width = outputSize
    canvas.height = outputSize
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(cropImageRef.current, sx, sy, sw, sh, 0, 0, outputSize, outputSize)
    onComplete(canvas.toDataURL('image/png'))
    onOpenChange(false)
    setDragStart(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {sourceUrl && (
          <div className="space-y-3">
            <div
              className="relative mx-auto border border-border rounded-md overflow-hidden bg-black/40"
              style={{ width: CROP_VIEW_SIZE, height: CROP_VIEW_SIZE }}
              onMouseDown={(e) => {
                setDragStart({
                  x: e.clientX,
                  y: e.clientY,
                  offsetX: cropOffset.x,
                  offsetY: cropOffset.y,
                })
              }}
              onMouseMove={(e) => {
                if (!dragStart) return
                const dx = e.clientX - dragStart.x
                const dy = e.clientY - dragStart.y
                const next = clampOffset(dragStart.offsetX + dx, dragStart.offsetY + dy)
                setCropOffset(next)
              }}
              onMouseUp={() => setDragStart(null)}
              onMouseLeave={() => setDragStart(null)}
            >
              <img
                ref={cropImageRef}
                src={sourceUrl}
                alt="crop preview"
                onLoad={onCropImageLoad}
                className="absolute select-none"
                draggable={false}
                style={{
                  left: `calc(50% + ${cropOffset.x}px)`,
                  top: `calc(50% + ${cropOffset.y}px)`,
                  transform: `translate(-50%, -50%) scale(${cropZoom})`,
                  width: naturalSize.width
                    ? `${naturalSize.width * getBaseScale()}px`
                    : 'auto',
                  height: naturalSize.height
                    ? `${naturalSize.height * getBaseScale()}px`
                    : 'auto',
                  cursor: dragStart ? 'grabbing' : 'grab',
                }}
              />
              <div
                className="absolute border-2 border-primary pointer-events-none"
                style={{
                  left: (CROP_VIEW_SIZE - CROP_FRAME_SIZE) / 2,
                  top: (CROP_VIEW_SIZE - CROP_FRAME_SIZE) / 2,
                  width: CROP_FRAME_SIZE,
                  height: CROP_FRAME_SIZE,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)',
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                缩放（左滑缩小可看全图，右滑放大后拖动选取区域）
              </label>
              <input
                type="range"
                min={getMinZoom(naturalSize.width, naturalSize.height)}
                max={4}
                step={0.01}
                value={cropZoom}
                onChange={(e) => {
                  const nextZoom = Number(e.target.value)
                  const nextOffset = clampOffset(cropOffset.x, cropOffset.y, nextZoom)
                  setCropZoom(nextZoom)
                  setCropOffset(nextOffset)
                }}
                className="w-full"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" onClick={applyCrop}>
            确认裁剪
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
