'use client'

import { AnimatePresence, motion } from 'motion/react'
import Image from 'next/image'
import { useT } from 'next-i18next/client'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useSharedActivityFeed } from '@/components/activity-feed-provider'
import {
  normalizeProfileOnlineAccentColor,
  PROFILE_ONLINE_ACCENT_VAR,
} from '@/lib/profile-online-accent-color'
import { isTodayStatusActive } from '@/lib/today-status'
import { cn } from '@/lib/utils'

export { UserProfileNoteSection } from '@/components/user-profile/note-section'
export type { UserProfileNoteSectionProps } from '@/types/components'

const TODAY_STATUS_BUBBLE_MIN_WIDTH = 64
const TODAY_STATUS_BUBBLE_MAX_WIDTH = 260
const TODAY_STATUS_TEXT_FONT_FAMILY =
  '"Noto Sans SC", var(--font-sans-default), sans-serif'

function estimateTodayStatusBubbleWidth(text: string): number {
  const contentWidth = Array.from(text.trim()).reduce((total, char) => {
    if (/\s/.test(char)) return total + 4
    if (/[⺀-鿿가-힯豈-﫿！-｠]/.test(char)) {
      return total + 9
    }
    return total + 5.2
  }, 0)

  return Math.max(
    TODAY_STATUS_BUBBLE_MIN_WIDTH,
    Math.min(TODAY_STATUS_BUBBLE_MAX_WIDTH, Math.ceil(contentWidth + 24)),
  )
}

interface UserProfileProps {
  name?: string
  bio?: string
  avatarUrl?: string
  /** When set (#RRGGBB), overrides theme --online for avatar ring and status dot */
  profileOnlineAccentColor?: string | null
  /** When false, no animate-pulse on the online dot (null/undefined = enable pulse) */
  profileOnlinePulseEnabled?: boolean | null
  todayStatusEmoji?: string
  todayStatusText?: string
  todayStatusExpiresAt?: string
  todayStatusBusy?: boolean
}

