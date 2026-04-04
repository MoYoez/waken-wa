'use client'

import { Autocomplete as AutocompletePrimitive } from '@base-ui/react'
import { ChevronDownIcon, XIcon } from 'lucide-react'

import { useDialogPortalContainer } from '@/components/ui/dialog'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { cn } from '@/lib/utils'

type AutocompleteProps = {
  items: readonly string[]
  value: string
  onValueChange: (value: string) => void
  id?: string
  placeholder?: string
  className?: string
  inputClassName?: string
  contentClassName?: string
  disabled?: boolean
  emptyText?: string
  showClear?: boolean
  openOnInputClick?: boolean
}

function Autocomplete({
  items,
  value,
  onValueChange,
  id,
  placeholder,
  className,
  inputClassName,
  contentClassName,
  disabled = false,
  emptyText = 'No matching items.',
  showClear = false,
  openOnInputClick = true,
}: AutocompleteProps) {
  const dialogPortalContainer = useDialogPortalContainer()

  return (
    <div className={cn('w-full', className)}>
      <AutocompletePrimitive.Root
        items={items}
        value={value}
        onValueChange={onValueChange}
        openOnInputClick={openOnInputClick}
      >
        <InputGroup className="w-auto">
          <AutocompletePrimitive.Input
            id={id}
            placeholder={placeholder}
            disabled={disabled}
            render={<InputGroupInput className={inputClassName} disabled={disabled} />}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              variant="ghost"
              asChild
              data-slot="input-group-button"
              className="group-has-data-[slot=autocomplete-clear]/input-group:hidden data-pressed:bg-transparent"
              disabled={disabled}
            >
              <AutocompletePrimitive.Trigger data-slot="autocomplete-trigger">
                <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
              </AutocompletePrimitive.Trigger>
            </InputGroupButton>
            {showClear ? (
              <InputGroupButton
                type="button"
                variant="ghost"
                size="icon-xs"
                data-slot="autocomplete-clear"
                className={cn(!value && 'hidden')}
                disabled={disabled}
                onClick={() => onValueChange('')}
              >
                <XIcon className="pointer-events-none" />
              </InputGroupButton>
            ) : null}
          </InputGroupAddon>
        </InputGroup>

        <AutocompletePrimitive.Portal container={dialogPortalContainer ?? undefined}>
          <AutocompletePrimitive.Positioner
            side="bottom"
            sideOffset={6}
            align="start"
            alignOffset={0}
            className="isolate z-50"
          >
            <AutocompletePrimitive.Popup
              data-slot="autocomplete-content"
              className={cn(
                'group/combobox-content relative max-h-96 w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] origin-(--transform-origin) overflow-hidden rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
                contentClassName,
              )}
            >
              <AutocompletePrimitive.Empty
                data-slot="autocomplete-empty"
                className="hidden w-full justify-center py-2 text-center text-sm text-muted-foreground group-data-empty/combobox-content:flex"
              >
                {emptyText}
              </AutocompletePrimitive.Empty>
              <AutocompletePrimitive.List
                data-slot="autocomplete-list"
                className="max-h-[min(calc(--spacing(96)---spacing(9)),calc(var(--available-height)---spacing(9)))] scroll-py-1 overflow-y-auto p-1 data-empty:p-0"
              >
                {(item: string) => (
                  <AutocompletePrimitive.Item
                    key={item}
                    value={item}
                    data-slot="autocomplete-item"
                    className="relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  >
                    {item}
                  </AutocompletePrimitive.Item>
                )}
              </AutocompletePrimitive.List>
            </AutocompletePrimitive.Popup>
          </AutocompletePrimitive.Positioner>
        </AutocompletePrimitive.Portal>
      </AutocompletePrimitive.Root>
    </div>
  )
}

export { Autocomplete }
