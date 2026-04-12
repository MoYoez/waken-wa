'use client'

import { addDays, format, startOfWeek } from 'date-fns'

import { useSiteTimeFormat } from '@/components/site-timezone-provider'
import type { ScheduleOccurrence, SchedulePeriodTemplateItem } from '@/lib/schedule-courses'
import { cn } from '@/lib/utils'

/** Vertical scale: pixels per 15 minutes in the grid body (lower = shorter timetable). */
const GRID_ROW_PX = 16
const PX_PER_MINUTE = GRID_ROW_PX / 15
/** Sticky day header height (two lines); decoupled from grid density. */
const HEADER_BAND_PX = 30
const DEFAULT_START_MIN = 8 * 60
const DEFAULT_END_MIN = 22 * 60
const AXIS_STEP_MIN = 30
const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

function formatMinuteLabel(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function floorToStep(minute: number, step: number): number {
  return Math.floor(minute / step) * step
}

function ceilToStep(minute: number, step: number): number {
  return Math.ceil(minute / step) * step
}

function minutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

function occurrenceLayoutKey(o: ScheduleOccurrence): string {
  return `${o.courseId}-${o.start.getTime()}`
}

function maxConcurrentOnDay(events: ScheduleOccurrence[]): number {
  if (events.length === 0) return 1
  type Pt = { t: number; d: number }
  const pts: Pt[] = []
  for (const e of events) {
    pts.push({ t: e.start.getTime(), d: 1 })
    pts.push({ t: e.end.getTime(), d: -1 })
  }
  pts.sort((a, b) => (a.t === b.t ? a.d - b.d : a.t - b.t))
  let cur = 0
  let mx = 0
  for (const p of pts) {
    cur += p.d
    mx = Math.max(mx, cur)
  }
  return Math.max(1, mx)
}

function assignLanesForDay(events: ScheduleOccurrence[]): Map<string, number> {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime())
  const laneEndMs: number[] = []
  const map = new Map<string, number>()
  for (const o of sorted) {
    const st = o.start.getTime()
    const en = o.end.getTime()
    let lane = -1
    for (let i = 0; i < laneEndMs.length; i += 1) {
      if (laneEndMs[i] <= st) {
        lane = i
        laneEndMs[i] = en
        break
      }
    }
    if (lane < 0) {
      lane = laneEndMs.length
      laneEndMs.push(en)
    }
    map.set(occurrenceLayoutKey(o), lane)
  }
  return map
}

function computeBounds(
  periodTemplate: SchedulePeriodTemplateItem[],
  occurrences: ScheduleOccurrence[],
): { start: number; end: number } {
  let start = DEFAULT_START_MIN
  let end = DEFAULT_END_MIN
  for (const p of periodTemplate) {
    start = Math.min(start, parseHm(p.startTime))
    end = Math.max(end, parseHm(p.endTime))
  }
  for (const o of occurrences) {
    start = Math.min(start, minutesFromMidnight(o.start))
    end = Math.max(end, minutesFromMidnight(o.end))
  }
  if (end <= start) end = start + 60
  return { start, end }
}

type WeekTimetableGridProps = {
  weekRef: Date
  periodTemplate: SchedulePeriodTemplateItem[]
  occurrences: ScheduleOccurrence[]
  className?: string
}

