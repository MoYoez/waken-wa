'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { useT } from 'next-i18next/client'
import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from 'react'

import { useSharedActivityFeed } from '@/components/activity-feed-provider'
import {
  getSiteSectionTransition,
  getSiteSectionVariants,
} from '@/components/site-motion'
import { buildHitokotoRequestUrl } from '@/lib/hitokoto'
import {
  normalizeProfileOnlineAccentColor,
  PROFILE_ONLINE_ACCENT_VAR,
} from '@/lib/profile-online-accent-color'
import { cn } from '@/lib/utils'
import type { UserProfileNoteSectionProps } from '@/types/components'
import type { HitokotoJsonBody, UserNoteHitokotoEncode } from '@/types/hitokoto'

/** One step smaller than name (`text-base`); same weight/color as name. */
const NOTE_BOX_CLASS =
  'block w-full min-w-0 max-w-full break-words text-sm font-semibold text-foreground leading-snug border-l-2 border-primary pl-4 pr-0'
const NOTE_SIGNATURE_CLASS = 'text-[1.1rem] font-normal leading-[1.8]'
const NOTE_SIGNATURE_FONT_STACK = 'Satisfy, var(--font-sans)'
const HITOKOTO_TYPEWRITER_START_DELAY_MS = 420
const NOTE_ANIMATION_GATE_TIMEOUT_MS = 2200
const NOTE_ANIMATION_GATE_SETTLE_MS = 160

const TYPEWRITER_BASE_DELAY_MS = 54
const TYPEWRITER_JITTER_MS = 28
const TYPEWRITER_SPACE_BONUS_MS = 18
const TYPEWRITER_PUNCTUATION_BONUS_MS = 72

function isPublicPageLoadingActive(): boolean {
  if (typeof document === 'undefined') return false
  if (document.documentElement.dataset.publicPageLoading === 'true') return true
  return document.querySelector('.public-page-loader.is-visible') !== null
}

function getTypewriterDelayMs(char: string, speedMultiplier = 1) {
  const jitter = Math.floor(Math.random() * (TYPEWRITER_JITTER_MS * 2 + 1)) - TYPEWRITER_JITTER_MS

  if (/\s/.test(char)) {
    return Math.max(
      18,
      Math.round((TYPEWRITER_BASE_DELAY_MS + TYPEWRITER_SPACE_BONUS_MS + jitter) * speedMultiplier),
    )
  }

  if (/[，。！？；：、,.!?;:~]/.test(char)) {
    return Math.max(
      18,
      Math.round(
        (TYPEWRITER_BASE_DELAY_MS + TYPEWRITER_PUNCTUATION_BONUS_MS + jitter) * speedMultiplier,
      ),
    )
  }

  return Math.max(18, Math.round((TYPEWRITER_BASE_DELAY_MS + jitter) * speedMultiplier))
}

function resolveNoteFontFamily(enabled: boolean, overrideFontFamily?: string) {
  if (!enabled) return undefined
  const override = String(overrideFontFamily ?? '').trim()
  return override || NOTE_SIGNATURE_FONT_STACK
}

function TypewriterNoteText({
  text,
  enabled,
  readyToStart = true,
  startDelayMs = 0,
  speedMultiplier = 1,
  pendingPlaceholder,
  children,
}: {
  text: string
  enabled: boolean
  readyToStart?: boolean
  startDelayMs?: number
  speedMultiplier?: number
  pendingPlaceholder?: ReactNode
  children: (displayText: string) => ReactNode
}) {
  const [typingState, setTypingState] = useState({ key: '', displayText: '' })
  const [reduceMotion, setReduceMotion] = useState(false)
  const shouldAnimate = enabled && readyToStart && !reduceMotion && text.length > 1
  const shouldHold = enabled && !readyToStart && !reduceMotion && text.length > 1
  const typingKey = shouldAnimate ? `${startDelayMs}:${speedMultiplier}:${text}` : ''
  const displayText = typingState.key === typingKey ? typingState.displayText : ''

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduceMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!shouldAnimate) return

    let index = 0
    let typingTimer = 0
    const startTimer = window.setTimeout(() => {
      const step = () => {
        index += 1
        setTypingState({
          key: typingKey,
          displayText: text.slice(0, index),
        })
        if (index >= text.length) {
          return
        }
        typingTimer = window.setTimeout(
          step,
          getTypewriterDelayMs(text[index] ?? '', speedMultiplier),
        )
      }

      step()
    }, startDelayMs)

    return () => {
      window.clearTimeout(startTimer)
      if (typingTimer) window.clearTimeout(typingTimer)
    }
  }, [shouldAnimate, speedMultiplier, startDelayMs, text, typingKey])

  if (shouldHold) {
    return <>{pendingPlaceholder ?? children('')}</>
  }

  return <>{children(shouldAnimate ? displayText : text)}</>
}

