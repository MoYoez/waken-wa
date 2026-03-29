'use client'

import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { AppWindow, Battery, Clock, Gamepad2, Laptop, Music, Smartphone, Tablet } from 'lucide-react'
import Image from 'next/image'
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { useSharedActivityFeed } from '@/components/activity-feed-provider'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { useIsClient } from '@/hooks/use-is-client'
import { getMediaDisplay, type MediaDisplay } from '@/lib/activity-media'
import { cn } from '@/lib/utils'

function getBatteryLabel(metadata: Record<string, unknown> | null | undefined): string | null {
  const value = metadata?.deviceBatteryPercent
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const clamped = Math.min(Math.max(Math.round(value), 0), 100)
  return `${clamped}%`
}

function getDeviceType(
  deviceName: string,
  metadata: Record<string, unknown> | null | undefined
): 'mobile' | 'tablet' | 'desktop' {
  const explicit = String(metadata?.deviceType ?? '').trim().toLowerCase()
  if (explicit === 'mobile' || explicit === 'tablet' || explicit === 'desktop') return explicit

  const source = deviceName.toLowerCase()
  if (/ipad|tablet|tab|平板/.test(source)) return 'tablet'
  if (/iphone|android|mobile|phone|手机/.test(source)) return 'mobile'
  return 'desktop'
}

type SteamNowPlayingClient = {
  appId: string
  name: string
  imageUrl: string
}

