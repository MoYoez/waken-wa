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

/** Clamp r so it stays inside [0, view] on both axes. */
function clampRectToView(r: CropRect, view: number): CropRect {
  let { x, y, w, h } = r
  w = Math.max(MIN_FRAME, Math.min(w, view))
  h = Math.max(MIN_FRAME, Math.min(h, view))
  x = Math.max(0, Math.min(x, view - w))
  y = Math.max(0, Math.min(y, view - h))
  return { x, y, w, h }
}

/** Clamp r so it stays inside the image's current rendered area. */
function clampRectToImg(
  r: CropRect,
  imgLeft: number,
  imgTop: number,
  imgRight: number,
  imgBottom: number
): CropRect {
  let { x, y, w, h } = r
  x = Math.max(imgLeft, Math.min(x, imgRight - MIN_FRAME))
  y = Math.max(imgTop, Math.min(y, imgBottom - MIN_FRAME))
  w = Math.max(MIN_FRAME, Math.min(w, imgRight - x))
  h = Math.max(MIN_FRAME, Math.min(h, imgBottom - y))
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

/** Scale to fit the image inside the view (free mode). */
function freeBaseScaleOf(nw: number, nh: number): number {
  if (!nw || !nh) return 1
  return Math.min(CROP_VIEW_SIZE / nw, CROP_VIEW_SIZE / nh)
}

/** Scale so the image fills the square frame (square mode). */
function squareBaseScaleOf(nw: number, nh: number, frame: number): number {
  if (!nw || !nh) return 1
  return Math.max(frame / nw, frame / nh)
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
    x: 60, y: 60, w: 200, h: 200,
  })

  const resizeRef = useRef<
    | { kind: 'square'; startX: number; startY: number; startSize: number; corner: 'nw' | 'ne' | 'sw' | 'se' }
    | { kind: 'free';   startX: number; startY: number; rect: CropRect;    corner: 'nw' | 'ne' | 'sw' | 'se' }
    | null
  >(null)
  const cropImageRef = useRef<HTMLImageElement | null>(null)

  /**
   * Live snapshot of state needed inside resize useEffect (which has [] deps, so closures are stale).
   * Updated synchronously on every render.
   */
  const liveRef = useRef({
    cropOffset: { x: 0, y: 0 },
    cropZoom: 1,
    nw: 0,
    nh: 0,
    freeBaseScale: 1,
    squareFrame: DEFAULT_SQUARE_FRAME,
    cropRect: { x: 60, y: 60, w: 200, h: 200 } as CropRect,
  })
  liveRef.current = {
    cropOffset,
    cropZoom,
    nw: naturalSize.width,
    nh: naturalSize.height,
    freeBaseScale:
      naturalSize.width && naturalSize.height
        ? freeBaseScaleOf(naturalSize.width, naturalSize.height)
        : 1,
    squareFrame,
    cropRect,
  }

  const isSquare = aspectMode === 'square'

  /** Returns image bounds [left, top, right, bottom] in view-pixel space. */
  const getImgBounds = (
    offset: { x: number; y: number },
    zoom: number,
    nw: number,
    nh: number,
    baseScale: number
  ) => {
    const rw = nw * baseScale * zoom
    const rh = nh * baseScale * zoom
    const cx = CROP_VIEW_SIZE / 2 + offset.x
    const cy = CROP_VIEW_SIZE / 2 + offset.y
    return { left: cx - rw / 2, top: cy - rh / 2, right: cx + rw / 2, bottom: cy + rh / 2, rw, rh }
  }

  /**
   * Clamp image offset so the image covers the given rect (free mode)
   * or the square frame (square mode).
   */
  const clampOffset = (
    x: number,
    y: number,
    zoom: number,
    nw: number,
    nh: number,
    baseScale: number,
    rect: CropRect
  ): { x: number; y: number } => {
    if (!nw || !nh) return { x: 0, y: 0 }
    const rw = nw * baseScale * zoom
    const rh = nh * baseScale * zoom

    if (isSquare) {
      // image center must stay within ±(renderedSize-frameSize)/2 of view center
      const maxX = Math.max(0, (rw - squareFrame) / 2)
      const maxY = Math.max(0, (rh - squareFrame) / 2)
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      }
    }

    // Free mode: image must cover the crop rect
    // image left = CROP_VIEW_SIZE/2 + x - rw/2, must be ≤ rect.x
    const maxX = rect.x + rw / 2 - CROP_VIEW_SIZE / 2
    // image right = CROP_VIEW_SIZE/2 + x + rw/2, must be ≥ rect.x + rect.w
    const minX = rect.x + rect.w - rw / 2 - CROP_VIEW_SIZE / 2
    // image top must be ≤ rect.y
    const maxY = rect.y + rh / 2 - CROP_VIEW_SIZE / 2
    // image bottom must be ≥ rect.y + rect.h
    const minY = rect.y + rect.h - rh / 2 - CROP_VIEW_SIZE / 2

    return {
      x: Math.min(maxX, Math.max(minX, x)),
      y: Math.min(maxY, Math.max(minY, y)),
    }
  }

  // Current base scale (derived from state, not activeRect-dependent in free mode)
  const baseScale =
    naturalSize.width && naturalSize.height
      ? isSquare
        ? squareBaseScaleOf(naturalSize.width, naturalSize.height, squareFrame)
        : freeBaseScaleOf(naturalSize.width, naturalSize.height)
      : 1

  // Re-clamp offset when square frame changes
  useEffect(() => {
    if (!isSquare || !naturalSize.width) return
    const bs = squareBaseScaleOf(naturalSize.width, naturalSize.height, squareFrame)
    setCropOffset((prev) =>
      clampOffset(prev.x, prev.y, cropZoom, naturalSize.width, naturalSize.height, bs, cropRect)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squareFrame, isSquare, naturalSize.width, naturalSize.height])

  // Reset on new source
  useEffect(() => {
    if (!sourceUrl) return
    setCropZoom(1)
    setCropOffset({ x: 0, y: 0 })
    setNaturalSize({ width: 0, height: 0 })
    setDragStart(null)
    resizeRef.current = null
    setSquareFrame(DEFAULT_SQUARE_FRAME)
  }, [sourceUrl])

  const onCropImageLoad = () => {
    const image = cropImageRef.current
    if (!image) return
    const nw = image.naturalWidth
    const nh = image.naturalHeight
    setNaturalSize({ width: nw, height: nh })
    setCropZoom(1)
    setCropOffset({ x: 0, y: 0 })

    if (!isSquare && nw && nh) {
      // Init crop rect to ~90% of the image's rendered area (zoom=1, offset=0)
      const bs = freeBaseScaleOf(nw, nh)
      const rw = nw * bs
      const rh = nh * bs
      const imgLeft = CROP_VIEW_SIZE / 2 - rw / 2
      const imgTop  = CROP_VIEW_SIZE / 2 - rh / 2
      const fw = rw * 0.9
      const fh = rh * 0.9
      setCropRect({
        x: imgLeft + (rw - fw) / 2,
        y: imgTop  + (rh - fh) / 2,
        w: fw,
        h: fh,
      })
    }
  }

  const activeRect: CropRect = isSquare ? centeredSquare(squareFrame) : cropRect

  const applyCrop = () => {
    if (!sourceUrl || !cropImageRef.current || !naturalSize.width || !naturalSize.height) return
    const { width: nw, height: nh } = naturalSize
    const totalScale = baseScale * cropZoom
    const imageLeft = CROP_VIEW_SIZE / 2 + cropOffset.x - (nw * totalScale) / 2
    const imageTop  = CROP_VIEW_SIZE / 2 + cropOffset.y - (nh * totalScale) / 2

    let sx = (activeRect.x - imageLeft) / totalScale
    let sy = (activeRect.y - imageTop)  / totalScale
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
      canvas.width  = Math.max(1, Math.round(sw * outScale))
      canvas.height = Math.max(1, Math.round(sh * outScale))
      ctx.drawImage(cropImageRef.current, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    }

    onComplete(canvas.toDataURL('image/png'))
    onOpenChange(false)
    setDragStart(null)
    resizeRef.current = null
  }

  const minZoom = (() => {
    const { width: nw, height: nh } = naturalSize
    if (!nw || !nh) return 0.2
    if (isSquare) {
      const fitScale = Math.min(CROP_VIEW_SIZE / nw, CROP_VIEW_SIZE / nh)
      return Math.max(0.1, fitScale / squareBaseScaleOf(nw, nh, squareFrame))
    }
    return 0.5
  })()

  const onCornerMouseDown = (corner: 'nw' | 'ne' | 'sw' | 'se', e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isSquare) {
      resizeRef.current = { kind: 'square', startX: e.clientX, startY: e.clientY, startSize: squareFrame, corner }
    } else {
      resizeRef.current = { kind: 'free', corner, startX: e.clientX, startY: e.clientY, rect: { ...cropRect } }
    }
  }

  // Global mouse move/up for resizing — uses liveRef to avoid stale closures
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resizeRef.current
      if (!r) return
      const dx = e.clientX - r.startX
      const dy = e.clientY - r.startY

      if (r.kind === 'square') {
        let dSize = 0
        switch (r.corner) {
          case 'se': dSize =  dx + dy; break
          case 'nw': dSize = -dx - dy; break
          case 'ne': dSize =  dx - dy; break
          case 'sw': dSize = -dx + dy; break
        }
        setSquareFrame((prev) =>
          Math.max(MIN_SQUARE_FRAME, Math.min(Math.round(r.startSize + dSize), CROP_VIEW_SIZE - 8))
        )
        return
      }

      // --- Free mode: build candidate rect, then clamp to image bounds ---
      const start = r.rect
      let candidate: CropRect
      switch (r.corner) {
        case 'se': candidate = { x: start.x,       y: start.y,       w: start.w + dx, h: start.h + dy }; break
        case 'sw': candidate = { x: start.x + dx,  y: start.y,       w: start.w - dx, h: start.h + dy }; break
        case 'ne': candidate = { x: start.x,       y: start.y + dy,  w: start.w + dx, h: start.h - dy }; break
        case 'nw': candidate = { x: start.x + dx,  y: start.y + dy,  w: start.w - dx, h: start.h - dy }; break
        default:   candidate = start
      }

      // First clamp to view, then clamp to image rendered area
      const inView = clampRectToView(candidate, CROP_VIEW_SIZE)
      const live = liveRef.current
      if (live.nw && live.nh) {
        const { left, top, right, bottom } = {
          ...(() => {
            const rw = live.nw * live.freeBaseScale * live.cropZoom
            const rh = live.nh * live.freeBaseScale * live.cropZoom
            const cx = CROP_VIEW_SIZE / 2 + live.cropOffset.x
            const cy = CROP_VIEW_SIZE / 2 + live.cropOffset.y
            return { left: cx - rw / 2, top: cy - rh / 2, right: cx + rw / 2, bottom: cy + rh / 2 }
          })(),
        }
        setCropRect(clampRectToImg(inView, left, top, right, bottom))
      } else {
        setCropRect(inView)
      }
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
                const next = clampOffset(
                  dragStart.offsetX + ddx,
                  dragStart.offsetY + ddy,
                  cropZoom,
                  naturalSize.width,
                  naturalSize.height,
                  baseScale,
                  cropRect
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
                  width:  naturalSize.width  ? `${naturalSize.width  * baseScale}px` : 'auto',
                  height: naturalSize.height ? `${naturalSize.height * baseScale}px` : 'auto',
                  cursor: dragStart ? 'grabbing' : 'grab',
                }}
              />

              {/* Crop frame */}
              <div
                className="absolute border-2 border-primary pointer-events-none z-[1]"
                style={{
                  left:   activeRect.x,
                  top:    activeRect.y,
                  width:  activeRect.w,
                  height: activeRect.h,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.40)',
                }}
              />

              {/* Rule-of-thirds guide lines */}
              <div
                className="absolute pointer-events-none z-[1]"
                style={{ left: activeRect.x, top: activeRect.y, width: activeRect.w, height: activeRect.h }}
              >
                {[33.33, 66.66].map((pct) => (
                  <span
                    key={`v${pct}`}
                    className="absolute top-0 bottom-0"
                    style={{ left: `${pct}%`, borderLeft: '1px solid rgba(255,255,255,0.18)' }}
                  />
                ))}
                {[33.33, 66.66].map((pct) => (
                  <span
                    key={`h${pct}`}
                    className="absolute left-0 right-0"
                    style={{ top: `${pct}%`, borderTop: '1px solid rgba(255,255,255,0.18)' }}
                  />
                ))}
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
                  const bs = isSquare
                    ? squareBaseScaleOf(naturalSize.width, naturalSize.height, squareFrame)
                    : freeBaseScaleOf(naturalSize.width, naturalSize.height)
                  const next = clampOffset(
                    cropOffset.x, cropOffset.y, nextZoom,
                    naturalSize.width, naturalSize.height, bs, cropRect
                  )
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