function useProfileNoteAnimationReady({
  enabled,
  imageSrc,
  waitForFonts,
}: {
  enabled: boolean
  imageSrc?: string
  waitForFonts?: boolean
}) {
  const gateKey = enabled ? `${String(imageSrc ?? '').trim()}::${waitForFonts ? 'fonts' : 'plain'}` : ''
  const [readyGateKey, setReadyGateKey] = useState('')
  const ready = !enabled || readyGateKey === gateKey

  useEffect(() => {
    if (!enabled) return

    if (typeof window === 'undefined') return

    const src = String(imageSrc ?? '').trim()
    let cancelled = false
    let settled = false
    let settleTimer = 0
    let timeoutTimer = 0
    const cleanups: Array<() => void> = []
    let pendingCount = 0

    const settle = () => {
      if (cancelled || settled) return
      settled = true
      settleTimer = window.setTimeout(() => {
        if (!cancelled) setReadyGateKey(gateKey)
      }, NOTE_ANIMATION_GATE_SETTLE_MS)
    }

    const track = (promise: Promise<unknown>, cleanup?: () => void) => {
      pendingCount += 1
      if (cleanup) cleanups.push(cleanup)
      void promise.finally(() => {
        pendingCount -= 1
        if (pendingCount <= 0) {
          settle()
        }
      })
    }

    if (src) {
      const imageReady = new Promise<void>((resolve) => {
        const probe = new window.Image()

        const finish = () => {
          probe.onload = null
          probe.onerror = null
          resolve()
        }

        const finalize = () => {
          if (typeof probe.decode === 'function') {
            void probe.decode().catch(() => undefined).finally(finish)
            return
          }
          finish()
        }

        probe.onload = finalize
        probe.onerror = finish
        probe.src = src

        if (probe.complete && probe.naturalWidth > 0) {
          finalize()
        }
      })

      track(imageReady)
    }

    if (waitForFonts && typeof document !== 'undefined' && 'fonts' in document) {
      const fontSet = document.fonts
      track(fontSet.ready)
    }

    if (pendingCount === 0) {
      settle()
    } else {
      timeoutTimer = window.setTimeout(settle, NOTE_ANIMATION_GATE_TIMEOUT_MS)
    }

    return () => {
      cancelled = true
      window.clearTimeout(settleTimer)
      window.clearTimeout(timeoutTimer)
      for (const cleanup of cleanups) cleanup()
    }
  }, [enabled, gateKey, imageSrc, waitForFonts])

  return ready
}

function usePublicPageNoteAnimationReady(enabled: boolean) {
  const [ready, setReady] = useState(() => !enabled || !isPublicPageLoadingActive())

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return

    const sync = () => {
      setReady(!isPublicPageLoadingActive())
    }

    sync()

    const rootObserver = new MutationObserver(sync)
    rootObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-public-page-loading'],
    })

    const bodyObserver = new MutationObserver(sync)
    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => {
      rootObserver.disconnect()
      bodyObserver.disconnect()
    }
  }, [enabled])

  return !enabled || ready
}

