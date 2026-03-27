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
const DEFAULT_SQUARE_FRAME = 220
const MIN_FRAME = 48
const MIN_SQUARE_FRAME = 80

type AspectMode = 'square' | 'free'

type CropRect = { x: number; y: number; w: number; h: number }

function clampRectToView(r: CropRect, view: number): CropRect {
  let { x, y, w, h } = r
  w = Math.max(MIN_FRAME, Math.min(w, view))
  h = Math.max(MIN_FRAME, Math.min(h, view))
  x = Math.max(0, Math.min(x, view - w))
  y = Math.max(0, Math.min(y, view - h))
  return { x, y, w, h }
}

function centeredSquare(size: number): CropRect {
  const s = Math.max(MIN_SQUARE_FRAME, Math.min(size, CROP_VIEW_SIZE - 8))
  return {
    x: (CROP_VIEW_SIZE - s) / 2,
    y: (CROP_VIEW_SIZE - s) / 2,
    w: s,
    h: s,
  }
}

export interface ImageCropDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Object URL from URL.createObjectURL(file); caller revokes after close */
  sourceUrl: string | null
  /**
   * Square mode: output PNG side length in pixels.
   * Free mode: max long edge of output (width/height scale proportionally).
   */
  outputSize: number
  /** Square = fixed aspect + symmetric resize; free = rectangular crop with corner handles */
  aspectMode?: AspectMode
  title: string
  description?: string
  onComplete: (dataUrl: string) => void
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
  const [cropZoom, setCropZoom] = useState(1)
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState<{
    x: number
    y: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [squareFrame, setSquareFrame] = useState(DEFAULT_SQUARE_FRAME)
  const [cropRect, setCropRect] = useState<CropRect>({
    x: 60,
    y: 60,
    w: 200,
    h: 200,
  })

  const resizeRef = useRef<
    | {
        kind: 'square'
        startX: number
        startY: number
        startSize: number
        corner: 'nw' | 'ne' | 'sw' | 'se'
      }
    | {
        kind: 'free'
        corner: 'nw' | 'ne' | 'sw' | 'se'
        startX: number
        startY: number
        rect: CropRect
      }
    | null
  >(null)
  const cropImageRef = useRef<HTMLImageElement | null>(null)

  const isSquare = aspectMode === 'square'

  // ---------- Base scale ----------
  // Square: scale so the image fills the square frame.
  // Free:   scale so the image fits *within* the view (independent of crop rect).
  const getSquareBaseScale = (nw: number, nh: number, frame: number) => {
    if (!nw || !nh) return 1
    return Math.max(frame / nw, frame / nh)
  }
  const getFreeBaseScale = (nw: number, nh: number) => {
    if (!nw || !nh) return 1
    return Math.min(CROP_VIEW_SIZE / nw, CROP_VIEW_SIZE / nh)
  }

  // ---------- Clamp offset ----------
  // Square: keep image covering the square frame.
  // Free: keep at least a quarter-view of the image inside the viewport.
  const clampOffset = (
    x: number,
    y: number,
    zoom: number,
    nw: number,
    nh: number,
    baseScale: number
  ): { x: number; y: number } => {
    if (!nw || !nh) return { x: 0, y: 0 }
    const totalScale = baseScale * zoom
    const renderedW = nw * totalScale
    const renderedH = nh * totalScale

    let maxX: number
    let maxY: number
    if (isSquare) {
      // Image must cover the frame centered at view center
      maxX = Math.max(0, (renderedW - squareFrame) / 2)
      maxY = Math.max(0, (renderedH - squareFrame) / 2)
    } else {
      // Allow generous panning: image edge can go up to 75% of the view size away from center
      maxX = Math.max(renderedW / 2, CROP_VIEW_SIZE * 0.75)
      maxY = Math.max(renderedH / 2, CROP_VIEW_SIZE * 0.75)
    }
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    }
  }

  // ---------- Current base scale (memoised by state) ----------
  const currentBaseScale =
    naturalSize.width && naturalSize.height
      ? isSquare
        ? getSquareBaseScale(naturalSize.width, naturalSize.height, squareFrame)
        : getFreeBaseScale(naturalSize.width, naturalSize.height)
      : 1

  // When squareFrame changes, re-clamp offset (square mode only)
  useEffect(() => {
    if (!isSquare || !naturalSize.width) return
    const bs = getSquareBaseScale(naturalSize.width, naturalSize.height, squareFrame)
    setCropOffset((prev) =>
      clampOffset(prev.x, prev.y, cropZoom, naturalSize.width, naturalSize.height, bs)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squareFrame, isSquare, naturalSize.width, naturalSize.height])

  // ---------- Reset on new source ----------
  useEffect(() => {
    if (!sourceUrl) return
    setCropZoom(1)
    setCropOffset({ x: 0, y: 0 })
    setNaturalSize({ width: 0, height: 0 })
    setDragStart(null)
    resizeRef.current = null
    setSquareFrame(DEFAULT_SQUARE_FRAME)
  }, [sourceUrl])

  // ---------- Image load ----------
  const onCropImageLoad = () => {
    const image = cropImageRef.current
    if (!image) return
    const nw = image.naturalWidth
    const nh = image.naturalHeight
    setNaturalSize({ width: nw, height: nh })
    setCropZoom(1)
    setCropOffset({ x: 0, y: 0 })

    if (!isSquare && nw && nh) {
      // Init crop rect to cover ~80% of the rendered image bounds (fit scale at zoom=1)
      const bs = getFreeBaseScale(nw, nh)
      const rw = nw * bs * 0.9
      const rh = nh * bs * 0.9
      const clampedW = Math.max(MIN_FRAME, Math.min(rw, CROP_VIEW_SIZE - 16))
      const clampedH = Math.max(MIN_FRAME, Math.min(rh, CROP_VIEW_SIZE - 16))
      setCropRect({
        x: (CROP_VIEW_SIZE - clampedW) / 2,
        y: (CROP_VIEW_SIZE - clampedH) / 2,
        w: clampedW,
        h: clampedH,
      })
    }
  }

  // ---------- Active rect ----------
  const activeRect: CropRect = isSquare ? centeredSquare(squareFrame) : cropRect

  // ---------- Apply crop ----------
  const applyCrop = () => {
    if (!sourceUrl || !cropImageRef.current || !naturalSize.width || !naturalSize.height) return
    const { width: nw, height: nh } = naturalSize
    const totalScale = currentBaseScale * cropZoom
    const imageLeft = CROP_VIEW_SIZE / 2 + cropOffset.x - (nw * totalScale) / 2
    const imageTop = CROP_VIEW_SIZE / 2 + cropOffset.y - (nh * totalScale) / 2

    let sx = (activeRect.x - imageLeft) / totalScale
    let sy = (activeRect.y - imageTop) / totalScale
    let sw = activeRect.w / totalScale
    let sh = activeRect.h / totalScale

    sx = Math.max(0, Math.min(sx, nw - sw))
    sy = Math.max(0, Math.min(sy, nh - sh))
    sw = Math.max(1, Math.min(sw, nw))
    sh = Math.max(1, Math.min(sh, nh))

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (isSquare) {
      canvas.width = outputSize
      canvas.height = outputSize
      ctx.drawImage(cropImageRef.current, sx, sy, sw, sh, 0, 0, outputSize, outputSize)
    } else {
      const cap = Math.max(64, outputSize)
      const longEdge = Math.max(sw, sh)
      const outScale = longEdge > cap ? cap / longEdge : 1
      const outW = Math.max(1, Math.round(sw * outScale))
      const outH = Math.max(1, Math.round(sh * outScale))
      canvas.width = outW
      canvas.height = outH
      ctx.drawImage(cropImageRef.current, sx, sy, sw, sh, 0, 0, outW, outH)
    }

    onComplete(canvas.toDataURL('image/png'))
    onOpenChange(false)
    setDragStart(null)
    resizeRef.current = null
  }

  // ---------- Zoom range ----------
  const minZoom = (() => {
    const { width: nw, height: nh } = naturalSize
    if (!nw || !nh) return 0.2
    if (isSquare) {
      const fitScale = Math.min(CROP_VIEW_SIZE / nw, CROP_VIEW_SIZE / nh)
      const bs = getSquareBaseScale(nw, nh, squareFrame)
      return Math.max(0.1, fitScale / bs)
    }
    // Free: min zoom = 0.5 (can zoom out to half the fit scale)
    return 0.5
  })()

  // ---------- Corner drag (resize) ----------
  const onCornerMouseDown = (corner: 'nw' | 'ne' | 'sw' | 'se', e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isSquare) {
      resizeRef.current = {
        kind: 'square',
        startX: e.clientX,
        startY: e.clientY,
        startSize: squareFrame,
        corner,
      }
    } else {
      resizeRef.current = {
        kind: 'free',
        corner,
        startX: e.clientX,
        startY: e.clientY,
        rect: { ...cropRect },
      }
    }
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resizeRef.current
      if (!r) return
      const dx = e.clientX - r.startX
      const dy = e.clientY - r.startY

      if (r.kind === 'square') {
        let dSize = 0
        switch (r.corner) {
          case 'se': dSize = dx + dy; break
          case 'nw': dSize = -dx - dy; break
          case 'ne': dSize = dx - dy; break
          case 'sw': dSize = -dx + dy; break
        }
        const next = Math.round(r.startSize + dSize)
        setSquareFrame(Math.max(MIN_SQUARE_FRAME, Math.min(next, CROP_VIEW_SIZE - 8)))
        return
      }

      const start = r.rect
      let next: CropRect
      switch (r.corner) {
        case 'se':
          next = clampRectToView({ x: start.x, y: start.y, w: start.w + dx, h: start.h + dy }, CROP_VIEW_SIZE)
          break
        case 'sw':
          next = clampRectToView({ x: start.x + dx, y: start.y, w: start.w - dx, h: start.h + dy }, CROP_VIEW_SIZE)
          break
        case 'ne':
          next = clampRectToView({ x: start.x, y: start.y + dy, w: start.w + dx, h: start.h - dy }, CROP_VIEW_SIZE)
          break
        case 'nw':
          next = clampRectToView({ x: start.x + dx, y: start.y + dy, w: start.w - dx, h: start.h - dy }, CROP_VIEW_SIZE)
          break
        default:
          next = start
      }
      setCropRect(next)
    }
    const onUp = () => { resizeRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const handleSize = 10
  const handleOffset = -handleSize / 2

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
                if ((e.target as HTMLElement).closest('[data-crop-handle]')) return
                setDragStart({
                  x: e.clientX,
                  y: e.clientY,
                  offsetX: cropOffset.x,
                  offsetY: cropOffset.y,
                })
              }}
              onMouseMove={(e) => {
                if (!dragStart || resizeRef.current) return
                const ddx = e.clientX - dragStart.x
                const ddy = e.clientY - dragStart.y
                const { width: nw, height: nh } = naturalSize
                const next = clampOffset(
                  dragStart.offsetX + ddx,
                  dragStart.offsetY + ddy,
                  cropZoom,
                  nw,
                  nh,
                  currentBaseScale
                )
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
                    ? `${naturalSize.width * currentBaseScale}px`
                    : 'auto',
                  height: naturalSize.height
                    ? `${naturalSize.height * currentBaseScale}px`
                    : 'auto',
                  cursor: dragStart ? 'grabbing' : 'grab',
                }}
              />

              {/* Crop frame overlay */}
              <div
                className="absolute border-2 border-primary pointer-events-none z-[1]"
                style={{
                  left: activeRect.x,
                  top: activeRect.y,
                  width: activeRect.w,
                  height: activeRect.h,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.40)',
                }}
              />

              {/* Rule-of-thirds guide lines */}
              <div
                className="absolute pointer-events-none z-[1]"
                style={{
                  left: activeRect.x,
                  top: activeRect.y,
                  width: activeRect.w,
                  height: activeRect.h,
                }}
              >
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {[...Array(4)].map((_, i) => (
                    <span
                      key={`v${i}`}
                      className="absolute top-0 bottom-0 border-r border-white/20"
                      style={{ left: `${(i + 1) * 33.33}%` }}
                    />
                  ))}
                  {[...Array(2)].map((_, i) => (
                    <span
                      key={`h${i}`}
                      className="absolute left-0 right-0 border-b border-white/20"
                      style={{ top: `${(i + 1) * 33.33}%` }}
                    />
                  ))}
                </div>
              </div>

              {/* Corner resize handles */}
              {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
                const left = corner.includes('w')
                  ? activeRect.x + handleOffset
                  : activeRect.x + activeRect.w + handleOffset
                const top = corner.includes('n')
                  ? activeRect.y + handleOffset
                  : activeRect.y + activeRect.h + handleOffset
                return (
                  <div
                    key={corner}
                    data-crop-handle
                    role="presentation"
                    className="absolute z-[3] border-2 border-primary bg-background"
                    style={{
                      width: handleSize,
                      height: handleSize,
                      left,
                      top,
                      borderRadius: 2,
                      pointerEvents: 'auto',
                      cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
                    }}
                    onMouseDown={(e) => onCornerMouseDown(corner, e)}
                  />
                )
              })}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                {isSquare
                  ? '缩放（拖动图片平移；拖角点调整正方形边长）'
                  : '缩放（拖动图片平移；拖角点调整裁剪框大小）'}
              </label>
              <input
                type="range"
                min={minZoom}
                max={4}
                step={0.01}
                value={cropZoom}
                onChange={(e) => {
                  const nextZoom = Number(e.target.value)
                  const { width: nw, height: nh } = naturalSize
                  const bs = isSquare
                    ? getSquareBaseScale(nw, nh, squareFrame)
                    : getFreeBaseScale(nw, nh)
                  const next = clampOffset(cropOffset.x, cropOffset.y, nextZoom, nw, nh, bs)
                  setCropZoom(nextZoom)
                  setCropOffset(next)
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
