'use client'

import {
  AppWindow,
  Battery,
  BatteryCharging,
  Clock,
  Gamepad2,
  Hourglass,
  Laptop,
  Moon,
  Music,
  Smartphone,
  Tablet,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { useT } from 'next-i18next/client'
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { useSharedActivityFeed } from '@/components/activity-feed-provider'
import {
  getSiteSectionTransition,
  getSiteSectionVariants,
} from '@/components/site-motion'
import { useSiteTimeFormat } from '@/components/site-timezone-provider'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useIsMobile } from '@/hooks/use-mobile'
import { isDeviceBatteryCharging } from '@/lib/activity-battery-metadata'
import { getMediaDisplay, type MediaDisplay } from '@/lib/activity-media'
import { cn } from '@/lib/utils'
import type { ActivityFeedItem, SteamNowPlayingInfo } from '@/types'

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
          ? // Left-align with sibling icons; UA <button> defaults to text-center and would center short titles.
            'flex w-0 flex-1 basis-0 justify-start text-left'
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

function formatPlaybackTime(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return '--:--'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function getPlaybackPosition(media: MediaDisplay, nowMs: number): number | null {
  let positionMs = media.positionMs
  if (media.state === 'playing') {
    if (media.startedAtMs !== null) {
      positionMs = nowMs - media.startedAtMs
    } else if (media.positionMs !== null && media.reportedAtMs !== null) {
      positionMs = media.positionMs + Math.max(0, nowMs - media.reportedAtMs)
    }
  }

  if (positionMs === null || !Number.isFinite(positionMs)) return null
  const clamped = Math.max(0, positionMs)
  return media.durationMs !== null ? Math.min(clamped, media.durationMs) : clamped
}

function getPlaybackPercent(positionMs: number | null, durationMs: number | null): number | null {
  if (positionMs === null || durationMs === null || durationMs <= 0) return null
  return Math.min(100, Math.max(0, (positionMs / durationMs) * 100))
}

function hasPlaybackDetails(media: MediaDisplay): boolean {
  return Boolean(
    media.state ||
      media.positionMs !== null ||
      media.durationMs !== null ||
      media.startedAtMs !== null ||
      media.endsAtMs !== null ||
      media.reportedAtMs !== null,
  )
}

function MediaAndSteamRow({
  media,
  steam,
  showMediaSource,
  showMediaCover,
}: {
  media: MediaDisplay | null
  steam: SteamNowPlayingInfo | null
  showMediaSource: boolean
  showMediaCover: boolean
}) {
  const { t } = useT('common')
  const isMobile = useIsMobile()
  const [steamImgFailed, setSteamImgFailed] = useState(false)
  const [mediaCoverImgFailed, setMediaCoverImgFailed] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (media?.state !== 'playing' || (media.startedAtMs === null && media.reportedAtMs === null)) {
      return
    }
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [media?.reportedAtMs, media?.startedAtMs, media?.state])

  if (!media && !steam) return null

  const playbackPositionMs = media ? getPlaybackPosition(media, nowMs) : null
  const playbackPercent = media
    ? getPlaybackPercent(playbackPositionMs, media.durationMs)
    : null
  const pair = Boolean(media && steam)
  const hasMediaDetails = Boolean(
    media &&
      ((showMediaSource && media.source) ||
        (showMediaCover && media.coverUrl) ||
        hasPlaybackDetails(media)),
  )

  const MediaContent = () => (
    <>
      {showMediaCover && media?.coverUrl && !mediaCoverImgFailed ? (
        <Image
          src={media.coverUrl}
          alt=""
          width={460}
          height={460}
          loading="eager"
          className="w-full max-h-48 rounded-md object-cover bg-muted"
          onError={() => setMediaCoverImgFailed(true)}
        />
      ) : null}
      {media ? (
        <div className="space-y-2">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold leading-snug break-words">{media.title}</p>
            {media.singer || media.album ? (
              <p className="text-xs leading-snug text-muted-foreground break-words">
                {[media.singer, media.album].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>
          {hasPlaybackDetails(media) ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      media.state === 'playing'
                        ? 'bg-emerald-500'
                        : media.state === 'paused'
                          ? 'bg-amber-500'
                          : 'bg-muted-foreground/70',
                    )}
                    aria-hidden
                  />
                  {media.state === 'playing'
                    ? t('site.currentStatus.mediaPlaying')
                    : media.state === 'paused'
                      ? t('site.currentStatus.mediaPaused')
                      : media.state === 'stopped'
                        ? t('site.currentStatus.mediaStopped')
                        : t('site.currentStatus.mediaPlayback')}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {formatPlaybackTime(playbackPositionMs)}
                  {media.durationMs !== null ? ` / ${formatPlaybackTime(media.durationMs)}` : null}
                </span>
              </div>
              {playbackPercent !== null ? (
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground transition-[width] duration-500 ease-linear"
                    style={{ width: `${playbackPercent}%` }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {showMediaSource && media?.source ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t('site.currentStatus.mediaSource')}</p>
          <p className="text-sm leading-snug break-words">{media.source}</p>
        </div>
      ) : null}
    </>
  )

  const mediaContent = media ? (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2',
        pair ? 'min-w-0 flex-1 basis-0' : 'w-full min-w-0',
      )}
      role="presentation"
    >
      <Music className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      {hasMediaDetails ? (
        isMobile ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'min-w-0 flex-1 basis-0 items-center text-left',
                  pair ? 'inline-flex max-w-full' : 'flex w-full justify-start',
                  'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md transition-colors',
                )}
              >
                <MarqueeIfNeeded text={mediaPrimaryLine(media)} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(18rem,calc(100vw-2rem))] space-y-3 p-3" align="start">
              {MediaContent()}
            </PopoverContent>
          </Popover>
        ) : (
          <HoverCard openDelay={120}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className={cn(
                  'min-w-0 flex-1 basis-0 items-center text-left',
                  pair ? 'inline-flex max-w-full' : 'flex w-full justify-start',
                  'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md transition-colors',
                )}
              >
                <MarqueeIfNeeded text={mediaPrimaryLine(media)} />
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-72 space-y-3" align="start">
              {MediaContent()}
            </HoverCardContent>
          </HoverCard>
        )
      ) : (
        <MarqueeIfNeeded text={mediaPrimaryLine(media)} />
      )}
    </div>
  ) : null

  return (
    <div
      className={cn(
        'flex w-full min-w-0 items-center',
        pair ? 'gap-2' : 'gap-1.5',
      )}
    >
      {mediaContent}

      {steam ? (
        <div
          className={cn(
            'flex min-w-0 overflow-hidden',
            // With media: keep Steam on the right half, flush end within that column.
            // Steam only: align like the media row (icon + title from the left), not stuck on the card edge.
            pair
              ? 'max-w-[50%] min-w-0 flex-1 basis-0 items-center justify-end'
              : 'w-full min-w-0 items-center justify-start',
          )}
        >
          {isMobile ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={t('site.currentStatus.viewSteamDetails')}
                  className={cn(
                    'min-w-0 items-center gap-2 rounded-md transition-colors text-left',
                    pair ? 'inline-flex max-w-full' : 'flex w-full justify-start',
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
                      loading="eager"
                      className="h-4 w-10 shrink-0 rounded object-cover bg-muted"
                      onError={() => setSteamImgFailed(true)}
                    />
                  ) : null}
                  <MarqueeIfNeeded text={steam.name} grow={!pair} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(18rem,calc(100vw-2rem))] space-y-3 p-3" align="start">
                {!steamImgFailed ? (
                  <Image
                    src={steam.imageUrl}
                    alt=""
                    width={460}
                    height={215}
                    loading="eager"
                    className="w-full max-h-32 rounded-md object-cover bg-muted"
                    onError={() => setSteamImgFailed(true)}
                  />
                ) : null}
                <div className="space-y-1">
        <p className="text-sm font-semibold leading-snug break-words">{steam.name}</p>
                  <p className="text-xs text-muted-foreground">{t('site.currentStatus.steamNowPlaying')}</p>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <HoverCard openDelay={120}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  aria-label={t('site.currentStatus.viewSteamDetails')}
                  className={cn(
                    'min-w-0 items-center gap-2 rounded-md transition-colors text-left',
                    // Steam-only: full-width flex row so MarqueeIfNeeded (flex-1) gets real width like the media row.
                    // Paired with media: inline-flex stays compact on the right half.
                    pair ? 'inline-flex max-w-full' : 'flex w-full justify-start',
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
                      loading="eager"
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
                    loading="eager"
                    className="w-full max-h-32 rounded-md object-cover bg-muted"
                    onError={() => setSteamImgFailed(true)}
                  />
                ) : null}
                <div className="space-y-1">
                  <p className="text-sm font-semibold leading-snug break-words">{steam.name}</p>
                  <p className="text-xs text-muted-foreground">{t('site.currentStatus.steamNowPlaying')}</p>
                </div>
              </HoverCardContent>
            </HoverCard>
          )}
        </div>
      ) : null}
    </div>
  )
}

