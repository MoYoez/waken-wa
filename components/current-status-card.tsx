'use client'

import {
  AppWindow,
  Battery,
  BatteryCharging,
  Clock,
  Hourglass,
  Laptop,
  Moon,
  Smartphone,
  Tablet,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useT } from 'next-i18next/client'
import { useEffect, useRef, useState } from 'react'

import { MediaAndSteamRow } from '@/components/current-status-media-row'
import { getSiteSectionTransition, getSiteSectionVariants } from '@/components/site-motion'
import { useSiteTimeFormat } from '@/components/site-timezone-provider'
import { isDeviceBatteryCharging } from '@/lib/activity-battery-metadata'
import { getMediaDisplay } from '@/lib/activity-media'
import { cn } from '@/lib/utils'
import type { ActivityFeedItem, SteamNowPlayingInfo } from '@/types'

import { getBatteryLabel, getDeviceType, mediaPrimaryLine } from './current-status-utils'

function LastReportTime({
  value,
  timestampFormat,
  disableAnimation,
}: {
  value: string
  timestampFormat: string
  disableAnimation?: boolean
}) {
  const { formatPattern } = useSiteTimeFormat()
  if (disableAnimation) {
    return (
      <span className="inline-block">
        {formatPattern(value, timestampFormat, '--')}
      </span>
    )
  }
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

export function CurrentStatusCard({
  activity,
  hideActivityMedia,
  showMediaSource,
  showMediaCover,
  showMediaNcmLink,
  sectionTransition,
  sectionVariants,
  disableAnimation = false,
}: {
  activity: ActivityFeedItem
  hideActivityMedia: boolean
  showMediaSource: boolean
  showMediaCover: boolean
  showMediaNcmLink: boolean
  sectionTransition: ReturnType<typeof getSiteSectionTransition>
  sectionVariants: ReturnType<typeof getSiteSectionVariants>
  disableAnimation?: boolean
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
    if (disableAnimation) return

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
  }, [updateSignature, disableAnimation])

  const cardClassName = cn(
    'home-glass-card relative rounded-lg border border-t-0 border-r-0 border-border bg-card p-5 shadow-sm transition-[border-color,box-shadow] hover:border-primary/25 hover:shadow-md sm:p-6',
  )

  const cardContent = (
    <>
      {!disableAnimation && (
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
      )}
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
                <BatteryCharging className="h-3.5 w-3.5 shrink-0" aria-hidden />
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
            showMediaNcmLink={showMediaNcmLink}
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
              <LastReportTime value={lastReportAt} timestampFormat={timestampFormat} disableAnimation={disableAnimation} />
            </div>
          </div>
        </div>
      </div>
    </>
  )

  if (disableAnimation) {
    return (
      <div className={cardClassName}>
        {cardContent}
      </div>
    )
  }

  return (
    <motion.div
      className={cardClassName}
      variants={sectionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={sectionTransition}
      layout
    >
      {cardContent}
    </motion.div>
  )
}
