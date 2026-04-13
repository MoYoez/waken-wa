import { Loader2Icon } from 'lucide-react'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

function Spinner({
  className,
  'aria-label': ariaLabel,
  ...props
}: ComponentProps<'svg'>) {
  return (
    <Loader2Icon
      role="status"
      aria-label={ariaLabel}
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