function ProfileHitokotoNote({
  categories,
  encode,
  fallbackNote,
  fallbackToNote,
  animationReady,
  signatureFontEnabled,
  signatureFontFamily,
  typewriterEnabled,
}: {
  categories: string[]
  encode: UserNoteHitokotoEncode
  fallbackNote: string
  fallbackToNote: boolean
  animationReady: boolean
  signatureFontEnabled: boolean
  signatureFontFamily?: string
  typewriterEnabled: boolean
}) {
  const { t } = useT('common')
  const prefersReducedMotion = Boolean(useReducedMotion())
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [text, setText] = useState('')
  const [uuid, setUuid] = useState<string | null>(null)
  const sectionTransition = getSiteSectionTransition(prefersReducedMotion)
  const sectionVariants = getSiteSectionVariants(prefersReducedMotion, {
    enterY: 8,
    exitY: 6,
    scale: 0.998,
  })
  const noteFontFamily = resolveNoteFontFamily(signatureFontEnabled, signatureFontFamily)
  const noteClassName = cn(NOTE_BOX_CLASS, signatureFontEnabled && NOTE_SIGNATURE_CLASS)
  const noteStyle = noteFontFamily ? ({ fontFamily: noteFontFamily } as CSSProperties) : undefined

  const categoriesKey = useMemo(() => JSON.stringify([...categories].sort()), [categories])
  const loadingPlaceholder = (
    <p className={cn(noteClassName, 'animate-pulse')} style={noteStyle}>
      {t('site.note.loadingHitokoto')}
    </p>
  )

  useEffect(() => {
    const ac = new AbortController()
    let cancelled = false
    setPhase('loading')
    const cats = JSON.parse(categoriesKey) as string[]
    const url = buildHitokotoRequestUrl(cats, encode)

    ;(async () => {
      try {
        const res = await fetch(url, { signal: ac.signal })
        if (!res.ok) throw new Error('hitokoto http')
        if (encode === 'text') {
          const t = (await res.text()).trim()
          if (!cancelled) {
            setText(t)
            setUuid(null)
            setPhase(t ? 'ready' : 'error')
          }
          return
        }
        const data = (await res.json()) as HitokotoJsonBody
        const t = String(data.hitokoto ?? '').trim()
        const u = typeof data.uuid === 'string' && data.uuid.length > 0 ? data.uuid : null
        if (!cancelled) {
          setText(t)
          setUuid(u)
          setPhase(t ? 'ready' : 'error')
        }
      } catch {
        if (!cancelled) setPhase('error')
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [categoriesKey, encode])

  if (phase === 'loading') {
    return (
      <motion.p
        className={cn(noteClassName, 'animate-pulse')}
        style={noteStyle}
        variants={sectionVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={sectionTransition}
      >
        {t('site.note.loadingHitokoto')}
      </motion.p>
    )
  }

  if (phase === 'error') {
    if (fallbackToNote && fallbackNote.trim()) {
      return (
        <TypewriterNoteText
          text={fallbackNote}
          enabled={typewriterEnabled}
          readyToStart={animationReady}
          startDelayMs={HITOKOTO_TYPEWRITER_START_DELAY_MS}
          pendingPlaceholder={loadingPlaceholder}
        >
          {(displayText) => (
            <p className={noteClassName} style={noteStyle}>
              {displayText}
            </p>
          )}
        </TypewriterNoteText>
      )
    }
    return (
      <p className={noteClassName} style={noteStyle}>
        {t('site.note.hitokotoUnavailable')}
      </p>
    )
  }

  if (uuid) {
    return (
      <TypewriterNoteText
        text={text}
        enabled={typewriterEnabled}
        readyToStart={animationReady}
        startDelayMs={HITOKOTO_TYPEWRITER_START_DELAY_MS}
        speedMultiplier={1.7}
        pendingPlaceholder={loadingPlaceholder}
      >
        {(displayText) => (
          <p className={noteClassName} style={noteStyle}>
            <a
              href={`https://hitokoto.cn/?uuid=${encodeURIComponent(uuid)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-block max-w-full rounded-sm pb-0.5',
                'bg-gradient-to-r from-primary to-primary bg-left-bottom bg-no-repeat',
                '[background-size:0%_2px] transition-[background-size] duration-300 ease-out',
                'hover:[background-size:100%_2px]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'focus-visible:[background-size:100%_2px]',
              )}
            >
              {displayText}
            </a>
          </p>
        )}
      </TypewriterNoteText>
    )
  }

  return (
    <TypewriterNoteText
      text={text}
      enabled={typewriterEnabled}
      readyToStart={animationReady}
      startDelayMs={HITOKOTO_TYPEWRITER_START_DELAY_MS}
      speedMultiplier={1.7}
      pendingPlaceholder={loadingPlaceholder}
    >
      {(displayText) => (
        <p className={noteClassName} style={noteStyle}>
          {displayText}
        </p>
      )}
    </TypewriterNoteText>
  )
}

export type { UserProfileNoteSectionProps } from '@/types/components'

/** Full-width note block under the profile row so text can reach the card's right inner edge. */
export function UserProfileNoteSection({
  note = '',
  avatarUrl = '',
  noteHitokotoEnabled = false,
  noteTypewriterEnabled = false,
  noteSignatureFontEnabled = false,
  noteSignatureFontFamily = '',
  noteHitokotoCategories = [],
  noteHitokotoEncode = 'json',
  noteHitokotoFallbackToNote = false,
}: UserProfileNoteSectionProps) {
  const prefersReducedMotion = Boolean(useReducedMotion())
  const showNoteBlock = Boolean(note.trim()) || noteHitokotoEnabled
  const hitokotoAnimationReady = useProfileNoteAnimationReady({
    enabled: noteHitokotoEnabled && noteTypewriterEnabled,
    imageSrc: avatarUrl,
    waitForFonts: noteSignatureFontEnabled,
  })
  const publicPageAnimationReady = usePublicPageNoteAnimationReady(noteTypewriterEnabled)
  if (!showNoteBlock) return null
  const noteFontFamily = resolveNoteFontFamily(
    noteSignatureFontEnabled,
    noteSignatureFontFamily,
  )
  const noteClassName = cn(NOTE_BOX_CLASS, noteSignatureFontEnabled && NOTE_SIGNATURE_CLASS)
  const noteStyle = noteFontFamily ? ({ fontFamily: noteFontFamily } as CSSProperties) : undefined

  const sectionTransition = getSiteSectionTransition(prefersReducedMotion)
  const sectionVariants = getSiteSectionVariants(prefersReducedMotion, {
    enterY: 10,
    exitY: 8,
    scale: 0.998,
  })

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={noteHitokotoEnabled ? 'profile-hitokoto-note' : 'profile-static-note'}
        className="w-full min-w-0 max-w-full"
        variants={sectionVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={sectionTransition}
      >
        {noteHitokotoEnabled ? (
            <ProfileHitokotoNote
              categories={noteHitokotoCategories}
              encode={noteHitokotoEncode}
              fallbackNote={note}
              fallbackToNote={noteHitokotoFallbackToNote}
              animationReady={hitokotoAnimationReady && publicPageAnimationReady}
              signatureFontEnabled={noteSignatureFontEnabled}
              signatureFontFamily={noteSignatureFontFamily}
              typewriterEnabled={noteTypewriterEnabled}
            />
          ) : (
          <TypewriterNoteText
            text={note}
            enabled={noteTypewriterEnabled}
            readyToStart={publicPageAnimationReady}
          >
            {(displayText) => (
              <p className={noteClassName} style={noteStyle}>
                {displayText}
              </p>
            )}
          </TypewriterNoteText>
        )}
      </motion.div>
    </AnimatePresence>
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
}

export function UserProfile({
  name,
  bio,
  avatarUrl = '/avatar.jpg',
  profileOnlineAccentColor = null,
  profileOnlinePulseEnabled = null,
}: UserProfileProps) {
  const { t } = useT('common')
  const { feed } = useSharedActivityFeed()
  const isOnline = Boolean(feed?.activeStatuses?.length)
  const onlineHex = normalizeProfileOnlineAccentColor(profileOnlineAccentColor ?? '')
  const onlinePulse = profileOnlinePulseEnabled !== false
  const accentVarStyle: CSSProperties | undefined =
    onlineHex != null
      ? ({ [PROFILE_ONLINE_ACCENT_VAR]: onlineHex } as CSSProperties)
      : undefined
  const resolvedName = name?.trim() || t('site.profile.defaultName')
  const resolvedBio = bio?.trim() || t('site.profile.defaultBio')

  return (
    <div className="w-full min-w-0">
      <div className="flex items-center gap-4">
        {/* Avatar — online: green dot, offline: red dot */}
        <div
          className="relative flex-shrink-0"
          style={accentVarStyle}
          aria-label={isOnline ? t('site.online') : t('site.offline')}
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
              loading="eager"
              className="h-full w-full object-cover"
              quality={92}
            />
          </div>
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
