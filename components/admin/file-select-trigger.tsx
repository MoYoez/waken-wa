'use client'

import { type ComponentProps, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type FileSelectTriggerProps = {
  accept?: string
  buttonLabel: string
  emptyLabel: string
  id?: string
  className?: string
  textClassName?: string
  buttonVariant?: ComponentProps<typeof Button>['variant']
  buttonSize?: ComponentProps<typeof Button>['size']
  disabled?: boolean
  onSelect: (file: File | undefined) => void
}

export function FileSelectTrigger({
  accept,
  buttonLabel,
  emptyLabel,
  id,
  className,
  textClassName,
  buttonVariant = 'outline',
  buttonSize = 'default',
  disabled = false,
  onSelect,
}: FileSelectTriggerProps) {
  const generatedId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFileName, setSelectedFileName] = useState('')
  const resolvedId = id ?? generatedId

  return (
    <div
      className={cn(
        'flex w-full min-w-0 max-w-full flex-col gap-2 overflow-hidden sm:flex-row sm:items-center sm:gap-3',
        className,
      )}
    >
      <input
        ref={inputRef}
        id={resolvedId}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          setSelectedFileName(file?.name ?? '')
          onSelect(file)
          event.target.value = ''
        }}
      />
      <Button
        type="button"
        variant={buttonVariant}
        size={buttonSize}
        className="shrink-0"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {buttonLabel}
      </Button>
      <span
        className={cn(
          'min-w-0 max-w-full break-all text-xs leading-relaxed text-muted-foreground sm:flex-1 sm:basis-0',
          textClassName,
        )}
      >
        {selectedFileName || emptyLabel}
      </span>
    </div>
  )
}
