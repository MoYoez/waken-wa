'use client'

import { type ReactNode, useEffect, useState } from 'react'

const TYPEWRITER_BASE_DELAY_MS = 54
const TYPEWRITER_JITTER_MS = 28
const TYPEWRITER_SPACE_BONUS_MS = 18
const TYPEWRITER_PUNCTUATION_BONUS_MS = 72

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

type Props = {
  text: string
  enabled: boolean
  readyToStart?: boolean
  startDelayMs?: number
  speedMultiplier?: number
  pendingPlaceholder?: ReactNode
  children: (displayText: string) => ReactNode
}

export function TypewriterNoteText({
  text,
  enabled,
  readyToStart = true,
  startDelayMs = 0,
  speedMultiplier = 1,
  pendingPlaceholder,
  children,
}: Props) {
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
