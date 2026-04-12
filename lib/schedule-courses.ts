import {
  addDays,
  addMinutes,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  parse,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import { z } from 'zod'

import { toWallClockDate } from '@/lib/timezone'

/** Monday = 0, Sunday = 6 */
export const WEEKDAY_MON0_MAX = 6

export const SCHEDULE_SLOT_MINUTES_ALLOWED = [15, 30, 45, 60] as const

export type ScheduleSlotMinutes = (typeof SCHEDULE_SLOT_MINUTES_ALLOWED)[number]

export const MAX_SCHEDULE_COURSES = 200
export const MAX_SCHEDULE_TITLE_LEN = 120
export const MAX_SCHEDULE_LOCATION_LEN = 200
export const MAX_SCHEDULE_TEACHER_LEN = 120
export const MAX_SCHEDULE_ICS_BYTES = 512 * 1024
export const MAX_SCHEDULE_PERIODS = 24

const timeHm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid HH:mm')
const dateYmd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid YYYY-MM-DD')

export const MAX_TIME_SESSIONS_PER_COURSE = 12

export const scheduleTimeSessionSchema = z.object({
  startTime: timeHm,
  endTime: timeHm,
})

export type ScheduleTimeSession = z.infer<typeof scheduleTimeSessionSchema>

export const scheduleCourseSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(MAX_SCHEDULE_TITLE_LEN),
  location: z.string().max(MAX_SCHEDULE_LOCATION_LEN).optional(),
  teacher: z.string().max(MAX_SCHEDULE_TEACHER_LEN).optional(),
  /** 0 = Monday … 6 = Sunday */
  weekday: z.number().int().min(0).max(WEEKDAY_MON0_MAX),
  startTime: timeHm,
  endTime: timeHm,
  /** Multiple slots on the same weekday (e.g. morning + afternoon). Omitted = single startTime/endTime. */
  timeSessions: z.array(scheduleTimeSessionSchema).max(MAX_TIME_SESSIONS_PER_COURSE).optional(),
  /** Preferred period ids under schedulePeriodTemplate; when present, runtime times are resolved from template. */
  periodIds: z.array(z.string().min(1).max(64)).max(MAX_TIME_SESSIONS_PER_COURSE).optional(),
  /** When `custom`, times come from timeSessions / startTime+endTime only; periodIds are ignored. */
  timeMode: z.enum(['periods', 'custom']).optional(),
  anchorDate: dateYmd,
  untilDate: dateYmd.optional(),
})

export type ScheduleCourse = z.infer<typeof scheduleCourseSchema>

export const SCHEDULE_PERIOD_PARTS = ['morning', 'afternoon', 'evening'] as const
export type SchedulePeriodPart = (typeof SCHEDULE_PERIOD_PARTS)[number]

export type SchedulePeriodTemplateItem = {
  id: string
  label: string
  part: SchedulePeriodPart
  startTime: string
  endTime: string
  order: number
}

const schedulePeriodTemplateItemSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(40),
  part: z.enum(SCHEDULE_PERIOD_PARTS),
  startTime: timeHm,
  endTime: timeHm,
  order: z.number().int().min(0).max(999),
})

const schedulePeriodTemplateSchema = z
  .array(schedulePeriodTemplateItemSchema)
  .min(1)
  .max(MAX_SCHEDULE_PERIODS)

export const scheduleCoursesArraySchema = z
  .array(scheduleCourseSchema)
  .max(MAX_SCHEDULE_COURSES)

export function isAllowedSlotMinutes(n: number): n is ScheduleSlotMinutes {
  return (SCHEDULE_SLOT_MINUTES_ALLOWED as readonly number[]).includes(n)
}

/** JS getDay(): 0 Sun … 6 Sat → Monday = 0 … Sunday = 6 */
export function weekdayMon0FromDate(d: Date): number {
  const sun0 = d.getDay()
  return sun0 === 0 ? 6 : sun0 - 1
}

export function anchorMatchesWeekday(anchorDateYmd: string, weekday: number): boolean {
  const anchor = parse(anchorDateYmd, 'yyyy-MM-dd', new Date())
  return weekdayMon0FromDate(startOfDay(anchor)) === weekday
}

