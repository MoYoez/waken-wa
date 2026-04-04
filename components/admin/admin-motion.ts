import type { Transition, Variants } from 'motion/react'

const ADMIN_MOTION_EASE = [0.22, 1, 0.36, 1] as const

export function getAdminIndicatorTransition(reducedMotion: boolean): Transition {
  if (reducedMotion) {
    return {
      duration: 0.14,
      ease: 'linear',
    }
  }

  return {
    type: 'spring',
    stiffness: 420,
    damping: 34,
    mass: 0.9,
  }
}

export function getAdminPanelTransition(reducedMotion: boolean): Transition {
  return {
    duration: reducedMotion ? 0.14 : 0.28,
    ease: reducedMotion ? 'linear' : ADMIN_MOTION_EASE,
  }
}

export function getAdminPanelVariants(reducedMotion: boolean): Variants {
  return {
    initial: {
      opacity: 0,
      y: reducedMotion ? 0 : 16,
    },
    animate: {
      opacity: 1,
      y: 0,
    },
    exit: {
      opacity: 0,
      y: reducedMotion ? 0 : 10,
    },
  }
}

export function getAdminFloatingBarVariants(reducedMotion: boolean): Variants {
  return {
    initial: {
      opacity: 0,
      y: reducedMotion ? 0 : 18,
      scale: reducedMotion ? 1 : 0.985,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
    },
    exit: {
      opacity: 0,
      y: reducedMotion ? 0 : 14,
      scale: 1,
    },
  }
}

export function getAdminSectionVariants(
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
