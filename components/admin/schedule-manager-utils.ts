import {
  backfillCoursePeriodIdsFromTemplate,
  getCourseTimeSessions,
  newScheduleCourseId,
  resolveSchedulePeriodTemplate,
  type ScheduleCourse,
  type SchedulePeriodPart,
  type SchedulePeriodTemplateItem,
} from '@/lib/schedule-courses'
import {
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
} from '@/lib/site-config-constants'

export function getWeekdayOptions(t: (key: string) => string): { value: number; label: string }[] {
  return [
    { value: 0, label: t('scheduleManager.weekdays.monday') },
    { value: 1, label: t('scheduleManager.weekdays.tuesday') },
    { value: 2, label: t('scheduleManager.weekdays.wednesday') },
    { value: 3, label: t('scheduleManager.weekdays.thursday') },
    { value: 4, label: t('scheduleManager.weekdays.friday') },
    { value: 5, label: t('scheduleManager.weekdays.saturday') },
    { value: 6, label: t('scheduleManager.weekdays.sunday') },
  ]
}

export function getPeriodPartLabel(
  t: (key: string) => string,
  part: SchedulePeriodPart,
): string {
  if (part === 'morning') return t('scheduleManager.periodParts.morning')
  if (part === 'afternoon') return t('scheduleManager.periodParts.afternoon')
  return t('scheduleManager.periodParts.evening')
}

/** Fields that PATCH together; used for dirty detection vs last load/save. */
export type ScheduleFormBaseline = {
  periodTemplate: SchedulePeriodTemplateItem[]
  courses: ScheduleCourse[]
  icsRaw: string
  inClassOnHome: boolean
  homeShowLocation: boolean
  homeShowTeacher: boolean
  homeShowNextUpcoming: boolean
  homeAfterClassesLabel: string
}

export type ScheduleManagerInitialData = {
  serverData: Record<string, unknown>
  periodTemplate: SchedulePeriodTemplateItem[]
  courses: ScheduleCourse[]
  compatWarnings: string[]
  icsRaw: string
  inClassOnHome: boolean
  homeShowLocation: boolean
  homeShowTeacher: boolean
  homeShowNextUpcoming: boolean
  homeAfterClassesLabel: string
  scheduleBaseline: ScheduleFormBaseline
}

export function buildScheduleManagerInitialData(
  data: Record<string, unknown>,
): ScheduleManagerInitialData {
  const periodTemplate = resolveSchedulePeriodTemplate(data.schedulePeriodTemplate)
  const parsedCourses = Array.isArray(data.scheduleCourses)
    ? (data.scheduleCourses as ScheduleCourse[])
    : []
  const backfilled = backfillCoursePeriodIdsFromTemplate(parsedCourses, periodTemplate)
  const icsRaw = typeof data.scheduleIcs === 'string' ? data.scheduleIcs : ''
  const inClassOnHome = Boolean(data.scheduleInClassOnHome)
  const homeShowLocation = Boolean(data.scheduleHomeShowLocation)
  const homeShowTeacher = Boolean(data.scheduleHomeShowTeacher)
  const homeShowNextUpcoming = Boolean(data.scheduleHomeShowNextUpcoming)
  const homeAfterClassesLabel =
    typeof data.scheduleHomeAfterClassesLabel === 'string' &&
    data.scheduleHomeAfterClassesLabel.trim().length > 0
      ? data.scheduleHomeAfterClassesLabel.trim().slice(
          0,
          SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
        )
      : SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT

  return {
    serverData: data,
    periodTemplate,
    courses: backfilled.courses,
    compatWarnings: backfilled.warnings,
    icsRaw,
    inClassOnHome,
    homeShowLocation,
    homeShowTeacher,
    homeShowNextUpcoming,
    homeAfterClassesLabel,
    scheduleBaseline: structuredClone({
      periodTemplate,
      courses: backfilled.courses,
      icsRaw,
      inClassOnHome,
      homeShowLocation,
      homeShowTeacher,
      homeShowNextUpcoming,
      homeAfterClassesLabel,
    }),
  }
}

export function emptyCourse(today: string): ScheduleCourse {
  return {
    id: newScheduleCourseId(),
    title: '',
    weekday: 0,
    startTime: '09:00',
    endTime: '10:00',
    timeSessions: [{ startTime: '09:00', endTime: '10:00' }],
    timeMode: 'custom',
    anchorDate: today,
    untilDate: undefined,
  }
}

export function formatCourseTimeRanges(
  c: ScheduleCourse,
  periodTemplate: SchedulePeriodTemplateItem[],
): string {
  const byId = new Map(periodTemplate.map((p) => [p.id, p]))
  if (c.timeMode !== 'custom' && c.periodIds && c.periodIds.length > 0) {
    const labels = c.periodIds
      .map((id) => byId.get(id)?.label)
      .filter((v): v is string => Boolean(v))
    if (labels.length > 0) return labels.join('、')
  }
  return getCourseTimeSessions(c, periodTemplate).map((s) => `${s.startTime}–${s.endTime}`).join('、')
}

export interface ScheduleManagerHandle {
  openImport: () => void
  downloadIcs: () => void
}