export function parseScheduleCoursesJson(raw: unknown): {
  ok: true
  data: ScheduleCourse[]
} | {
  ok: false
  error: string
} {
  if (raw == null) return { ok: true, data: [] }
  const parsed = scheduleCoursesArraySchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join('; ') || 'Invalid courses' }
  }
  for (const c of parsed.data) {
    if (!anchorMatchesWeekday(c.anchorDate, c.weekday)) {
      return {
        ok: false,
        error: `Course "${c.title}": anchor date must fall on the selected weekday`,
      }
    }
    const segments = getCourseTimeSessions(c)
    for (let i = 0; i < segments.length; i += 1) {
      const sm = parseHm(segments[i].startTime)
      const em = parseHm(segments[i].endTime)
      if (em <= sm) {
        return {
          ok: false,
          error: `Course "${c.title}" (时段 ${i + 1}): end time must be after start time`,
        }
      }
    }
    if (c.untilDate) {
      const a = parse(c.anchorDate, 'yyyy-MM-dd', new Date())
      const u = parse(c.untilDate, 'yyyy-MM-dd', new Date())
      if (isBefore(u, startOfDay(a))) {
        return {
          ok: false,
          error: `Course "${c.title}": until date must be on or after anchor date`,
        }
      }
    }
  }
  return { ok: true, data: parsed.data }
}

export function defaultSchedulePeriodTemplate(): SchedulePeriodTemplateItem[] {
  return [
    { id: 'p1', label: '1-2节', part: 'morning', startTime: '08:00', endTime: '09:40', order: 10 },
    { id: 'p2', label: '3-4节', part: 'morning', startTime: '10:00', endTime: '11:40', order: 20 },
    { id: 'p3', label: '5-6节', part: 'afternoon', startTime: '14:00', endTime: '15:40', order: 30 },
    { id: 'p4', label: '7-8节', part: 'afternoon', startTime: '16:00', endTime: '17:40', order: 40 },
    { id: 'p5', label: '9-10节', part: 'evening', startTime: '19:00', endTime: '20:40', order: 50 },
  ]
}

export function parseSchedulePeriodTemplateJson(raw: unknown): {
  ok: true
  data: SchedulePeriodTemplateItem[]
} | {
  ok: false
  error: string
} {
  if (raw == null) return { ok: true, data: defaultSchedulePeriodTemplate() }
  const parsed = schedulePeriodTemplateSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.flatten().formErrors.join('; ') || 'Invalid schedule period template',
    }
  }
  const byId = new Set<string>()
  const sorted = [...parsed.data].sort((a, b) => a.order - b.order)
  let lastEndByPart = new Map<SchedulePeriodPart, number>()
  for (const p of sorted) {
    if (byId.has(p.id)) {
      return { ok: false, error: `Period id duplicated: ${p.id}` }
    }
    byId.add(p.id)
    const sm = parseHm(p.startTime)
    const em = parseHm(p.endTime)
    if (em <= sm) {
      return { ok: false, error: `Period "${p.label}": end time must be after start time` }
    }
    const prevEnd = lastEndByPart.get(p.part)
    if (prevEnd !== undefined && sm < prevEnd) {
      return { ok: false, error: `Period "${p.label}": overlaps previous ${p.part} period` }
    }
    lastEndByPart.set(p.part, em)
  }
  return { ok: true, data: sorted }
}

export function resolveSchedulePeriodTemplate(raw: unknown): SchedulePeriodTemplateItem[] {
  const parsed = parseSchedulePeriodTemplateJson(raw)
  return parsed.ok ? parsed.data : defaultSchedulePeriodTemplate()
}

export function validateCoursePeriodIdsAgainstTemplate(
  courses: ScheduleCourse[],
  periodTemplate: SchedulePeriodTemplateItem[],
): { ok: true } | { ok: false; error: string } {
  const periodIdSet = new Set(periodTemplate.map((p) => p.id))
  for (const c of courses) {
    if (!c.periodIds || c.periodIds.length === 0) continue
    for (const id of c.periodIds) {
      if (!periodIdSet.has(id)) {
        return { ok: false, error: `Course "${c.title}": unknown period id "${id}"` }
      }
    }
  }
  return { ok: true }
}

