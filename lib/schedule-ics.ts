import { addDays, endOfDay, format, parse, startOfDay } from 'date-fns'
import ICAL from 'ical.js'

import {
  combineDateAndTime,
  getCourseTimeSessions,
  newScheduleCourseId,
  type ScheduleCourse,
  weekdayMon0FromDate,
} from '@/lib/schedule-courses'

/** First calendar day >= day whose Mon0 weekday matches target (within 14 days). */
function firstOccurrenceOnOrAfter(day: Date, targetWeekdayMon0: number): Date {
  const s = startOfDay(day)
  for (let i = 0; i < 14; i += 1) {
    const cur = addDays(s, i)
    if (weekdayMon0FromDate(cur) === targetWeekdayMon0) return cur
  }
  return s
}

const BYDAY_TO_WEEKDAY: Record<string, number> = {
  MO: 0,
  TU: 1,
  WE: 2,
  TH: 3,
  FR: 4,
  SA: 5,
  SU: 6,
}

function formatHm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function parseUntilToYmd(until: ICAL.Time): string | null {
  try {
    const js = until.toJSDate()
    return format(startOfDay(js), 'yyyy-MM-dd')
  } catch {
    return null
  }
}

/**
 * Parse .ics into schedule courses. Best-effort for WEEKLY rules; skips all-day and invalid blocks.
 */
export function importIcsToCourses(icsText: string):
  | { ok: true; courses: ScheduleCourse[]; warnings: string[] }
  | { ok: false; error: string } {
  const warnings: string[] = []
  let root: ICAL.Component
  try {
    const jcal = ICAL.parse(icsText)
    root = new ICAL.Component(jcal)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid ICS' }
  }

  const vevents = root.getAllSubcomponents('vevent')
  if (vevents.length === 0) {
    return { ok: false, error: 'No VEVENT found in calendar' }
  }

  const courses: ScheduleCourse[] = []

  for (const ve of vevents) {
    let event: ICAL.Event
    try {
      event = new ICAL.Event(ve)
    } catch {
      warnings.push('Skipped a VEVENT (parse error)')
      continue
    }

    const startProp = event.startDate
    const endProp = event.endDate
    if (!startProp || !endProp) {
      warnings.push('Skipped event without start/end')
      continue
    }

    if (startProp.isDate) {
      warnings.push(`Skipped all-day event: ${event.summary || '(no title)'}`)
      continue
    }

    const start = startProp.toJSDate()
    const end = endProp.toJSDate()
    if (end.getTime() <= start.getTime()) {
      warnings.push(`Skipped event with invalid duration: ${event.summary || '(no title)'}`)
      continue
    }

    const anchorDay = startOfDay(start)
    let anchorDate = format(anchorDay, 'yyyy-MM-dd')
    let weekday = weekdayMon0FromDate(anchorDay)

    let untilDate: string | undefined
    const rruleProp = ve.getFirstProperty('rrule')
    if (rruleProp) {
      const val = rruleProp.getFirstValue()
      let recur: ICAL.Recur | null = null
      if (typeof val === 'string') {
        try {
          recur = ICAL.Recur.fromString(val)
        } catch {
          warnings.push(`Could not parse RRULE on "${event.summary || 'event'}"`)
        }
      } else if (val && typeof (val as ICAL.Recur).freq === 'string') {
        recur = val as ICAL.Recur
      }

      if (recur) {
        const freq = String(recur.freq || '').toUpperCase()
        if (freq && freq !== 'WEEKLY') {
          warnings.push(
            `Event "${event.summary || '(no title)'}": only WEEKLY recurrence is fully supported; imported as single occurrence`,
          )
          untilDate = anchorDate
        } else {
          if (recur.interval && recur.interval > 1) {
            warnings.push(
              `Event "${event.summary || '(no title)'}": INTERVAL>1 not supported; using weekly`,
            )
          }
          const rawBy = recur.parts?.BYDAY as string[] | string | undefined
          const bydays = Array.isArray(rawBy) ? rawBy : rawBy != null ? [rawBy] : []
          if (bydays.length > 0) {
            const first = String(bydays[0])
            const dayPart = first.replace(/^-?\d+/, '').toUpperCase()
            if (BYDAY_TO_WEEKDAY[dayPart] !== undefined) {
              const targetWd = BYDAY_TO_WEEKDAY[dayPart]
              if (targetWd !== weekday) {
                warnings.push(
                  `Event "${event.summary || '(no title)'}": BYDAY differs from DTSTART weekday; anchor moved to first matching day on/after DTSTART`,
                )
                const adj = firstOccurrenceOnOrAfter(anchorDay, targetWd)
                anchorDate = format(adj, 'yyyy-MM-dd')
                weekday = targetWd
              }
            }
          }
          if (recur.until) {
            const ymd = parseUntilToYmd(recur.until)
            if (ymd) untilDate = ymd
          }
        }
      }
    } else {
      untilDate = anchorDate
    }

    const uidRaw = event.uid || newScheduleCourseId()
    const id = uidRaw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || newScheduleCourseId()

    const title = (event.summary || 'Untitled').slice(0, 120)
    const location = event.location ? String(event.location).slice(0, 200) : undefined

    courses.push({
      id,
      title,
      location,
      weekday,
      startTime: formatHm(start),
      endTime: formatHm(end),
      anchorDate,
      untilDate,
    })
  }

  return { ok: true, courses, warnings }
}

export function exportCoursesToIcs(courses: ScheduleCourse[]): string {
  const cal = new ICAL.Component(['vcalendar', [], []])
  cal.updatePropertyWithValue('version', '2.0')
  cal.updatePropertyWithValue('prodid', '-//waken-wa-web//schedule//EN')
  cal.updatePropertyWithValue('calscale', 'GREGORIAN')

  const stamp = ICAL.Time.fromJSDate(new Date(), true)

  for (const c of courses) {
    const day = parse(c.anchorDate, 'yyyy-MM-dd', new Date())
    const sessions = getCourseTimeSessions(c)

    const recurData: {
      freq: string
      until?: ICAL.Time
    } = { freq: 'WEEKLY' }
    if (c.untilDate) {
      const u = endOfDay(parse(c.untilDate, 'yyyy-MM-dd', new Date()))
      recurData.until = ICAL.Time.fromJSDate(u, true)
    }
    const recur = ICAL.Recur.fromData(recurData)

    sessions.forEach((seg, idx) => {
      const dtStart = combineDateAndTime(day, seg.startTime)
      const dtEnd = combineDateAndTime(day, seg.endTime)

      const vevent = new ICAL.Component('vevent')
      vevent.updatePropertyWithValue('uid', `${c.id}_s${idx}@waken-wa-schedule`)
      vevent.updatePropertyWithValue('dtstamp', stamp)
      vevent.updatePropertyWithValue('summary', c.title)
      if (c.location) vevent.updatePropertyWithValue('location', c.location)
      vevent.updatePropertyWithValue('dtstart', ICAL.Time.fromJSDate(dtStart, true))
      vevent.updatePropertyWithValue('dtend', ICAL.Time.fromJSDate(dtEnd, true))
      vevent.updatePropertyWithValue('rrule', recur)

      cal.addSubcomponent(vevent)
    })
  }

  return cal.toString()
}
