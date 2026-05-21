'use client'

import { motion, useReducedMotion } from 'motion/react'
import { useT } from 'next-i18next/client'
import { type CSSProperties, useEffect, useMemo, useState } from 'react'

import {
  getSiteSectionTransition,
  getSiteSectionVariants,
} from '@/components/site-motion'
import {
  HITOKOTO_TYPEWRITER_START_DELAY_MS,
  NOTE_BOX_CLASS,
  NOTE_SIGNATURE_CLASS,
  resolveNoteFontFamily,
} from '@/components/user-profile/note-style'
import { TypewriterNoteText } from '@/components/user-profile/typewriter-note'
import { buildHitokotoRequestUrl } from '@/lib/hitokoto'
import { cn } from '@/lib/utils'
import type { HitokotoJsonBody, UserNoteHitokotoEncode } from '@/types/hitokoto'

type Props = {
  categories: string[]
  encode: UserNoteHitokotoEncode
  fallbackNote: string
  fallbackToNote: boolean
  animationReady: boolean
  signatureFontEnabled: boolean
  signatureFontFamily?: string
  typewriterEnabled: boolean
}

export function ProfileHitokotoNote({
  categories,
  encode,
  fallbackNote,
  fallbackToNote,
  animationReady,
  signatureFontEnabled,
  signatureFontFamily,
  typewriterEnabled,
}: Props) {
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
