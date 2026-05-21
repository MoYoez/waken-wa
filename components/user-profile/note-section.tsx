'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { CSSProperties } from 'react'

import {
  getSiteSectionTransition,
  getSiteSectionVariants,
} from '@/components/site-motion'
import {
  useProfileNoteAnimationReady,
  usePublicPageNoteAnimationReady,
} from '@/components/user-profile/note-animation-ready'
import {
  NOTE_BOX_CLASS,
  NOTE_SIGNATURE_CLASS,
  resolveNoteFontFamily,
} from '@/components/user-profile/note-style'
import { ProfileHitokotoNote } from '@/components/user-profile/profile-hitokoto-note'
import { TypewriterNoteText } from '@/components/user-profile/typewriter-note'
import { cn } from '@/lib/utils'
import type { UserProfileNoteSectionProps } from '@/types/components'

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
