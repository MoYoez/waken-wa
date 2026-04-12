'use client'

import { format } from 'date-fns'
import { type ReactNode,useEffect, useState } from 'react'

import { useSiteTimeFormat } from '@/components/site-timezone-provider'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import {
  resolveScheduleHomeCardState,
  type ScheduleCourse,
  type ScheduleHomeCardState,
  type SchedulePeriodTemplateItem,
} from '@/lib/schedule-courses'
import { cn } from '@/lib/utils'

type ScheduleHomeInClassBannerProps = {
  courses: ScheduleCourse[]
  showLocation: boolean
  showTeacher: boolean
  periodTemplate?: SchedulePeriodTemplateItem[]
  /** When true, show the between-sessions “下一节” preview. Default false. */
  showNextUpcoming?: boolean
  /** Shown in the top-left when today’s classes are all over (default 正在摸鱼). */
  afterClassesLabel: string
  className?: string
}

function MetaHoverContent({
  occ,
  showLocation,
  showTeacher,
}: {
  occ: { location?: string; teacher?: string }
  showLocation: boolean
  showTeacher: boolean
}) {
  const hasLocation = Boolean(showLocation && occ.location)
  const hasTeacher = Boolean(showTeacher && occ.teacher)
  return (
    <HoverCardContent
      align="start"
      side="top"
      className="w-auto max-w-[min(18rem,calc(100vw-2rem))] space-y-2 p-3 text-sm"
    >
      {hasLocation ? (
        <div className="break-words leading-snug">
          <span className="font-medium text-foreground">地点</span>{' '}
          <span className="text-muted-foreground">{occ.location}</span>
        </div>
      ) : null}
      {hasTeacher ? (
        <div className="break-words leading-snug">
          <span className="font-medium text-foreground">教师</span>{' '}
          <span className="text-muted-foreground">{occ.teacher}</span>
        </div>
      ) : null}
    </HoverCardContent>
  )
}

/**
 * Schedule snapshot for the home column: in session, next class, rest day, or day finished.
 * Client-only so local clock and timezone match the visitor.
 */
export function ScheduleHomeInClassBanner({
  courses,
  showLocation,
  showTeacher,
  periodTemplate,
  showNextUpcoming = false,
  afterClassesLabel,
  className,
}: ScheduleHomeInClassBannerProps) {
  const { effectiveTimezone, mounted } = useSiteTimeFormat()
  const idleDoneLabel = afterClassesLabel.trim() || '正在摸鱼'
  const [cardState, setCardState] = useState<ScheduleHomeCardState | null>(null)

  useEffect(() => {
    if (!mounted) return
    const tick = () => {
      setCardState(
        resolveScheduleHomeCardState(courses, new Date(), periodTemplate, effectiveTimezone),
      )
    }
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [courses, effectiveTimezone, mounted, periodTemplate])

  if (courses.length === 0) return null
  if (!cardState) return null

  if (cardState.kind === 'upcoming_today' && !showNextUpcoming) {
    return null
  }

  const occ = cardState.kind === 'in_class' ? cardState.occ : null
  const hasLocation = Boolean(showLocation && occ?.location)
  const hasTeacher = Boolean(showTeacher && occ?.teacher)
  const wholeCardMeta = cardState.kind === 'in_class' && (hasLocation || hasTeacher)

  const cardShellClass = cn(
    'rounded-lg border border-primary/25 bg-primary/10 px-2 py-2 sm:px-2.5 sm:py-2 text-left shadow-sm box-border min-w-0',
    'flex flex-col max-h-[6.75rem] sm:max-h-[7rem] overflow-hidden outline-none',
    wholeCardMeta &&
      'cursor-default focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    className,
  )

  let topRow: ReactNode
  let bodyLine: ReactNode

  switch (cardState.kind) {
    case 'in_class': {
      const o = cardState.occ
      topRow = (
        <>
          <span className="text-xs font-medium uppercase tracking-wide text-primary/90 whitespace-nowrap sm:text-sm">
            正在上课
          </span>
          <span className="min-w-0 truncate text-right text-xs tabular-nums text-muted-foreground sm:text-sm">
            {format(o.start, 'HH:mm')} – {format(o.end, 'HH:mm')}
          </span>
        </>
      )
      bodyLine = (
        <div className="mt-1 min-w-0 shrink-0 text-base font-semibold leading-snug text-foreground line-clamp-2">
          {o.title}
        </div>
      )
      break
    }
    case 'upcoming_today': {
      const n = cardState.next
      topRow = (
        <>
          <span className="text-xs font-medium uppercase tracking-wide text-primary/90 whitespace-nowrap sm:text-sm">
            下一节
          </span>
          <span className="min-w-0 truncate text-right text-xs tabular-nums text-muted-foreground sm:text-sm">
            {format(n.start, 'HH:mm')} – {format(n.end, 'HH:mm')}
          </span>
        </>
      )
      bodyLine = (
        <div className="mt-1 min-w-0 shrink-0 text-base font-semibold leading-snug text-foreground line-clamp-2">
          {n.title}
        </div>
      )
      break
    }
    case 'after_classes_today': {
      topRow = (
        <span className="w-full min-w-0 truncate text-xs font-medium tracking-wide text-primary/90 sm:text-sm">
          {idleDoneLabel}
        </span>
      )
      bodyLine = (
        <div className="mt-1 min-w-0 shrink-0 text-base font-semibold leading-snug text-foreground line-clamp-2">
          今天已经没课啦！
        </div>
      )
      break
    }
    case 'rest_tomorrow_has':
    case 'rest_no_tomorrow': {
      topRow = (
        <span className="w-full min-w-0 truncate text-xs font-medium tracking-wide text-primary/90 sm:text-sm">
          {idleDoneLabel}
        </span>
      )
      const msg =
        cardState.kind === 'rest_tomorrow_has' ? '明天有课哦~' : '今天没课~'
      bodyLine = (
        <div className="mt-1 min-w-0 shrink-0 text-base font-semibold leading-snug text-foreground line-clamp-2">
          {msg}
        </div>
      )
      break
    }
  }

  const cardInner = (
    <>
      {topRow != null ? (
        <div className="flex w-full min-w-0 shrink-0 items-center justify-between gap-2 leading-tight">
          {topRow}
        </div>
      ) : null}
      {bodyLine}
    </>
  )

  if (wholeCardMeta && occ) {
    return (
      <HoverCard openDelay={180} closeDelay={120}>
        <HoverCardTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            aria-label="悬停查看地点与教师"
            className={cardShellClass}
          >
            {cardInner}
          </div>
        </HoverCardTrigger>
        <MetaHoverContent occ={occ} showLocation={showLocation} showTeacher={showTeacher} />
      </HoverCard>
    )
  }

  return <div className={cardShellClass}>{cardInner}</div>
}