/** Try to fill periodIds for legacy courses: exact single-period match, then contiguous chain (e.g. 1–4 节). */
export function backfillCoursePeriodIdsFromTemplate(
  courses: ScheduleCourse[],
  periodTemplate: SchedulePeriodTemplateItem[],
): { courses: ScheduleCourse[]; warnings: string[] } {
  const byRange = new Map<string, string>(
    periodTemplate.map((p) => [`${p.startTime}-${p.endTime}`, p.id]),
  )
  const sortedByOrder = [...periodTemplate].sort((a, b) => a.order - b.order)
  const warnings: string[] = []
  const next = courses.map((c) => {
    if (c.timeMode === 'custom') return c
    if (c.periodIds && c.periodIds.length > 0) return c
    const sessions = getCourseTimeSessions(c)
    const ids: string[] = []
    let ok = true
    for (const seg of sessions) {
      const matched = matchTimeSessionToPeriodIds(seg, sortedByOrder, byRange)
      if (!matched || matched.length === 0) {
        ok = false
        break
      }
      ids.push(...matched)
    }
    if (ok && ids.length > 0 && ids.length <= MAX_TIME_SESSIONS_PER_COURSE) {
      return { ...c, periodIds: ids }
    }
    warnings.push(`课程「${c.title}」有时段未匹配到固定节次，请手动重新选择`)
    return c
  })
  return { courses: next, warnings }
}

function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

/**
 * Max gap (minutes) between adjacent template periods: legacy backfill chain, and merging periodIds into one display block.
 */
export const SCHEDULE_PERIOD_CHAIN_MAX_GAP_MINUTES = 120

/**
 * Map one legacy time segment to period ids: single exact row, or contiguous run in template order
 * whose first start and last end match the segment (with small tolerance).
 */
function matchTimeSessionToPeriodIds(
  seg: ScheduleTimeSession,
  sortedByOrder: SchedulePeriodTemplateItem[],
  byExactRange: Map<string, string>,
): string[] | null {
  const exact = byExactRange.get(`${seg.startTime}-${seg.endTime}`)
  if (exact) return [exact]

  const S = parseHm(seg.startTime)
  const E = parseHm(seg.endTime)
  if (E <= S) return null

  const tol = 2

  for (let i = 0; i < sortedByOrder.length; i++) {
    if (Math.abs(parseHm(sortedByOrder[i].startTime) - S) > tol) continue

    for (let j = i; j < sortedByOrder.length; j++) {
      if (Math.abs(parseHm(sortedByOrder[j].endTime) - E) > tol) continue

      let chainOk = true
      for (let k = i; k < j; k++) {
        const endK = parseHm(sortedByOrder[k].endTime)
        const startNext = parseHm(sortedByOrder[k + 1].startTime)
        const gap = startNext - endK
        if (gap < -tol) {
          chainOk = false
          break
        }
        if (gap > SCHEDULE_PERIOD_CHAIN_MAX_GAP_MINUTES + tol) {
          chainOk = false
          break
        }
      }
      if (chainOk) {
        return sortedByOrder.slice(i, j + 1).map((p) => p.id)
      }
    }
  }

  return null
}

/** Merge consecutive HH:mm segments when gap between end and next start is within maxGapMin (e.g. chained class periods). */
function mergeAdjacentTimeSessions(
  segments: ScheduleTimeSession[],
  maxGapMin: number,
): ScheduleTimeSession[] {
  if (segments.length === 0) return []
  const tol = 2
  const out: ScheduleTimeSession[] = []
  let curStart = segments[0].startTime
  let curEnd = segments[0].endTime
  for (let i = 1; i < segments.length; i += 1) {
    const gap = parseHm(segments[i].startTime) - parseHm(curEnd)
    if (gap >= -tol && gap <= maxGapMin + tol) {
      curEnd = segments[i].endTime
    } else {
      out.push({ startTime: curStart, endTime: curEnd })
      curStart = segments[i].startTime
      curEnd = segments[i].endTime
    }
  }
  out.push({ startTime: curStart, endTime: curEnd })
  return out
}

