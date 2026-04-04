'use client'

import * as React from 'react'
import { motion, type HTMLMotionProps, useReducedMotion } from 'motion/react'

import {
  getSiteSectionTransition,
  getSiteSectionVariants,
} from '@/components/site-motion'
import { cn } from '@/lib/utils'

/**
 * Frosted panel matching Card tokens — improves text contrast over busy photos / gradients.
 */
export function ContentReadingPanel({
  className,
  ...props
}: HTMLMotionProps<'div'>) {
  const prefersReducedMotion = Boolean(useReducedMotion())
  const sectionTransition = getSiteSectionTransition(prefersReducedMotion)
  const sectionVariants = getSiteSectionVariants(prefersReducedMotion, {
    enterY: 8,
    exitY: 6,
    scale: 0.998,
  })

  return (
    <motion.div
      data-slot="content-reading-panel"
      className={cn(
        'rounded-lg border border-border bg-card/95 text-card-foreground shadow-sm backdrop-blur-md',
        className,
      )}
      variants={sectionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={sectionTransition}
      {...props}
    />
  )
}
