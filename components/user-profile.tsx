'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
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

function TypewriterNoteText({
  text,
  enabled,
  children,
}: {
  text: string
  enabled: boolean
  children: (displayText: string, animating: boolean) => ReactNode
}) {
  const [displayText, setDisplayText] = useState(enabled ? '' : text)
  const [animating, setAnimating] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const shouldAnimate = enabled && !reduceMotion && text.length > 1

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
      setDisplayText('')
      setAnimating(true)
      typingTimer = window.setInterval(() => {
        index += 1
        setDisplayText(text.slice(0, index))
        if (index >= text.length) {
          window.clearInterval(typingTimer)
          setAnimating(false)
        }
      }, 48)
    }, 0)

    return () => {
      window.clearTimeout(startTimer)
      if (typingTimer) window.clearInterval(typingTimer)
    }
  }, [shouldAnimate, text])

  return <>{children(shouldAnimate ? displayText : text, shouldAnimate || animating)}</>
}

function TypewriterCaret({ animating }: { animating: boolean }) {
  if (!animating) return null
  return (
    <span
      aria-hidden="true"
      className="ml-0.5 inline-block h-[1em] w-px translate-y-0.5 bg-current align-middle"
      style={{ animation: 'typewriter-caret-blink 1s linear infinite', willChange: 'opacity' }}
    />
  )
}

function ProfileHitokotoNote({
  categories,
  encode,
  fallbackNote,
  fallbackToNote,
  typewriterEnabled,
}: {
  categories: string[]
  encode: UserNoteHitokotoEncode
  fallbackNote: string
  fallbackToNote: boolean
  typewriterEnabled: boolean
}) {
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

  const categoriesKey = useMemo(() => JSON.stringify([...categories].sort()), [categories])

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
        className={`${NOTE_BOX_CLASS} animate-pulse`}
        variants={sectionVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={sectionTransition}
      >
        加载一言…
      </motion.p>
    )
  }

  if (phase === 'error') {
    if (fallbackToNote && fallbackNote.trim()) {
      return (
        <TypewriterNoteText text={fallbackNote} enabled={typewriterEnabled}>
          {(displayText, animating) => (
            <p className={NOTE_BOX_CLASS}>
              {displayText}
              <TypewriterCaret animating={animating} />
            </p>
          )}
        </TypewriterNoteText>
      )
    }
    return <p className={NOTE_BOX_CLASS}>一言暂不可用</p>
  }

  if (uuid) {
    return (
      <TypewriterNoteText text={text} enabled={typewriterEnabled}>
        {(displayText, animating) => (
          <p className={NOTE_BOX_CLASS}>
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
              <TypewriterCaret animating={animating} />
            </a>
          </p>
        )}
      </TypewriterNoteText>
    )
  }

  return (
    <TypewriterNoteText text={text} enabled={typewriterEnabled}>
      {(displayText, animating) => (
        <p className={NOTE_BOX_CLASS}>
          {displayText}
          <TypewriterCaret animating={animating} />
        </p>
      )}
    </TypewriterNoteText>
  )
}

export type { UserProfileNoteSectionProps } from '@/types/components'

/** Full-width note / 一言 under the profile row so text can reach the card’s right inner edge (spans past the schedule column). */
export function UserProfileNoteSection({
  note = '',
  noteHitokotoEnabled = false,
  noteTypewriterEnabled = false,
  noteHitokotoCategories = [],
  noteHitokotoEncode = 'json',
  noteHitokotoFallbackToNote = false,
}: UserProfileNoteSectionProps) {
  const prefersReducedMotion = Boolean(useReducedMotion())
  const showNoteBlock = Boolean(note.trim()) || noteHitokotoEnabled
  if (!showNoteBlock) return null

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
            typewriterEnabled={noteTypewriterEnabled}
          />
        ) : (
          <TypewriterNoteText text={note} enabled={noteTypewriterEnabled}>
            {(displayText, animating) => (
              <p className={NOTE_BOX_CLASS}>
                {displayText}
                <TypewriterCaret animating={animating} />
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
  name = 'User',
  bio = 'Building something awesome',
  avatarUrl = '/avatar.jpg',
  profileOnlineAccentColor = null,
  profileOnlinePulseEnabled = null,
}: UserProfileProps) {
  const { feed } = useSharedActivityFeed()
  const isOnline = Boolean(feed?.activeStatuses?.length)
  const onlineHex = normalizeProfileOnlineAccentColor(profileOnlineAccentColor ?? '')
  const onlinePulse = profileOnlinePulseEnabled !== false
  const accentVarStyle: CSSProperties | undefined =
    onlineHex != null
      ? ({ [PROFILE_ONLINE_ACCENT_VAR]: onlineHex } as CSSProperties)
      : undefined

  return (
    <div className="w-full min-w-0">
      <div className="flex items-center gap-4">
        {/* Avatar — online: green dot, offline: red dot */}
        <div
          className="relative flex-shrink-0"
          style={accentVarStyle}
          aria-label={isOnline ? '在线' : '离线'}
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
              alt={name}
              width={128}
              height={128}
              sizes="72px"
              className="h-full w-full object-cover"
              priority
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
            title={isOnline ? '在线' : '离线'}
          />
        </div>

        {/* Name & Bio */}
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold text-foreground leading-snug">
            {name}
          </h1>
          <p className="text-sm text-muted-foreground font-light mt-0.5">
            {bio}
          </p>
        </div>
      </div>
    </div>
  )
}