/** Effective time segments for one course (legacy single pair or explicit list). */
export function getCourseTimeSessions(
  c: ScheduleCourse,
  periodTemplate?: SchedulePeriodTemplateItem[],
): ScheduleTimeSession[] {
  if (c.timeMode === 'custom') {
    if (c.timeSessions && c.timeSessions.length > 0) {
      return c.timeSessions
    }
    return [{ startTime: c.startTime, endTime: c.endTime }]
  }
  if (periodTemplate && c.periodIds && c.periodIds.length > 0) {
    const byId = new Map(periodTemplate.map((p) => [p.id, p]))
    const picked = c.periodIds
      .map((id) => byId.get(id))
      .filter((item): item is SchedulePeriodTemplateItem => Boolean(item))
      .sort((a, b) => a.order - b.order)
      .map((p) => ({ startTime: p.startTime, endTime: p.endTime }))
    if (picked.length > 0) {
      return mergeAdjacentTimeSessions(picked, SCHEDULE_PERIOD_CHAIN_MAX_GAP_MINUTES)
    }
  }
  if (c.timeSessions && c.timeSessions.length > 0) {
    return c.timeSessions
  }
  return [{ startTime: c.startTime, endTime: c.endTime }]
}

export type ScheduleOccurrence = {
  courseId: string
  title: string
  location?: string
  teacher?: string
  start: Date
  end: Date
  /** 1-based when this course has multiple segments on the same calendar day */
  sessionOrdinal?: number
  /** Total segments that day for this course (only when there are multiple) */
  sessionCount?: number
}

/** Combine local calendar day with HH:mm */
export function combineDateAndTime(day: Date, hm: string): Date {
  const [h, m] = hm.split(':').map(Number)
  const d = startOfDay(day)
  return addMinutes(d, h * 60 + m)
}

/**
 * Expand courses into concrete start/end instants that intersect the given week.
 * weekRef: any date inside the target week; week starts Monday.
 */
export function expandOccurrencesInWeek(
  courses: ScheduleCourse[],
  weekRef: Date,
  periodTemplate?: SchedulePeriodTemplateItem[],
  timezone?: string | null,
): ScheduleOccurrence[] {
  const wallWeekRef = timezone ? toWallClockDate(weekRef, timezone) : weekRef
  const ws = startOfWeek(wallWeekRef, { weekStartsOn: 1 })
  const we = endOfWeek(wallWeekRef, { weekStartsOn: 1 })
  const out: ScheduleOccurrence[] = []

  for (const c of courses) {
    const anchorDay = startOfDay(parse(c.anchorDate, 'yyyy-MM-dd', new Date()))
    const untilDay = c.untilDate
      ? startOfDay(parse(c.untilDate, 'yyyy-MM-dd', new Date()))
      : null

    const days = eachDayOfInterval({ start: ws, end: we })
    for (const day of days) {
      if (weekdayMon0FromDate(day) !== c.weekday) continue
      if (isBefore(day, anchorDay)) continue
      if (untilDay && isAfter(day, untilDay)) continue
      const diff = differenceInCalendarDays(startOfDay(day), anchorDay)
      if (diff < 0 || diff % 7 !== 0) continue

      for (const seg of getCourseTimeSessions(c, periodTemplate)) {
        const start = combineDateAndTime(day, seg.startTime)
        const end = combineDateAndTime(day, seg.endTime)
        out.push({
          courseId: c.id,
          title: c.title,
          location: c.location,
          teacher: c.teacher,
          start,
          end,
        })
      }
    }
  }

  const sorted = out.sort((a, b) => a.start.getTime() - b.start.getTime())
  const byCourseDay = new Map<string, ScheduleOccurrence[]>()
  for (const o of sorted) {
    const k = `${o.courseId}|${format(o.start, 'yyyy-MM-dd')}`
    const arr = byCourseDay.get(k)
    if (arr) arr.push(o)
    else byCourseDay.set(k, [o])
  }
  for (const group of byCourseDay.values()) {
    if (group.length <= 1) continue
    group.sort((a, b) => a.start.getTime() - b.start.getTime())
    const n = group.length
    for (let i = 0; i < n; i += 1) {
      group[i].sessionOrdinal = i + 1
      group[i].sessionCount = n
    }
  }
  return sorted
}

