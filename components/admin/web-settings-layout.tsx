import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type WebSettingsSectionProps = {
  title: string
  description: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

type WebSettingsRowsProps = {
  children: ReactNode
  className?: string
}

type WebSettingsRowProps = {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  htmlFor?: string
  className?: string
  contentClassName?: string
  titleClassName?: string
  actionClassName?: string
}

type WebSettingsInsetProps = {
  children: ReactNode
  className?: string
}

export function WebSettingsSection({
  title,
  description,
  children,
  className,
  bodyClassName,
}: WebSettingsSectionProps) {
  return (
    <section className={cn('space-y-4 sm:space-y-5', className)}>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-wide text-foreground">{title}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div
        className={cn(
          'space-y-4 sm:rounded-xl sm:border sm:border-border/60 sm:bg-muted/[0.05] sm:p-5',
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  )
}

export function WebSettingsRows({ children, className }: WebSettingsRowsProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border/60 bg-background/70 divide-y divide-border/60',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function WebSettingsRow({
  title,
  description,
  action,
  htmlFor,
  className,
  contentClassName,
  titleClassName,
  actionClassName,
}: WebSettingsRowProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-3 py-4 sm:px-4', className)}>
      <div className={cn('min-w-0 space-y-1.5', contentClassName)}>
        {htmlFor ? (
          <Label
            htmlFor={htmlFor}
            className={cn('font-normal cursor-pointer leading-5', titleClassName)}
          >
            {title}
          </Label>
        ) : (
          <div className={cn('text-sm font-medium leading-5 text-foreground', titleClassName)}>
            {title}
          </div>
        )}
        {description ? (
          <div className="text-xs leading-relaxed text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {action ? <div className={cn('shrink-0 pt-0.5', actionClassName)}>{action}</div> : null}
    </div>
  )
}

export function WebSettingsInset({ children, className }: WebSettingsInsetProps) {
  return (
    <div className={cn('space-y-4 rounded-xl border border-border/60 bg-background/70 p-3 sm:p-4', className)}>
      {children}
    </div>
  )
}