interface CurrentStatusProps {
  hideActivityMedia?: boolean
  showMediaSource?: boolean
  showMediaCover?: boolean
}

function LastReportTime({
  value,
  timestampFormat,
}: {
  value: string
  timestampFormat: string
}) {
  const { formatPattern } = useSiteTimeFormat()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={value}
        className="inline-block"
        initial={{ opacity: 0.45 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0.45 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
      >
        {formatPattern(value, timestampFormat, '--')}
      </motion.span>
    </AnimatePresence>
  )
}

function CurrentStatusCard({
  activity,
  hideActivityMedia,
  showMediaSource,
  showMediaCover,
  sectionTransition,
  sectionVariants,
}: {
  activity: ActivityFeedItem
  hideActivityMedia: boolean
  showMediaSource: boolean
  showMediaCover: boolean
  sectionTransition: ReturnType<typeof getSiteSectionTransition>
  sectionVariants: ReturnType<typeof getSiteSectionVariants>
}) {
  const { t } = useT('common')
  const [flashKey, setFlashKey] = useState<string | null>(null)
  const previousSignatureRef = useRef('')
  const { formatPattern } = useSiteTimeFormat()

  const timestampFormat = 'MM/dd HH:mm:ss'
  const batteryLabel = getBatteryLabel(activity.metadata)
  const charging = isDeviceBatteryCharging(activity.metadata)
  const deviceName =
    activity.device ||
    (activity.deviceId != null
      ? t('site.currentStatus.deviceFallback', { id: activity.deviceId })
      : t('site.currentStatus.activityFallback', { id: activity.id }))
  const deviceType = getDeviceType(deviceName, activity.metadata)
  const lastReportAt = activity.lastReportAt || activity.updatedAt || activity.startedAt
  const statusLine = typeof activity.statusText === 'string' ? activity.statusText.trim() : ''
  const isCustomStatus = activity.isCustomOfflineStatus || activity.isCustomLockStatus
  const customStatusType = activity.isCustomOfflineStatus
    ? 'customOfflineStatus'
    : activity.isCustomLockStatus
    ? 'customLockStatus'
    : null
  const media = hideActivityMedia ? null : getMediaDisplay(activity.metadata)
  const sp = activity.steamNowPlaying
  const steam: SteamNowPlayingInfo | null =
    sp && typeof sp.name === 'string' && sp.name.trim()
      ? {
          appId: sp.appId,
          name: sp.name,
          imageUrl: sp.imageUrl,
        }
      : null

  const updateSignature = JSON.stringify({
    batteryLabel,
    deviceName,
    lastReportAt,
    mediaLine: media ? mediaPrimaryLine(media) : '',
    processName: activity.processName,
    processTitle: activity.processTitle,
    statusLine,
    steamName: steam?.name ?? '',
    isCustomOfflineStatus: activity.isCustomOfflineStatus,
    isCustomLockStatus: activity.isCustomLockStatus,
  })

  useEffect(() => {
    const previousSignature = previousSignatureRef.current
    previousSignatureRef.current = updateSignature

    if (!previousSignature || previousSignature === updateSignature) {
      return
    }

    const showTimeoutId = window.setTimeout(() => {
      setFlashKey(updateSignature)
    }, 0)
    const hideTimeoutId = window.setTimeout(() => {
      setFlashKey((current) => (current === updateSignature ? null : current))
    }, 850)

    return () => {
      window.clearTimeout(showTimeoutId)
      window.clearTimeout(hideTimeoutId)
    }
  }, [updateSignature])

  return (
    <motion.div
      className={cn(
        'home-glass-card relative rounded-lg border border-t-0 border-r-0 border-border bg-card p-5 shadow-sm transition-[border-color,box-shadow] hover:border-primary/25 hover:shadow-md sm:p-6',
      )}
      variants={sectionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={sectionTransition}
      layout
    >
      <AnimatePresence initial={false}>
        {flashKey === updateSignature ? (
          <motion.div
            key={updateSignature}
            className="pointer-events-none absolute inset-0 rounded-[inherit] border border-t-0 border-r-0 border-primary/45"
            initial={{ opacity: 0, boxShadow: '0 0 0 0 color-mix(in srgb, var(--primary) 0%, transparent)' }}
            animate={{
              opacity: [0, 1, 0],
              boxShadow: [
                '0 0 0 0 color-mix(in srgb, var(--primary) 0%, transparent)',
                '0 0 0 1px color-mix(in srgb, var(--primary) 22%, transparent), 0 10px 30px color-mix(in srgb, var(--primary) 10%, transparent)',
                '0 0 0 0 color-mix(in srgb, var(--primary) 0%, transparent)',
              ],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: 'easeOut' }}
          />
        ) : null}
      </AnimatePresence>
      <div className="space-y-4">
        <div className="home-glass-subcard rounded-md border border-t-0 border-r-0 border-border/50 bg-muted/55 px-3 py-2.5 space-y-2 shadow-[inset_0_1px_0_0_var(--home-card-inset-highlight)]">
          <div className="text-xs font-medium text-foreground/65 tracking-tight mb-0.5">
            {t('site.currentStatus.deviceLabel')}
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
              {charging ? (
                <BatteryCharging
                  className="h-3.5 w-3.5 shrink-0"
                  aria-hidden
                />
              ) : (
                <Battery className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              <span>{t('site.currentStatus.batteryLabel', { value: batteryLabel })}</span>
            </div>
          ) : null}
        </div>

        <div className="flex items-start gap-2">
          {activity.isCustomLockStatus ? (
            <Hourglass className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
          ) : activity.isCustomOfflineStatus ? (
            <Moon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
          ) : (
            <AppWindow className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
          )}
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

        {media || steam ? (
          <MediaAndSteamRow
            media={media}
            steam={steam}
            showMediaSource={showMediaSource}
            showMediaCover={showMediaCover}
          />
        ) : null}

        <div className="pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0 text-foreground/55" aria-hidden />
                <span className="text-xs font-medium text-foreground/65 tracking-tight">
                {t('site.currentStatus.startedAt')}
              </span>
            </div>
            <div className="text-xs tabular-nums text-foreground pl-5">
              {formatPattern(activity.startedAt, timestampFormat, '--')}
            </div>
          </div>
          <div className="flex flex-col gap-1 sm:ml-auto sm:items-end">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0 text-foreground/55" aria-hidden />
              <span className="text-xs font-medium text-foreground/65 tracking-tight">
                {t('site.currentStatus.lastReportAt')}
              </span>
            </div>
            <div className="text-xs tabular-nums text-foreground pl-5 sm:pl-0 w-full sm:text-right">
              <LastReportTime value={lastReportAt} timestampFormat={timestampFormat} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function CurrentStatus({
  hideActivityMedia = false,
  showMediaSource = false,
  showMediaCover = false,
}: CurrentStatusProps) {
  const { t } = useT('common')
  const { feed, error } = useSharedActivityFeed()
  const prefersReducedMotion = Boolean(useReducedMotion())
  const sectionTransition = getSiteSectionTransition(prefersReducedMotion)
  const sectionVariants = getSiteSectionVariants(prefersReducedMotion, {
    enterY: 12,
    exitY: 8,
    scale: 0.996,
  })

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
      <motion.div
        className="home-glass-card border border-t-0 border-r-0 border-border rounded-lg shadow-sm p-6 sm:p-8 bg-card"
        variants={sectionVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={sectionTransition}
      >
        <div className="text-center text-muted-foreground">
          <div className="text-sm">{t('site.currentStatus.noActiveStatus')}</div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div className="space-y-3" layout>
      <AnimatePresence initial={false}>
        {statuses.map((activity) => {
          return (
            <CurrentStatusCard
              activity={activity}
              hideActivityMedia={hideActivityMedia}
              showMediaSource={showMediaSource}
              showMediaCover={showMediaCover}
              sectionTransition={sectionTransition}
              sectionVariants={sectionVariants}
              key={
                activity.deviceId != null
                  ? `device-${activity.deviceId}`
                  : `device-${activity.device || activity.processName || activity.id}`
              }
            />
          )
        })}
      </AnimatePresence>
    </motion.div>
  )
}