/** First occurrence in the same week as `now` where start <= now < end (local clock). */
export function findOngoingOccurrenceAt(
  courses: ScheduleCourse[],
  now: Date,
  periodTemplate?: SchedulePeriodTemplateItem[],
  timezone?: string | null,
): ScheduleOccurrence | null {
  const wallNow = timezone ? toWallClockDate(now, timezone) : now
  const occs = expandOccurrencesInWeek(courses, wallNow, periodTemplate)
  const t = wallNow.getTime()
  for (const o of occs) {
    if (o.start.getTime() <= t && t < o.end.getTime()) {
      return o
    }
  }
  return null
}

/** Occurrences whose start falls on the local calendar day of `dayRef`. */
export function getOccurrencesOnCalendarDay(
  courses: ScheduleCourse[],
  dayRef: Date,
  periodTemplate?: SchedulePeriodTemplateItem[],
  timezone?: string | null,
): ScheduleOccurrence[] {
  const wallDayRef = timezone ? toWallClockDate(dayRef, timezone) : dayRef
  const occs = expandOccurrencesInWeek(courses, wallDayRef, periodTemplate)
  const ymd = format(startOfDay(wallDayRef), 'yyyy-MM-dd')
  return occs
    .filter((o) => format(o.start, 'yyyy-MM-dd') === ymd)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
}

/** Home banner: in session, idle today, rest day, or next session later today. */
export type ScheduleHomeCardState =
  | { kind: 'in_class'; occ: ScheduleOccurrence }
  | { kind: 'after_classes_today' }
  | { kind: 'rest_tomorrow_has' }
  | { kind: 'rest_no_tomorrow' }
  | { kind: 'upcoming_today'; next: ScheduleOccurrence }

export function resolveScheduleHomeCardState(
  courses: ScheduleCourse[],
  now: Date,
  periodTemplate?: SchedulePeriodTemplateItem[],
  timezone?: string | null,
): ScheduleHomeCardState {
  const wallNow = timezone ? toWallClockDate(now, timezone) : now
  const ongoing = findOngoingOccurrenceAt(courses, wallNow, periodTemplate)
  if (ongoing) return { kind: 'in_class', occ: ongoing }

  const todayOccs = getOccurrencesOnCalendarDay(courses, wallNow, periodTemplate)
  const t = wallNow.getTime()

  if (todayOccs.length > 0) {
    const allEnded = todayOccs.every((o) => t >= o.end.getTime())
    if (allEnded) return { kind: 'after_classes_today' }

    const nextUp = todayOccs.find((o) => t < o.start.getTime())
    if (nextUp) return { kind: 'upcoming_today', next: nextUp }
  }

  const tomorrow = addDays(startOfDay(wallNow), 1)
  const tomorrowOccs = getOccurrencesOnCalendarDay(courses, tomorrow, periodTemplate)
  if (tomorrowOccs.length > 0) return { kind: 'rest_tomorrow_has' }
  return { kind: 'rest_no_tomorrow' }
}

/** Move anchor forward (same or next dates) so it falls on the given weekday (Mon=0). */
export function snapAnchorToWeekday(anchorDateYmd: string, weekday: number): string {
  const day = startOfDay(parse(anchorDateYmd, 'yyyy-MM-dd', new Date()))
  for (let i = 0; i < 14; i += 1) {
    const cur = addDays(day, i)
    if (weekdayMon0FromDate(cur) === weekday) {
      return format(cur, 'yyyy-MM-dd')
    }
  }
  return anchorDateYmd
}

export function newScheduleCourseId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}
