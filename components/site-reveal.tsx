'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

import {
  getSiteSectionTransition,
  getSiteSectionVariants,
} from '@/components/site-motion'
import { cn } from '@/lib/utils'

export function SiteReveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const prefersReducedMotion = Boolean(useReducedMotion())
  const transition = {
    ...getSiteSectionTransition(prefersReducedMotion),
    delay: prefersReducedMotion ? 0 : delay,
  }
  const variants = getSiteSectionVariants(prefersReducedMotion, {
    enterY: 12,
    exitY: 8,
    scale: 0.996,
  })

  return (
    <motion.div
      className={cn(className)}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={transition}
    >
      {children}
    </motion.div>
  )
}
