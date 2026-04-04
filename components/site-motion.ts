import type { Transition, Variants } from 'motion/react'

import { STANDARD_MOTION_EASE } from '@/constants/motion'

export function getSiteSectionTransition(reducedMotion: boolean): Transition {
  return {
    duration: reducedMotion ? 0.14 : 0.3,
    ease: reducedMotion ? 'linear' : STANDARD_MOTION_EASE,
  }
}

export function getSiteSectionVariants(
  reducedMotion: boolean,
  options?: {
    enterY?: number
    exitY?: number
    scale?: number
  },
): Variants {
  const enterY = options?.enterY ?? 14
  const exitY = options?.exitY ?? 10
  const scale = options?.scale ?? 0.992

  return {
    initial: {
      opacity: 0,
      y: reducedMotion ? 0 : enterY,
      scale: reducedMotion ? 1 : scale,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
    },
    exit: {
      opacity: 0,
      y: reducedMotion ? 0 : exitY,
      scale: 1,
    },
  }
}