export function UserProfile({
  name,
  bio,
  avatarUrl = '/avatar.jpg',
  profileOnlineAccentColor = null,
  profileOnlinePulseEnabled = null,
  todayStatusEmoji = '',
  todayStatusText = '',
  todayStatusExpiresAt = '',
  todayStatusBusy = false,
}: UserProfileProps) {
  const { t } = useT('common')
  const { feed } = useSharedActivityFeed()
  const [todayStatusOpen, setTodayStatusOpen] = useState(false)
  const [todayStatusHovered, setTodayStatusHovered] = useState(false)
  const [todayStatusBubblePosition, setTodayStatusBubblePosition] = useState<{
    left: number
    top: number
    width: number
  } | null>(null)
  const todayStatusButtonRef = useRef<HTMLButtonElement>(null)
  const todayStatusHoverCloseTimerRef = useRef<number | null>(null)
  const isOnline = Boolean(feed?.activeStatuses?.length)
  const onlineHex = normalizeProfileOnlineAccentColor(profileOnlineAccentColor ?? '')
  const onlinePulse = profileOnlinePulseEnabled !== false
  const hasTodayStatus = isTodayStatusActive({
    todayStatusEmoji,
    todayStatusExpiresAt,
  })
  const showTodayStatusPanel =
    hasTodayStatus &&
    todayStatusText.trim().length > 0 &&
    (todayStatusOpen || todayStatusHovered)
  const accentVarStyle: CSSProperties | undefined =
    onlineHex != null
      ? ({ [PROFILE_ONLINE_ACCENT_VAR]: onlineHex } as CSSProperties)
      : undefined
  const resolvedName = name?.trim() || t('site.profile.defaultName')
  const resolvedBio = bio?.trim() || t('site.profile.defaultBio')
  const todayStatusBubbleWidth = estimateTodayStatusBubbleWidth(todayStatusText)

  const clearTodayStatusHoverCloseTimer = () => {
    if (todayStatusHoverCloseTimerRef.current === null) return
    window.clearTimeout(todayStatusHoverCloseTimerRef.current)
    todayStatusHoverCloseTimerRef.current = null
  }

  const keepTodayStatusHovered = () => {
    if (typeof window !== 'undefined') {
      clearTodayStatusHoverCloseTimer()
    }
    if (hasTodayStatus) setTodayStatusHovered(true)
  }

  const releaseTodayStatusHovered = () => {
    if (typeof window === 'undefined') {
      setTodayStatusHovered(false)
      return
    }
    clearTodayStatusHoverCloseTimer()
    todayStatusHoverCloseTimerRef.current = window.setTimeout(() => {
      setTodayStatusHovered(false)
      todayStatusHoverCloseTimerRef.current = null
    }, 120)
  }

  useEffect(() => {
    return () => {
      if (todayStatusHoverCloseTimerRef.current !== null) {
        window.clearTimeout(todayStatusHoverCloseTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!showTodayStatusPanel || typeof window === 'undefined') return

    const updatePosition = () => {
      const rect = todayStatusButtonRef.current?.getBoundingClientRect()
      if (!rect) return
      const maxWidth = Math.max(16, window.innerWidth - rect.left - 16)
      setTodayStatusBubblePosition({
        left: rect.left,
        top: rect.top,
        width: Math.min(todayStatusBubbleWidth, maxWidth),
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [showTodayStatusPanel, todayStatusBubbleWidth])

  return (
    <div className="w-full min-w-0">
      <div className="flex items-center gap-4">
        {/* Avatar with online indicator / today-status badge */}
        <div
          data-today-status-root
          className="relative flex-shrink-0"
          style={accentVarStyle}
          aria-label={isOnline ? t('site.online') : t('site.offline')}
          onMouseEnter={keepTodayStatusHovered}
          onMouseLeave={releaseTodayStatusHovered}
        >
          <div
            className={cn(
              'relative w-[4.5rem] h-[4.5rem] rounded-full overflow-hidden border-2 ring-2 ring-background [backface-visibility:hidden] [transform:translateZ(0)]',
              !isOnline && 'border-destructive/50',
              isOnline && !onlineHex && 'border-online/60',
              // Same pattern as offline ring: semantic color at 50% on the border
              isOnline &&
                onlineHex &&
                'border-solid border-[color:color-mix(in_srgb,var(--ProfileOnlineAccent)_50%,transparent)]',
            )}
          >
            <Image
              src={avatarUrl}
              alt={resolvedName}
              width={128}
              height={128}
              sizes="72px"
              priority
              fetchPriority="high"
              className="h-full w-full object-cover"
              quality={70}
            />
          </div>
          {hasTodayStatus ? (
            <div
              className="absolute bottom-0 left-[calc(100%-1rem)] z-20"
              onMouseEnter={keepTodayStatusHovered}
              onMouseLeave={releaseTodayStatusHovered}
            >
              <motion.button
                ref={todayStatusButtonRef}
                type="button"
                onClick={() => setTodayStatusOpen((prev) => !prev)}
                onBlur={(event) => {
                  const root = event.currentTarget.closest('[data-today-status-root]')
                  if (!root?.contains(event.relatedTarget as Node | null)) {
                    setTodayStatusOpen(false)
                  }
                }}
                initial={false}
                animate={{ width: 16 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className={cn(
                  'relative flex h-4 items-center justify-start overflow-hidden rounded-full border-[3px] border-background bg-background text-[10px] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  todayStatusBusy && 'ring-2 ring-amber-300/70 ring-offset-0',
                  showTodayStatusPanel && 'opacity-0',
                )}
                style={{ transformOrigin: 'left center' }}
                title={todayStatusText.trim() || t('site.profile.todayStatusLabel')}
                aria-label={t('site.profile.todayStatusLabel')}
                aria-expanded={showTodayStatusPanel}
              >
                <span className="pointer-events-none flex h-full w-[10px] shrink-0 items-center justify-center leading-none">
                  {todayStatusEmoji}
                </span>
                <span
                  className={cn(
                    'pointer-events-none min-w-0 whitespace-nowrap pl-1 pr-1 text-[9px] font-medium leading-none text-foreground transition-opacity duration-150',
                    showTodayStatusPanel ? 'opacity-100' : 'opacity-0',
                  )}
                  style={{ fontFamily: TODAY_STATUS_TEXT_FONT_FAMILY }}
                >
                  {todayStatusText}
                </span>
                {todayStatusBusy ? (
                  <span className="sr-only">{t('site.profile.todayStatusBusy')}</span>
                ) : null}
              </motion.button>
              {typeof document !== 'undefined'
                ? createPortal(
                    <AnimatePresence initial={false}>
                      {showTodayStatusPanel ? (
                        <motion.button
                          type="button"
                          onClick={() => setTodayStatusOpen((prev) => !prev)}
                          initial={{ opacity: 0, width: 16 }}
                          animate={{
                            opacity: 1,
                            width: todayStatusBubblePosition?.width ?? 16,
                          }}
                          exit={{ opacity: 0, width: 16 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          onMouseEnter={keepTodayStatusHovered}
                          onMouseLeave={releaseTodayStatusHovered}
                          className={cn(
                            'fixed z-[9999] flex h-4 items-center justify-start overflow-hidden rounded-full border-[3px] border-background bg-background text-[10px] text-foreground shadow-sm backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                            todayStatusBusy && 'ring-2 ring-amber-300/70 ring-offset-0',
                          )}
                          style={{
                            left: todayStatusBubblePosition?.left ?? 0,
                            top: todayStatusBubblePosition?.top ?? 0,
                            transformOrigin: 'left center',
                            visibility: todayStatusBubblePosition ? 'visible' : 'hidden',
                          }}
                          title={todayStatusText.trim() || t('site.profile.todayStatusLabel')}
                          aria-label={t('site.profile.todayStatusLabel')}
                          aria-expanded={showTodayStatusPanel}
                        >
                          <span className="pointer-events-none flex h-full w-[10px] shrink-0 items-center justify-center leading-none">
                            {todayStatusEmoji}
                          </span>
                          <span
                            className="pointer-events-none whitespace-nowrap pl-1 pr-1 text-[9px] font-medium leading-none text-foreground"
                            style={{ fontFamily: TODAY_STATUS_TEXT_FONT_FAMILY }}
                          >
                            {todayStatusText}
                          </span>
                          {todayStatusBusy ? (
                            <span className="sr-only">{t('site.profile.todayStatusBusy')}</span>
                          ) : null}
                        </motion.button>
                      ) : null}
                    </AnimatePresence>,
                    document.body,
                  )
                : null}
            </div>
          ) : (
            <div
              className={cn(
                'absolute bottom-0 right-0 z-10 w-4 h-4 rounded-full border-[3px] border-background shadow-sm',
                isOnline && !onlineHex && 'bg-online',
                isOnline && !onlineHex && onlinePulse && 'animate-pulse',
                !isOnline && 'bg-destructive',
                isOnline && onlineHex && 'bg-[var(--ProfileOnlineAccent)]',
                isOnline && onlineHex && onlinePulse && 'animate-pulse',
              )}
              title={isOnline ? t('site.online') : t('site.offline')}
            />
          )}
        </div>

        {/* Name & Bio */}
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold text-foreground leading-snug">
            {resolvedName}
          </h1>
          <p className="text-sm text-muted-foreground font-light mt-0.5">
            {resolvedBio}
          </p>
        </div>
      </div>
    </div>
  )
}
