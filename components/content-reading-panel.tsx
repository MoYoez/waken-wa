import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Frosted panel matching Card tokens — improves text contrast over busy photos / gradients.
 */
export function ContentReadingPanel({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="content-reading-panel"
      className={cn(
        'rounded-lg border border-border bg-card/95 text-card-foreground shadow-sm backdrop-blur-md',
        className,
      )}
      {...props}
    />
  )
}