export function WeekTimetableGrid({
  weekRef,
  periodTemplate,
  occurrences,
  className,
}: WeekTimetableGridProps) {
  const { toDisplayWallClockDate } = useSiteTimeFormat()
  const weekStart = startOfWeek(weekRef, { weekStartsOn: 1 })
  const columnDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const bounds = computeBounds(periodTemplate, occurrences)
  const globalStart = floorToStep(bounds.start, AXIS_STEP_MIN)
  const globalEnd = ceilToStep(bounds.end, AXIS_STEP_MIN)
  const totalMinutes = globalEnd - globalStart
  const totalHeight = Math.max(1, totalMinutes) * PX_PER_MINUTE

  const timeLabels: { m: number; text: string }[] = []
  for (let m = globalStart; m < globalEnd; m += AXIS_STEP_MIN) {
    timeLabels.push({ m, text: formatMinuteLabel(m) })
  }

  const periodBoundaries = Array.from(
    new Set(
      periodTemplate.flatMap((p) => [parseHm(p.startTime), parseHm(p.endTime)]).filter((m) => (
        m > globalStart && m < globalEnd
      )),
    ),
  ).sort((a, b) => a - b)

  const byColumn = columnDays.map((day) => {
    const key = format(day, 'yyyy-MM-dd')
    return occurrences.filter((o) => format(o.start, 'yyyy-MM-dd') === key)
  })

  const todayYmd = format(toDisplayWallClockDate(new Date()), 'yyyy-MM-dd')

  return (
    <div
      className={cn(
        'rounded-lg border border-border/70 bg-card shadow-sm overflow-x-auto',
        className,
      )}
    >
      <div className="min-w-[600px] flex text-[11px]">
        <div
          className="shrink-0 w-10 border-r border-border/50 bg-muted/20 text-muted-foreground"
          style={{ paddingTop: HEADER_BAND_PX }}
        >
          {timeLabels.map(({ m, text }, i) => (
            <div
              key={`${m}-${i}`}
              className="flex items-start justify-end border-t border-border/40 pt-0.5 pr-1 text-[9px] tabular-nums text-muted-foreground/90"
              style={{
                height: AXIS_STEP_MIN * PX_PER_MINUTE,
              }}
            >
              {text}
            </div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 border-l border-border/50 bg-card/30">
          {columnDays.map((day, col) => {
            const dayEvents = byColumn[col]
            const maxLanes = maxConcurrentOnDay(dayEvents)
            const laneByKey = assignLanesForDay(dayEvents)
            const isToday = format(day, 'yyyy-MM-dd') === todayYmd
            return (
              <div
                key={col}
                className={cn(
                  'relative border-r border-border/40 last:border-r-0',
                  isToday
                    ? 'bg-primary/[0.05] ring-1 ring-inset ring-primary/15'
                    : 'bg-background/40',
                )}
                style={{ minHeight: totalHeight + HEADER_BAND_PX }}
              >
                <div
                  className={cn(
                    'sticky top-0 z-20 flex flex-col items-center justify-center border-b border-border/50 py-0.5 text-center font-medium leading-tight text-foreground',
                    isToday ? 'bg-muted/50' : 'bg-muted/30',
                  )}
                  style={{ height: HEADER_BAND_PX }}
                >
                  <div className="text-[10px]">{WEEK_LABELS[col]}</div>
                  <div className="text-[9px] font-normal tabular-nums text-muted-foreground">
                    {format(day, 'M/d')}
                  </div>
                </div>
                <div className="relative" style={{ height: totalHeight }}>
                  {timeLabels.map(({ m }) => {
                    if (m === globalStart) return null
                    const y = (m - globalStart) * PX_PER_MINUTE
                    return (
                      <div
                        key={`axis-${m}`}
                        className="absolute left-0 right-0 border-t border-border/30 pointer-events-none"
                        style={{ top: y }}
                      />
                    )
                  })}
                  {periodBoundaries.map((m) => {
                    const y = (m - globalStart) * PX_PER_MINUTE
                    return (
                      <div
                        key={`period-${m}`}
                        className="absolute left-0 right-0 border-t border-dashed border-primary/35 pointer-events-none"
                        style={{ top: y }}
                      />
                    )
                  })}
                  {dayEvents.map((o, idx) => {
                    const sm = minutesFromMidnight(o.start)
                    const em = minutesFromMidnight(o.end)
                    const top = (sm - globalStart) * PX_PER_MINUTE
                    const h = Math.max((em - sm) * PX_PER_MINUTE, GRID_ROW_PX * 0.85)
                    const lane = laneByKey.get(occurrenceLayoutKey(o)) ?? 0
                    const laneW = 100 / maxLanes
                    const gapPx = 2
                    const leftPct = lane * laneW
                    const titleSuffix =
                      o.sessionCount && o.sessionCount > 1 && o.sessionOrdinal
                        ? ` · 第${o.sessionOrdinal}/${o.sessionCount}段`
                        : ''
                    return (
                      <div
                        key={`${o.courseId}-${o.start.toISOString()}-${idx}`}
                        className="absolute rounded border border-border/45 border-l-2 border-l-primary bg-primary/[0.08] px-1 py-px text-[10px] leading-tight text-foreground shadow-sm overflow-hidden z-10 box-border"
                        style={{
                          top,
                          height: h,
                          left: `calc(${leftPct}% + ${gapPx / 2}px)`,
                          width: `calc(${laneW}% - ${gapPx}px)`,
                        }}
                        title={`${o.title}${titleSuffix}${o.location ? ` · ${o.location}` : ''}${o.teacher ? ` · ${o.teacher}` : ''}`}
                      >
                        <div className="flex items-start justify-between gap-0.5 min-w-0">
                          <div className="font-medium truncate min-w-0 flex-1">{o.title}</div>
                          {o.sessionCount && o.sessionCount > 1 && o.sessionOrdinal ? (
                            <span className="shrink-0 rounded bg-primary/20 px-0.5 text-[9px] tabular-nums text-primary">
                              {o.sessionOrdinal}/{o.sessionCount}
                            </span>
                          ) : null}
                        </div>
                        <div className="tabular-nums text-[9px] text-muted-foreground">
                          {format(o.start, 'HH:mm')}–{format(o.end, 'HH:mm')}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
