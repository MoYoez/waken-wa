import type { CSSProperties, ReactNode } from 'react'

import { cn } from '@/lib/utils'

type SiteRevealProps = {
  children: ReactNode
  className?: string
  /** Delay in seconds (matches the previous motion API). */
  delay?: number
}

export function SiteReveal({ children, className, delay = 0 }: SiteRevealProps) {
  const style: CSSProperties | undefined =
    delay > 0 ? { animationDelay: `${delay}s` } : undefined

  return (
    <div className={cn('site-reveal', className)} style={style}>
      {children}
    </div>
  )
}