/** When text is wider than its slot (~half row when paired), run horizontal marquee instead of clipping. */
function MarqueeIfNeeded({
  text,
  textClassName,
  outerClassName,
  /** When false (Steam cluster): width follows text up to max-w-full so the block can sit flush right with `justify-end`. */
  grow = true,
}: {
  text: string
  textClassName?: string
  outerClassName?: string
  grow?: boolean
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)
  const [overflowPx, setOverflowPx] = useState(0)

  const measure = useCallback(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    const ow = outer.getBoundingClientRect().width
    const sw = inner.scrollWidth
    setOverflowPx(Math.max(0, Math.ceil(sw - ow)))
  }, [])

  useLayoutEffect(() => {
    measure()
    const id = requestAnimationFrame(() => measure())
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) {
      return () => cancelAnimationFrame(id)
    }
    const ro = new ResizeObserver(() => measure())
    ro.observe(outer)
    ro.observe(inner)
    return () => {
      cancelAnimationFrame(id)
      ro.disconnect()
    }
  }, [text, measure])

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts?.ready) return
    void document.fonts.ready.then(() => measure())
  }, [text, measure, grow])

  const durationSec = overflowPx > 0 ? Math.min(14, Math.max(5, overflowPx / 38)) : 0

  return (
    <div
      ref={outerRef}
      className={cn(
        'min-w-0 max-w-full overflow-hidden',
        grow
          ? 'w-0 flex-1 basis-0'
          : 'w-max max-w-full shrink text-right',
        outerClassName,
      )}
    >
      <span
        ref={innerRef}
        className={cn(
          'inline-block max-w-none whitespace-nowrap text-sm font-medium text-foreground/90',
          overflowPx > 0 && 'status-marquee-animate',
          textClassName,
        )}
        style={
          overflowPx > 0
            ? ({
                ['--status-marquee-shift' as string]: `-${overflowPx}px`,
                animation: `status-marquee ${durationSec}s ease-in-out infinite`,
              } as CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </div>
  )
}

function mediaPrimaryLine(media: MediaDisplay): string {
  return media.singer ? `${media.title} · ${media.singer}` : media.title
}

function MediaAndSteamRow({
  media,
  steam,
}: {
  media: MediaDisplay | null
  steam: SteamNowPlayingClient | null
}) {
  const [steamImgFailed, setSteamImgFailed] = useState(false)

  if (!media && !steam) return null

  const pair = Boolean(media && steam)

  return (
    <div
      className={cn(
        'flex w-full min-w-0 items-center',
        pair ? 'gap-2' : 'gap-1.5',
      )}
    >
      {media ? (
        <div
          className={cn(
            'flex min-w-0 items-center gap-2',
            pair ? 'min-w-0 flex-1 basis-0' : 'w-full min-w-0',
          )}
        >
          <Music className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <MarqueeIfNeeded text={mediaPrimaryLine(media)} />
        </div>
      ) : null}

      {steam ? (
        <div
          className={cn(
            'flex min-w-0 overflow-hidden',
            // With media: keep Steam on the right half, flush end within that column.
            // Steam only: align like the media row (icon + title from the left), not stuck on the card edge.
            pair ? 'max-w-[50%] min-w-0 flex-1 basis-0 justify-end' : 'w-full min-w-0 justify-start',
          )}
        >
          <HoverCard openDelay={120}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className={cn(
                  'inline-flex max-w-full min-w-0 items-center gap-2 rounded-md transition-colors',
                  'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                <Gamepad2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                {!steamImgFailed ? (
                  <Image
                    src={steam.imageUrl}
                    alt=""
                    width={40}
                    height={15}
                    className="h-4 w-10 shrink-0 rounded object-cover bg-muted"
                    onError={() => setSteamImgFailed(true)}
                  />
                ) : null}
                <MarqueeIfNeeded text={steam.name} grow={!pair} />
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-72 space-y-3" align="start">
              {!steamImgFailed ? (
                <Image
                  src={steam.imageUrl}
                  alt=""
                  width={460}
                  height={215}
                  className="w-full max-h-32 rounded-md object-cover bg-muted"
                  onError={() => setSteamImgFailed(true)}
                />
              ) : null}
              <div className="space-y-1">
                <p className="text-sm font-semibold leading-snug break-words">{steam.name}</p>
                <p className="text-xs text-muted-foreground">正在游玩（Steam）</p>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
      ) : null}
    </div>
  )
}

interface CurrentStatusProps {
  hideActivityMedia?: boolean
}

export function CurrentStatus({ hideActivityMedia = false }: CurrentStatusProps) {
  const { feed, error } = useSharedActivityFeed()
  const mounted = useIsClient()

  if (!mounted) return null

  if (error) {
    return (
      <div className="text-sm text-destructive">
        {error}
      </div>
    )
  }

  const statuses = feed?.activeStatuses ?? []

  if (statuses.length === 0) {
    return (
      <div className="border border-border rounded-lg shadow-sm p-6 sm:p-8 bg-card">
        <div className="text-center text-muted-foreground">
          <div className="text-sm">暂无设备在线状态</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {statuses.map((activity) => {
        const timestampFormat = 'MM/dd HH:mm:ss'
        const batteryLabel = getBatteryLabel(activity.metadata)
        const deviceName =
          activity.device ||
          (activity.deviceId != null ? `device #${activity.deviceId}` : `activity #${activity.id}`)
        const deviceType = getDeviceType(deviceName, activity.metadata)
        const lastReportAt = activity.lastReportAt || activity.updatedAt || activity.startedAt
        const statusLine = typeof activity.statusText === 'string' ? activity.statusText.trim() : ''
        const media = hideActivityMedia ? null : getMediaDisplay(activity.metadata)
        const sp = activity.steamNowPlaying
        const steam: SteamNowPlayingClient | null =
          sp && typeof sp.name === 'string' && sp.name.trim()
            ? {
                appId: sp.appId,
                name: sp.name,
                imageUrl: sp.imageUrl,
              }
            : null

        return (
          <div
            key={`${activity.deviceId ?? 'na'}-${activity.id}`}
            className="border border-border rounded-lg shadow-sm p-5 sm:p-6 bg-card transition-all hover:shadow-md hover:border-primary/25"
          >
            <div className="space-y-4">
              <div className="rounded-md bg-muted/30 px-3 py-2.5 space-y-2">
                <div className="text-xs font-medium text-muted-foreground tracking-tight mb-0.5">
                  设备
                </div>
                <div className="text-sm text-foreground flex items-center gap-2">
                  {deviceType === 'mobile' ? (
                    <Smartphone className="h-4 w-4 shrink-0 text-primary/80" />
                  ) : deviceType === 'tablet' ? (
                    <Tablet className="h-4 w-4 shrink-0 text-primary/80" />
                  ) : (
                    <Laptop className="h-4 w-4 shrink-0 text-primary/80" />
                  )}
                  <span className="font-medium">{deviceName}</span>
                </div>
                {batteryLabel ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Battery className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>电量 {batteryLabel}</span>
                  </div>
                ) : null}
              </div>

              <div className="flex items-start gap-2">
                <AppWindow className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground/90 min-w-0">
                  {statusLine ? (
                    <span className="font-medium">{statusLine}</span>
                  ) : (
                    <>
                      {activity.processTitle ? (
                        <>
                          <span className="font-medium">{activity.processTitle}</span>
                          <span className="text-muted-foreground/50 select-none hidden sm:inline">|</span>
                        </>
                      ) : null}
                      <span className="text-muted-foreground">{activity.processName}</span>
                    </>
                  )}
                </div>
              </div>

              {media || steam ? <MediaAndSteamRow media={media} steam={steam} /> : null}

              <div className="pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="text-xs font-medium text-muted-foreground tracking-tight">
                      开始时间
                    </span>
                  </div>
                  <div className="text-xs tabular-nums pl-5">
                    {format(new Date(activity.startedAt), timestampFormat, { locale: zhCN })}
                  </div>
                </div>
                <div className="flex flex-col gap-1 sm:ml-auto sm:items-end">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="text-xs font-medium text-muted-foreground tracking-tight">最后上报</span>
                  </div>
                  <div className="text-xs tabular-nums pl-5 sm:pl-0 w-full sm:text-right">
                    {format(new Date(lastReportAt), timestampFormat, { locale: zhCN })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
