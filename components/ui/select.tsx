'use client'

import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import * as React from 'react'

import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type SelectContextValue = {
  value?: string
  onValueChange: (v: string) => void
  open: boolean
  onOpenChange: (o: boolean) => void
  disabled?: boolean
  required?: boolean
  name?: string
  contentId: string
  labelMap: Map<string, React.ReactNode>
  contentWidth?: number
  setContentWidth: (w: number | undefined) => void
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectContext(component: string) {
  const ctx = React.useContext(SelectContext)
  if (!ctx) {
    throw new Error(`${component} must be used within <Select>`)
  }
  return ctx
}

type ItemProps = { value: string; children?: React.ReactNode }
type ContainerProps = { children?: React.ReactNode }

function collectItemLabels(node: React.ReactNode, map: Map<string, React.ReactNode>) {
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return
    if (child.type === SelectItem) {
      const p = child.props as ItemProps
      map.set(String(p.value), p.children)
      return
    }
    if (child.type === SelectGroup) {
      collectItemLabels((child.props as ContainerProps).children, map)
      return
    }
    if (child.type === SelectSeparator) return
    collectItemLabels((child.props as ContainerProps).children, map)
  })
}

function splitSelectChildren(children: React.ReactNode) {
  let triggerEl: React.ReactElement | null = null
  let contentEl: React.ReactElement | null = null
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    if (child.type === SelectTrigger) triggerEl = child
    if (child.type === SelectContent) contentEl = child
  })
  return { triggerEl, contentEl }
}

type SelectProps = {
  value?: string
  defaultValue?: string
  onValueChange?: (v: string) => void
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  required?: boolean
  name?: string
  children?: React.ReactNode
}

/**
 * Select built from Popover + cmdk Command (shadcn combobox pattern). Avoids
 * `@radix-ui/react-select` / `react-remove-scroll` issues; same composed API as before.
 */
function Select({
  value: valueProp,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen,
  onOpenChange,
  disabled,
  required,
  name,
  children,
}: SelectProps) {
  const contentId = React.useId()
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string | undefined>(
    defaultValue,
  )
  const value =
    valueProp !== undefined ? valueProp : uncontrolledValue

  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(!!defaultOpen)
  const open = openProp !== undefined ? openProp : uncontrolledOpen

  const setValue = React.useCallback(
    (v: string) => {
      if (valueProp === undefined) setUncontrolledValue(v)
      onValueChange?.(v)
    },
    [valueProp, onValueChange],
  )

  const setOpen = React.useCallback(
    (o: boolean) => {
      if (openProp === undefined) setUncontrolledOpen(o)
      onOpenChange?.(o)
    },
    [openProp, onOpenChange],
  )

  const { triggerEl, contentEl } = React.useMemo(
    () => splitSelectChildren(children),
    [children],
  )

  const labelMap = React.useMemo(() => {
    const map = new Map<string, React.ReactNode>()
    if (contentEl) {
      collectItemLabels((contentEl as React.ReactElement<ContainerProps>).props.children, map)
    }
    return map
  }, [contentEl])

  const [contentWidth, setContentWidth] = React.useState<number | undefined>()

  const ctx = React.useMemo<SelectContextValue>(
    () => ({
      value,
      onValueChange: setValue,
      open,
      onOpenChange: setOpen,
      disabled,
      required,
      name,
      contentId,
      labelMap,
      contentWidth,
      setContentWidth,
    }),
    [
      value,
      setValue,
      open,
      setOpen,
      disabled,
      required,
      name,
      contentId,
      labelMap,
      contentWidth,
    ],
  )

  return (
    <SelectContext.Provider value={ctx}>
      {name ? (
        <input
          type="hidden"
          name={name}
          value={value ?? ''}
          required={required}
          disabled={disabled}
        />
      ) : null}
      <Popover open={open} onOpenChange={setOpen} modal>
        {triggerEl}
        {contentEl}
      </Popover>
    </SelectContext.Provider>
  )
}

function SelectGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandGroup>) {
  return (
    <CommandGroup
      data-slot="select-group"
      className={className}
      {...props}
    />
  )
}

function SelectValue({
  placeholder,
  className,
  ...props
}: { placeholder?: string } & React.ComponentProps<'span'>) {
  const { value, labelMap } = useSelectContext('SelectValue')
  const label =
    value !== undefined && value !== ''
      ? labelMap.get(value) ?? value
      : null

  return (
    <span
      data-slot="select-value"
      className={cn(!label && 'text-muted-foreground', className)}
      {...props}
    >
      {label ?? placeholder}
    </span>
  )
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: React.ComponentProps<'button'> & {
  size?: 'sm' | 'default'
}) {
  const ctx = useSelectContext('SelectTrigger')
  const ref = React.useRef<HTMLButtonElement>(null)

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => ctx.setContentWidth(el.offsetWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ctx])

  return (
    <PopoverTrigger asChild>
      <button
        type="button"
        role="combobox"
        aria-expanded={ctx.open}
        aria-controls={ctx.contentId}
        aria-haspopup="listbox"
        data-slot="select-trigger"
        data-size={size}
        disabled={ctx.disabled}
        ref={ref}
        className={cn(
          "flex w-fit min-w-0 max-w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[placeholder]:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className="size-4 opacity-50" aria-hidden />
      </button>
    </PopoverTrigger>
  )
}

function SelectContent({
  className,
  children,
  position: _position,
  align = 'center',
  sideOffset = 4,
  style,
  ...props
}: Omit<React.ComponentProps<typeof PopoverContent>, 'children'> & {
  children?: React.ReactNode
  /** Ignored; kept for API compatibility with Radix Select. */
  position?: 'item-aligned' | 'popper'
}) {
  const ctx = useSelectContext('SelectContent')

  return (
    <PopoverContent
      id={ctx.contentId}
      align={align}
      sideOffset={sideOffset}
      data-slot="select-content"
      className={cn(
        'z-50 min-w-[8rem] origin-(--radix-popover-content-transform-origin) overflow-hidden rounded-md border bg-popover p-0 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
      style={{
        width: ctx.contentWidth ? `${ctx.contentWidth}px` : undefined,
        ...style,
      }}
      onCloseAutoFocus={(e) => e.preventDefault()}
      {...props}
    >
      <Command shouldFilter={false}>
        <CommandList className="max-h-[min(300px,var(--radix-popover-content-available-height,300px))] scroll-py-1 overflow-x-hidden overflow-y-auto overscroll-contain p-1">
          {children}
        </CommandList>
      </Command>
    </PopoverContent>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="select-label"
      className={cn('px-2 py-1.5 text-xs text-muted-foreground', className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  value,
  disabled,
  ...props
}: {
  value: string
  disabled?: boolean
} & Omit<React.ComponentProps<typeof CommandItem>, 'value' | 'onSelect'>) {
  const ctx = useSelectContext('SelectItem')
  const str = String(value)
  const selected = ctx.value === str

  return (
    <CommandItem
      {...props}
      data-slot="select-item"
      role="option"
      aria-selected={selected}
      value={str}
      disabled={disabled}
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className,
      )}
      onSelect={() => {
        if (disabled) return
        ctx.onValueChange(str)
        ctx.onOpenChange(false)
      }}
    >
      <span
        data-slot="select-item-indicator"
        className="absolute right-2 flex size-3.5 items-center justify-center"
      >
        {selected ? <CheckIcon className="size-4" aria-hidden /> : null}
      </span>
      {children}
    </CommandItem>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandSeparator>) {
  return (
    <CommandSeparator
      data-slot="select-separator"
      className={cn('pointer-events-none -mx-1 my-1', className)}
      {...props}
    />
  )
}

/** Kept for API compatibility; Radix scroll buttons are not used in this implementation. */
function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="select-scroll-up-button"
      className={cn('hidden', className)}
      aria-hidden
      {...props}
    />
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="select-scroll-down-button"
      className={cn('hidden', className)}
      aria-hidden
      {...props}
    />
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
