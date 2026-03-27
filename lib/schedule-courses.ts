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

/** Monday = 0, Sunday = 6 */
export const WEEKDAY_MON0_MAX = 6

export const SCHEDULE_SLOT_MINUTES_ALLOWED = [15, 30, 45, 60] as const

export type ScheduleSlotMinutes = (typeof SCHEDULE_SLOT_MINUTES_ALLOWED)[number]

export const MAX_SCHEDULE_COURSES = 200
export const MAX_SCHEDULE_TITLE_LEN = 120
export const MAX_SCHEDULE_LOCATION_LEN = 200
export const MAX_SCHEDULE_TEACHER_LEN = 120
export const MAX_SCHEDULE_ICS_BYTES = 512 * 1024

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
  anchorDate: dateYmd,
  untilDate: dateYmd.optional(),
})

export type ScheduleCourse = z.infer<typeof scheduleCourseSchema>

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

function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

/** Effective time segments for one course (legacy single pair or explicit list). */
export function getCourseTimeSessions(c: ScheduleCourse): ScheduleTimeSession[] {
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
): ScheduleOccurrence[] {
  const ws = startOfWeek(weekRef, { weekStartsOn: 1 })
  const we = endOfWeek(weekRef, { weekStartsOn: 1 })
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

      for (const seg of getCourseTimeSessions(c)) {
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
): ScheduleOccurrence | null {
  const occs = expandOccurrencesInWeek(courses, now)
  const t = now.getTime()
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
): ScheduleOccurrence[] {
  const occs = expandOccurrencesInWeek(courses, dayRef)
  const ymd = format(startOfDay(dayRef), 'yyyy-MM-dd')
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
): ScheduleHomeCardState {
  const ongoing = findOngoingOccurrenceAt(courses, now)
  if (ongoing) return { kind: 'in_class', occ: ongoing }

  const todayOccs = getOccurrencesOnCalendarDay(courses, now)
  const t = now.getTime()

  if (todayOccs.length > 0) {
    const allEnded = todayOccs.every((o) => t >= o.end.getTime())
    if (allEnded) return { kind: 'after_classes_today' }

    const nextUp = todayOccs.find((o) => t < o.start.getTime())
    if (nextUp) return { kind: 'upcoming_today', next: nextUp }
  }

  const tomorrow = addDays(startOfDay(now), 1)
  const tomorrowOccs = getOccurrencesOnCalendarDay(courses, tomorrow)
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
