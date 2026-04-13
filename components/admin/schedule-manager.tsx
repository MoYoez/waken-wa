'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, addWeeks, format, startOfWeek } from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useT } from 'next-i18next/client'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  getAdminPanelTransition,
  getAdminSectionVariants,
} from '@/components/admin/admin-motion'
import { fetchAdminSettings } from '@/components/admin/admin-query-fetchers'
import { adminQueryKeys } from '@/components/admin/admin-query-keys'
import { patchAdminSettings } from '@/components/admin/admin-query-mutations'
import { FileSelectTrigger } from '@/components/admin/file-select-trigger'
import { SortablePeriodTemplatePart } from '@/components/admin/sortable-period-template-part'
import { UnsavedChangesBar } from '@/components/admin/unsaved-changes-bar'
import { WeekTimetableGrid } from '@/components/admin/week-timetable-grid'
import { useSiteTimeFormat } from '@/components/site-timezone-provider'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { buildAdminSettingsPatchBody } from '@/lib/admin-settings-patch-body'
import {
  backfillCoursePeriodIdsFromTemplate,
  defaultSchedulePeriodTemplate,
  expandOccurrencesInWeek,
  getCourseTimeSessions,
  MAX_TIME_SESSIONS_PER_COURSE,
  newScheduleCourseId,
  parseSchedulePeriodTemplateJson,
  resolveSchedulePeriodTemplate,
  type ScheduleCourse,
  type SchedulePeriodPart,
  type SchedulePeriodTemplateItem,
  type ScheduleTimeSession,
  snapAnchorToWeekday,
  validateCoursePeriodIdsAgainstTemplate,
} from '@/lib/schedule-courses'
import { exportCoursesToIcs, importIcsToCourses } from '@/lib/schedule-ics'
import {
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
} from '@/lib/site-config-constants'

function getWeekdayOptions(t: (key: string) => string): { value: number; label: string }[] {
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

function getPeriodPartLabel(
  t: (key: string) => string,
  part: SchedulePeriodPart,
): string {
  if (part === 'morning') return t('scheduleManager.periodParts.morning')
  if (part === 'afternoon') return t('scheduleManager.periodParts.afternoon')
  return t('scheduleManager.periodParts.evening')
}

/** Fields that PATCH together; used for dirty detection vs last load/save. */
type ScheduleFormBaseline = {
  periodTemplate: SchedulePeriodTemplateItem[]
  courses: ScheduleCourse[]
  icsRaw: string
  inClassOnHome: boolean
  homeShowLocation: boolean
  homeShowTeacher: boolean
  homeShowNextUpcoming: boolean
  homeAfterClassesLabel: string
}

type ScheduleManagerInitialData = {
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

function buildScheduleManagerInitialData(
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

function emptyCourse(today: string): ScheduleCourse {
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

function formatCourseTimeRanges(
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

export const ScheduleManager = forwardRef<ScheduleManagerHandle, object>(function ScheduleManager(_, ref) {
  const { t } = useT('admin')
  const settingsQuery = useQuery({
    queryKey: adminQueryKeys.settings.detail(),
    queryFn: fetchAdminSettings,
  })

  const initialData = useMemo(
    () => (settingsQuery.data ? buildScheduleManagerInitialData(settingsQuery.data) : null),
    [settingsQuery.data],
  )

  if (settingsQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{t('scheduleManager.loading')}</div>
  }

  if (!initialData) {
    return (
      <div className="text-sm text-muted-foreground">
        {settingsQuery.error instanceof Error ? settingsQuery.error.message : t('scheduleManager.loadFailed')}
      </div>
    )
  }

  return (
    <ScheduleManagerEditor
      key={String(settingsQuery.dataUpdatedAt)}
      ref={ref}
      initialData={initialData}
    />
  )
})

const ScheduleManagerEditor = forwardRef<
  ScheduleManagerHandle,
  { initialData: ScheduleManagerInitialData }
>(function ScheduleManagerEditor({ initialData }, ref) {
  const { t } = useT('admin')
  const queryClient = useQueryClient()
  const prefersReducedMotion = Boolean(useReducedMotion())
  const { toDisplayWallClockDate } = useSiteTimeFormat()
  const [message, setMessage] = useState('')
  const [serverData, setServerData] = useState<Record<string, unknown>>(initialData.serverData)
  const [courses, setCourses] = useState<ScheduleCourse[]>(initialData.courses)
  const [periodTemplate, setPeriodTemplate] = useState<SchedulePeriodTemplateItem[]>(
    initialData.periodTemplate.length > 0 ? initialData.periodTemplate : defaultSchedulePeriodTemplate(),
  )
  const [compatWarnings, setCompatWarnings] = useState<string[]>(initialData.compatWarnings)
  const [icsRaw, setIcsRaw] = useState(initialData.icsRaw)
  const [weekRef, setWeekRef] = useState(() =>
    startOfWeek(toDisplayWallClockDate(new Date()), { weekStartsOn: 1 }),
  )

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduleCourse | null>(null)

  const [icsDialogOpen, setIcsDialogOpen] = useState(false)
  const [icsPaste, setIcsPaste] = useState('')
  const [icsMergeMode, setIcsMergeMode] = useState<'replace' | 'append'>('replace')

  const [inClassOnHome, setInClassOnHome] = useState(initialData.inClassOnHome)
  const [homeShowLocation, setHomeShowLocation] = useState(initialData.homeShowLocation)
  const [homeShowTeacher, setHomeShowTeacher] = useState(initialData.homeShowTeacher)
  const [homeShowNextUpcoming, setHomeShowNextUpcoming] = useState(initialData.homeShowNextUpcoming)
  const [homeAfterClassesLabel, setHomeAfterClassesLabel] = useState(
    initialData.homeAfterClassesLabel,
  )
  const [scheduleBaseline, setScheduleBaseline] = useState<ScheduleFormBaseline | null>(
    initialData.scheduleBaseline,
  )
  const weekdayOptions = useMemo(() => getWeekdayOptions(t), [t])
  const saveSettingsMutation = useMutation({
    mutationFn: patchAdminSettings,
    onSuccess: async (saved) => {
      queryClient.setQueryData(adminQueryKeys.settings.detail(), saved)
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.settings.detail() })
    },
  })

  const occurrences = useMemo(
    () => expandOccurrencesInWeek(courses, weekRef, periodTemplate),
    [courses, weekRef, periodTemplate],
  )
  const mobileWeekDays = useMemo(() => {
    const weekStart = startOfWeek(weekRef, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, index) => {
      const day = addDays(weekStart, index)
      const dayKey = format(day, 'yyyy-MM-dd')
      const items = occurrences
        .filter((occurrence) => format(occurrence.start, 'yyyy-MM-dd') === dayKey)
        .sort((a, b) => a.start.getTime() - b.start.getTime())
      return {
        date: day,
        label: weekdayOptions[index]?.label ?? format(day, 'EEE'),
        items,
      }
    })
  }, [occurrences, weekRef, weekdayOptions])

  const patchPeriodTemplateItem = (
    id: string,
    patch: Partial<SchedulePeriodTemplateItem>,
  ) => {
    setPeriodTemplate((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }

  const addPeriodTemplateItem = (part: SchedulePeriodPart) => {
    const samePart = periodTemplate.filter((p) => p.part === part)
    const maxOrder = Math.max(0, ...samePart.map((p) => p.order))
    const nextOrder = maxOrder + 10
    let nextIndex = samePart.length + 1
    let id = `p_${part}_${nextOrder}_${nextIndex}`
    while (periodTemplate.some((item) => item.id === id)) {
      nextIndex += 1
      id = `p_${part}_${nextOrder}_${nextIndex}`
    }
    setPeriodTemplate((prev) => [
      ...prev,
      {
        id,
        label: t('scheduleManager.newPeriodLabel', {
          part: getPeriodPartLabel(t, part),
        }),
        part,
        startTime: part === 'morning' ? '08:00' : part === 'afternoon' ? '14:00' : '19:00',
        endTime: part === 'morning' ? '09:40' : part === 'afternoon' ? '15:40' : '20:40',
        order: nextOrder,
      },
    ])
  }

  const removePeriodTemplateItem = (id: string) => {
    setPeriodTemplate((prev) => prev.filter((p) => p.id !== id))
    setCourses((prev) =>
      prev.map((c) => ({
        ...c,
        periodIds: c.periodIds?.filter((pid) => pid !== id),
      })),
    )
  }

  const reorderPeriodTemplatePart = (part: SchedulePeriodPart, orderedIds: string[]) => {
    setPeriodTemplate((prev) => {
      const byId = new Map(prev.map((p) => [p.id, p]))
      const reordered = orderedIds.map((id, i) => {
        const item = byId.get(id)
        if (!item) return null
        return { ...item, order: (i + 1) * 10 }
      })
      const valid = reordered.filter((x): x is SchedulePeriodTemplateItem => x !== null)
      if (valid.length !== orderedIds.length) return prev
      const others = prev.filter((p) => p.part !== part)
      return [...others, ...valid]
    })
  }

  const save = async () => {
    if (!serverData) {
      toast.error(t('scheduleManager.configNotLoaded'))
      return
    }
    try {
      const parsedTemplate = parseSchedulePeriodTemplateJson(periodTemplate)
      if (!parsedTemplate.ok) {
        toast.error(parsedTemplate.error)
        return
      }
      const periodValidation = validateCoursePeriodIdsAgainstTemplate(
        courses,
        parsedTemplate.data,
      )
      if (!periodValidation.ok) {
        toast.error(periodValidation.error)
        return
      }

      const body = buildAdminSettingsPatchBody(serverData, {
        schedulePeriodTemplate: parsedTemplate.data,
        scheduleCourses: courses,
        scheduleIcs: icsRaw.length > 0 ? icsRaw : '',
        scheduleInClassOnHome: inClassOnHome,
        scheduleHomeShowLocation: homeShowLocation,
        scheduleHomeShowTeacher: homeShowTeacher,
        scheduleHomeShowNextUpcoming: homeShowNextUpcoming,
        scheduleHomeAfterClassesLabel:
          homeAfterClassesLabel.trim() || SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
      })
      const saved = await saveSettingsMutation.mutateAsync(body)
      toast.success(t('scheduleManager.saved'))
      setServerData(saved)
      const tpl = resolveSchedulePeriodTemplate(saved.schedulePeriodTemplate)
      setPeriodTemplate(tpl)
      const backfilled = backfillCoursePeriodIdsFromTemplate(
        Array.isArray(saved.scheduleCourses) ? (saved.scheduleCourses as ScheduleCourse[]) : courses,
        tpl,
      )
      setCourses(backfilled.courses)
      setCompatWarnings(backfilled.warnings)
      setScheduleBaseline(
        structuredClone({
          periodTemplate: tpl,
          courses: backfilled.courses,
          icsRaw,
          inClassOnHome,
          homeShowLocation,
          homeShowTeacher,
          homeShowNextUpcoming,
          homeAfterClassesLabel,
        }),
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('common.networkError'))
    }
  }

  const revertUnsavedSchedule = () => {
    if (!scheduleBaseline) return
    const b = structuredClone(scheduleBaseline)
    setPeriodTemplate(b.periodTemplate)
    setCourses(b.courses)
    setIcsRaw(b.icsRaw)
    setInClassOnHome(b.inClassOnHome)
    setHomeShowLocation(b.homeShowLocation)
    setHomeShowTeacher(b.homeShowTeacher)
    setHomeShowNextUpcoming(b.homeShowNextUpcoming)
    setHomeAfterClassesLabel(b.homeAfterClassesLabel)
  }

  const openNew = () => {
    const draft = emptyCourse(format(toDisplayWallClockDate(new Date()), 'yyyy-MM-dd'))
    if (periodTemplate.length > 0) {
      draft.timeMode = 'periods'
      draft.periodIds = [periodTemplate[0].id]
      const sessions = getCourseTimeSessions(draft, periodTemplate)
      if (sessions[0]) {
        draft.startTime = sessions[0].startTime
        draft.endTime = sessions[0].endTime
        draft.timeSessions = sessions.length > 1 ? sessions : undefined
      }
    } else {
      draft.timeMode = 'custom'
    }
    setEditing(draft)
    setDialogOpen(true)
  }

  const openEdit = (c: ScheduleCourse) => {
    const sessions = getCourseTimeSessions(c, periodTemplate)
    const inferredMode =
      c.timeMode === 'custom'
        ? ('custom' as const)
        : c.periodIds && c.periodIds.length > 0
          ? ('periods' as const)
          : ('custom' as const)
    setEditing({
      ...c,
      timeSessions: sessions.map((s) => ({ ...s })),
      startTime: sessions[0].startTime,
      endTime: sessions[0].endTime,
      periodIds: c.periodIds ?? [],
      timeMode: c.timeMode ?? inferredMode,
    })
    setDialogOpen(true)
  }

  const parseHmLocal = (hm: string) => {
    const [h, m] = hm.split(':').map(Number)
    return h * 60 + m
  }

  const commitEditor = () => {
    if (!editing || !editing.title.trim()) {
      setMessage(t('scheduleManager.messages.courseNameRequired'))
      return
    }

    const mode = editing.timeMode ?? 'periods'

    let next: ScheduleCourse

    if (mode === 'custom') {
      const raw: ScheduleTimeSession[] =
        editing.timeSessions && editing.timeSessions.length > 0
          ? editing.timeSessions
          : [{ startTime: editing.startTime, endTime: editing.endTime }]
      if (raw.length > MAX_TIME_SESSIONS_PER_COURSE) {
        setMessage(
          t('scheduleManager.messages.maxTimeSessionsPerCourse', {
            value: MAX_TIME_SESSIONS_PER_COURSE,
          }),
        )
        return
      }
      for (let i = 0; i < raw.length; i += 1) {
        const seg = raw[i]
        if (parseHmLocal(seg.endTime) <= parseHmLocal(seg.startTime)) {
          setMessage(t('scheduleManager.messages.invalidTimeRange', { index: i + 1 }))
          return
        }
      }
      const first = raw[0]
      next = {
        ...editing,
        title: editing.title.trim(),
        timeMode: 'custom',
        periodIds: undefined,
        startTime: first.startTime,
        endTime: first.endTime,
        timeSessions: raw.length > 1 ? raw : undefined,
        anchorDate: snapAnchorToWeekday(editing.anchorDate, editing.weekday),
      }
    } else {
      const periodIds = Array.from(new Set((editing.periodIds ?? []).filter(Boolean)))
      if (periodIds.length === 0) {
        setMessage(t('scheduleManager.messages.selectAtLeastOnePeriod'))
        return
      }
      if (periodIds.length > MAX_TIME_SESSIONS_PER_COURSE) {
        setMessage(
          t('scheduleManager.messages.maxPeriodsPerCourse', {
            value: MAX_TIME_SESSIONS_PER_COURSE,
          }),
        )
        return
      }
      const withIds: ScheduleCourse = { ...editing, periodIds, timeMode: 'periods' }
      const resolvedSessions = getCourseTimeSessions(withIds, periodTemplate)
      if (resolvedSessions.length === 0) {
        setMessage(t('scheduleManager.messages.invalidSelectedPeriods'))
        return
      }
      const first = resolvedSessions[0]
      next = {
        ...withIds,
        title: editing.title.trim(),
        timeMode: 'periods',
        startTime: first.startTime,
        endTime: first.endTime,
        timeSessions: resolvedSessions.length > 1 ? resolvedSessions : undefined,
        anchorDate: snapAnchorToWeekday(editing.anchorDate, editing.weekday),
      }
    }

    if (next.location) next.location = next.location.trim() || undefined
    if (next.teacher) next.teacher = next.teacher.trim() || undefined
    setCourses((prev) => {
      const i = prev.findIndex((c) => c.id === next.id)
      if (i >= 0) {
        const copy = [...prev]
        copy[i] = next
        return copy
      }
      return [...prev, next]
    })
    setDialogOpen(false)
    setEditing(null)
    setMessage('')
  }

  const removeCourse = (id: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== id))
  }

  const downloadIcs = () => {
    const blob = new Blob([exportCoursesToIcs(courses)], {
      type: 'text/calendar;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'schedule.ics'
    a.click()
    URL.revokeObjectURL(url)
  }

  useImperativeHandle(ref, () => ({
    openImport: () => setIcsDialogOpen(true),
    downloadIcs,
  }))

  const applyIcsImport = () => {
    const text = icsPaste.trim()
    if (!text) {
      setMessage(t('scheduleManager.messages.pasteIcsContent'))
      return
    }
    const result = importIcsToCourses(text)
    if (!result.ok) {
      setMessage(result.error)
      return
    }
    let next = result.courses
    if (icsMergeMode === 'append') {
      const ids = new Set(courses.map((c) => c.id))
      next = [
        ...courses,
        ...result.courses.map((c) => (ids.has(c.id) ? { ...c, id: newScheduleCourseId() } : c)),
      ]
    }
    const backfilled = backfillCoursePeriodIdsFromTemplate(next, periodTemplate)
    setCourses(backfilled.courses)
    setCompatWarnings(backfilled.warnings)
    setIcsRaw(text)
    setIcsDialogOpen(false)
    setIcsPaste('')
    const w = result.warnings.length ? `（${result.warnings.join('；')}）` : ''
    setMessage(
      t('scheduleManager.messages.importedCourses', {
        value: result.courses.length,
        warnings: w,
      }),
    )
  }

  const onFileUpload = (file?: File) => {
    if (!file) return
    file.text().then((text) => {
      setIcsPaste(text)
    })
  }

  const scheduleDirty = useMemo(() => {
    if (!scheduleBaseline) return false
    try {
      const current: ScheduleFormBaseline = {
        periodTemplate,
        courses,
        icsRaw,
        inClassOnHome,
        homeShowLocation,
        homeShowTeacher,
        homeShowNextUpcoming,
        homeAfterClassesLabel,
      }
      return JSON.stringify(current) !== JSON.stringify(scheduleBaseline)
    } catch {
      return true
    }
  }, [
    periodTemplate,
    courses,
    icsRaw,
    inClassOnHome,
    homeShowLocation,
    homeShowTeacher,
    homeShowNextUpcoming,
    homeAfterClassesLabel,
    scheduleBaseline,
  ])
  const sectionTransition = useMemo(
    () => getAdminPanelTransition(prefersReducedMotion),
    [prefersReducedMotion],
  )
  const sectionVariants = useMemo(
    () => getAdminSectionVariants(prefersReducedMotion),
    [prefersReducedMotion],
  )
  const compactSectionVariants = useMemo(
    () =>
      getAdminSectionVariants(prefersReducedMotion, {
        enterY: 10,
        exitY: 8,
        scale: 0.996,
      }),
    [prefersReducedMotion],
  )

  return (
    <>
    <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-sm space-y-4 sm:space-y-5">
      <AnimatePresence initial={false}>
        {message ? (
          <motion.div
            className="text-sm text-muted-foreground border border-border/60 rounded-md px-3 py-2 bg-muted/20"
            variants={compactSectionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={sectionTransition}
            layout
          >
            {message}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-3">
        <h4 className="text-sm font-medium text-foreground">{t('scheduleManager.homeDisplay.title')}</h4>
        <p className="text-xs text-muted-foreground">
          {t('scheduleManager.homeDisplay.description')}
        </p>
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <Label htmlFor="sched-in-class" className="font-normal cursor-pointer">
            {t('scheduleManager.homeDisplay.showInClass')}
          </Label>
          <Switch
            id="sched-in-class"
            checked={inClassOnHome}
            onCheckedChange={setInClassOnHome}
            className="self-end sm:self-auto"
          />
        </div>
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <Label htmlFor="sched-home-next" className="font-normal cursor-pointer">
            {t('scheduleManager.homeDisplay.showNextUpcoming')}
          </Label>
          <Switch
            id="sched-home-next"
            checked={homeShowNextUpcoming}
            onCheckedChange={setHomeShowNextUpcoming}
            disabled={!inClassOnHome}
            className="self-end sm:self-auto"
          />
        </div>
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <Label htmlFor="sched-home-loc" className="font-normal cursor-pointer">
            {t('scheduleManager.homeDisplay.showLocation')}
          </Label>
          <Switch
            id="sched-home-loc"
            checked={homeShowLocation}
            onCheckedChange={setHomeShowLocation}
            disabled={!inClassOnHome}
            className="self-end sm:self-auto"
          />
        </div>
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <Label htmlFor="sched-home-teacher" className="font-normal cursor-pointer">
            {t('scheduleManager.homeDisplay.showTeacher')}
          </Label>
          <Switch
            id="sched-home-teacher"
            checked={homeShowTeacher}
            onCheckedChange={setHomeShowTeacher}
            disabled={!inClassOnHome}
            className="self-end sm:self-auto"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sched-home-after-label">
            {t('scheduleManager.homeDisplay.afterClassesLabel')}
          </Label>
          <Input
            id="sched-home-after-label"
            value={homeAfterClassesLabel}
            onChange={(e) => setHomeAfterClassesLabel(e.target.value.slice(0, 40))}
            placeholder={t('scheduleManager.homeDisplay.afterClassesPlaceholder')}
            maxLength={40}
            disabled={!inClassOnHome}
            className="w-full max-w-md"
          />
          <p className="text-xs text-muted-foreground">
            {t('scheduleManager.homeDisplay.afterClassesHint')}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/10 p-2.5 sm:p-3 space-y-2.5 sm:space-y-3 overflow-x-hidden min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="min-w-0 text-xs font-medium text-foreground sm:text-sm">
            {t('scheduleManager.periodTemplate.title')}
          </h4>
        </div>
        <p className="text-[11px] text-muted-foreground text-pretty leading-relaxed sm:text-xs">
          {t('scheduleManager.periodTemplate.description')}
        </p>
        <AnimatePresence initial={false}>
          {compatWarnings.length > 0 ? (
            <motion.div
              className="rounded-md border border-amber-400/40 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-700 sm:px-3 sm:text-xs"
              variants={compactSectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={sectionTransition}
              layout
            >
              {compatWarnings[0]}
              {compatWarnings.length > 1
                ? t('scheduleManager.periodTemplate.moreWarnings', {
                    value: compatWarnings.length,
                  })
                : ''}
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div className="space-y-3">
          {(['morning', 'afternoon', 'evening'] as const).map((part) => {
            const rows = [...periodTemplate]
              .filter((p) => p.part === part)
              .sort((a, b) => a.order - b.order)
            return (
              <div key={part} className="space-y-2 min-w-0">
                <div className="flex flex-col gap-1.5 sm:gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
                  <Label className="shrink-0 text-xs font-medium sm:text-sm">
                    {getPeriodPartLabel(t, part)}
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full shrink-0 px-2.5 text-xs min-[480px]:w-auto sm:px-3 sm:text-sm"
                    onClick={() => addPeriodTemplateItem(part)}
                  >
                    {t('scheduleManager.periodTemplate.addPeriod')}
                  </Button>
                </div>
                {rows.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground sm:text-xs">
                    {t('scheduleManager.periodTemplate.noPeriods')}
                  </p>
                ) : (
                  <SortablePeriodTemplatePart
                    part={part}
                    rows={rows}
                    onReorderOrderedIds={reorderPeriodTemplatePart}
                    patchItem={patchPeriodTemplateItem}
                    removeItem={removePeriodTemplateItem}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-1 rounded-full border border-border/60 bg-muted/25 p-0.5 shadow-sm sm:inline-flex sm:w-auto sm:flex-nowrap sm:justify-start">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-full"
            onClick={() => setWeekRef((w) => addWeeks(w, -1))}
            aria-label={t('scheduleManager.weekNavigator.previousWeekAria')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1 px-1 text-center text-xs tabular-nums text-foreground/90 sm:min-w-[180px] sm:flex-none">
            {t('scheduleManager.weekNavigator.startingFrom', {
              value: format(startOfWeek(weekRef, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
            })}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-full"
            onClick={() => setWeekRef((w) => addWeeks(w, 1))}
            aria-label={t('scheduleManager.weekNavigator.nextWeekAria')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 rounded-full px-2.5 text-xs"
            onClick={() =>
              setWeekRef(startOfWeek(toDisplayWallClockDate(new Date()), { weekStartsOn: 1 }))
            }
          >
            {t('scheduleManager.weekNavigator.thisWeek')}
          </Button>
        </div>
      </div>

      <div className="space-y-2 sm:hidden">
        {mobileWeekDays.map((day) => (
          <div
            key={format(day.date, 'yyyy-MM-dd')}
            className="rounded-lg border border-border/60 bg-card/50 px-3 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <h4 className="text-sm font-medium text-foreground">{day.label}</h4>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {format(day.date, 'yyyy-MM-dd')}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                {day.items.length}
              </span>
            </div>
            {day.items.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {t('scheduleManager.mobileWeek.emptyDay')}
              </p>
            ) : (
              <div className="mt-2.5 space-y-2">
                {day.items.map((occurrence, index) => (
                  <div
                    key={`${occurrence.courseId}-${occurrence.start.toISOString()}-${index}`}
                    className="rounded-md border border-border/50 bg-background/80 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <p className="break-words text-sm font-medium leading-5 text-foreground">
                          {occurrence.title}
                        </p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {format(occurrence.start, 'HH:mm')}–{format(occurrence.end, 'HH:mm')}
                        </p>
                      </div>
                      {occurrence.sessionCount && occurrence.sessionCount > 1 && occurrence.sessionOrdinal ? (
                        <span className="shrink-0 rounded bg-primary/12 px-1.5 py-0.5 text-[10px] tabular-nums text-primary">
                          {occurrence.sessionOrdinal}/{occurrence.sessionCount}
                        </span>
                      ) : null}
                    </div>
                    {occurrence.location || occurrence.teacher ? (
                      <p className="mt-1 break-words text-[11px] leading-relaxed text-muted-foreground">
                        {[occurrence.location, occurrence.teacher].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden sm:block">
        <WeekTimetableGrid
          weekRef={weekRef}
          periodTemplate={periodTemplate}
          occurrences={occurrences}
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h4 className="text-sm font-medium text-foreground">{t('scheduleManager.courseList.title')}</h4>
          <Button type="button" size="sm" variant="secondary" className="w-full sm:w-auto" onClick={openNew}>
            {t('scheduleManager.courseList.addCourse')}
          </Button>
        </div>
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('scheduleManager.courseList.empty')}</p>
        ) : (
          <motion.ul className="space-y-1.5" layout>
            <AnimatePresence initial={false}>
              {courses.map((c) => (
                <motion.li
                  key={c.id}
                  className="flex flex-col gap-3 rounded-lg border border-border/50 bg-card/50 px-3 py-3 text-sm transition-colors hover:bg-muted/35 sm:flex-row sm:items-center sm:justify-between"
                  variants={compactSectionVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={sectionTransition}
                  layout
                  >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="break-words font-medium text-foreground">{c.title}</p>
                    <p className="break-words text-xs text-muted-foreground">
                      {weekdayOptions.find((w) => w.value === c.weekday)?.label}{' '}
                      {formatCourseTimeRanges(c, periodTemplate)}
                    </p>
                    <p className="break-words text-xs text-muted-foreground">
                      {t('scheduleManager.courseList.courseDateRange', {
                        anchorDate: c.anchorDate,
                        untilDate: c.untilDate ?? t('scheduleManager.courseList.noEndDate'),
                      })}
                    </p>
                  </div>
                  <div className="flex w-full gap-2 sm:w-auto">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="flex-1 sm:flex-none"
                      onClick={() => openEdit(c)}
                    >
                      {t('scheduleManager.courseList.edit')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-destructive sm:flex-none"
                      onClick={() => removeCourse(c.id)}
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing?.id && courses.some((c) => c.id === editing.id)
                ? t('scheduleManager.editor.editCourse')
                : t('scheduleManager.editor.addCourse')}
            </DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label>{t('scheduleManager.editor.courseName')}</Label>
                <Input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('scheduleManager.editor.locationOptional')}</Label>
                <Input
                  value={editing.location ?? ''}
                  onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('scheduleManager.editor.teacherOptional')}</Label>
                <Input
                  value={editing.teacher ?? ''}
                  onChange={(e) => setEditing({ ...editing, teacher: e.target.value })}
                  placeholder={t('scheduleManager.editor.teacherPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('scheduleManager.editor.weekday')}</Label>
                <Select
                  value={String(editing.weekday)}
                  onValueChange={(v) => {
                    const weekday = Number(v)
                    setEditing((cur) => {
                      if (!cur) return cur
                      return {
                        ...cur,
                        weekday,
                        anchorDate: snapAnchorToWeekday(cur.anchorDate, weekday),
                      }
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {weekdayOptions.map((w) => (
                      <SelectItem key={w.value} value={String(w.value)}>
                        {w.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('scheduleManager.editor.timeMode')}</Label>
                <RadioGroup
                  value={
                    periodTemplate.length === 0
                      ? 'custom'
                      : (editing.timeMode ?? 'periods')
                  }
                  onValueChange={(v) => {
                    const mode = v as 'periods' | 'custom'
                    setEditing((cur) => {
                      if (!cur) return cur
                      if (mode === 'custom') {
                        const resolved = getCourseTimeSessions(
                          { ...cur, timeMode: 'periods' },
                          periodTemplate,
                        )
                        const sess =
                          resolved.length > 0
                            ? resolved.map((s) => ({ ...s }))
                            : [{ startTime: cur.startTime, endTime: cur.endTime }]
                        return {
                          ...cur,
                          timeMode: 'custom',
                          periodIds: [],
                          timeSessions: sess,
                          startTime: sess[0].startTime,
                          endTime: sess[0].endTime,
                        }
                      }
                      const next: ScheduleCourse = {
                        ...cur,
                        timeMode: 'periods',
                        periodIds: periodTemplate[0] ? [periodTemplate[0].id] : [],
                      }
                      const sessions = getCourseTimeSessions(next, periodTemplate)
                      return {
                        ...next,
                        startTime: sessions[0]?.startTime ?? cur.startTime,
                        endTime: sessions[0]?.endTime ?? cur.endTime,
                        timeSessions: sessions.length > 1 ? sessions : undefined,
                      }
                    })
                  }}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value="periods"
                      id="sched-tm-periods"
                      disabled={periodTemplate.length === 0}
                    />
                    <Label htmlFor="sched-tm-periods" className="font-normal cursor-pointer">
                      {t('scheduleManager.editor.fixedPeriods')}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="custom" id="sched-tm-custom" />
                    <Label htmlFor="sched-tm-custom" className="font-normal cursor-pointer">
                      {t('scheduleManager.editor.customTime')}
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <AnimatePresence mode="wait" initial={false}>
                {(editing.timeMode ?? 'periods') === 'custom' ? (
                  <motion.div
                    key="schedule-custom-time"
                    className="space-y-2"
                    variants={sectionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={sectionTransition}
                  >
                    <Label>{t('scheduleManager.editor.timeSessions')}</Label>
                    <p className="text-[11px] text-muted-foreground">
                      {t('scheduleManager.editor.timeSessionsHint')}
                    </p>
                    {(editing.timeSessions?.length
                      ? editing.timeSessions
                      : [{ startTime: editing.startTime, endTime: editing.endTime }]
                    ).map((row, idx, arr) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2">
                        <Input
                          type="time"
                          step={60}
                          value={row.startTime}
                          onChange={(e) => {
                            const v = e.target.value
                            setEditing((cur) => {
                              if (!cur) return cur
                              const base =
                                cur.timeSessions && cur.timeSessions.length > 0
                                  ? [...cur.timeSessions]
                                  : [{ startTime: cur.startTime, endTime: cur.endTime }]
                              base[idx] = { ...base[idx], startTime: v }
                              const first = base[0]
                              return {
                                ...cur,
                                timeSessions: base.length > 1 ? base : undefined,
                                startTime: first.startTime,
                                endTime: first.endTime,
                              }
                            })
                          }}
                          className="h-9 w-[7.5rem] font-mono"
                        />
                        <span className="text-muted-foreground">–</span>
                        <Input
                          type="time"
                          step={60}
                          value={row.endTime}
                          onChange={(e) => {
                            const v = e.target.value
                            setEditing((cur) => {
                              if (!cur) return cur
                              const base =
                                cur.timeSessions && cur.timeSessions.length > 0
                                  ? [...cur.timeSessions]
                                  : [{ startTime: cur.startTime, endTime: cur.endTime }]
                              base[idx] = { ...base[idx], endTime: v }
                              const first = base[0]
                              return {
                                ...cur,
                                timeSessions: base.length > 1 ? base : undefined,
                                startTime: first.startTime,
                                endTime: first.endTime,
                              }
                            })
                          }}
                          className="h-9 w-[7.5rem] font-mono"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 shrink-0 text-destructive"
                          disabled={arr.length <= 1}
                          onClick={() => {
                            setEditing((cur) => {
                              if (!cur) return cur
                              const base =
                                cur.timeSessions && cur.timeSessions.length > 0
                                  ? [...cur.timeSessions]
                                  : [{ startTime: cur.startTime, endTime: cur.endTime }]
                              base.splice(idx, 1)
                              const first = base[0]
                              return {
                                ...cur,
                                timeSessions: base.length > 1 ? base : undefined,
                                startTime: first.startTime,
                                endTime: first.endTime,
                              }
                            })
                          }}
                          aria-label={t('scheduleManager.editor.deleteTimeSession')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      onClick={() => {
                        setEditing((cur) => {
                          if (!cur) return cur
                          const base =
                            cur.timeSessions && cur.timeSessions.length > 0
                              ? [...cur.timeSessions]
                              : [{ startTime: cur.startTime, endTime: cur.endTime }]
                          if (base.length >= MAX_TIME_SESSIONS_PER_COURSE) return cur
                          const last = base[base.length - 1]
                          const [h, m] = last.endTime.split(':').map(Number)
                          let endMin = h * 60 + m + 45
                          endMin = ((endMin % (24 * 60)) + 24 * 60) % (24 * 60)
                          const nh = Math.floor(endMin / 60)
                          const nm = endMin % 60
                          const endStr = `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
                          base.push({ startTime: last.endTime, endTime: endStr })
                          return { ...cur, timeSessions: base }
                        })
                      }}
                      disabled={
                        (editing.timeSessions?.length ?? 1) >= MAX_TIME_SESSIONS_PER_COURSE
                      }
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {t('scheduleManager.editor.addTimeSession')}
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="schedule-period-time"
                    className="space-y-2"
                    variants={sectionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={sectionTransition}
                  >
                    <Label>{t('scheduleManager.editor.selectPeriods')}</Label>
                    <p className="text-[11px] text-muted-foreground">
                      {t('scheduleManager.editor.selectPeriodsHint')}
                    </p>
                    <div className="space-y-2">
                      {(['morning', 'afternoon', 'evening'] as const).map((part) => {
                        const rows = [...periodTemplate]
                          .filter((p) => p.part === part)
                          .sort((a, b) => a.order - b.order)
                        if (rows.length === 0) return null
                        return (
                          <div key={part} className="space-y-1">
                            <div className="text-xs text-muted-foreground">
                              {getPeriodPartLabel(t, part)}
                            </div>
                            {rows.map((p) => {
                              const checked = Boolean(editing.periodIds?.includes(p.id))
                              return (
                                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) => {
                                      const pid = new Set(editing.periodIds ?? [])
                                      if (v) pid.add(p.id)
                                      else pid.delete(p.id)
                                      const periodIds = Array.from(pid)
                                      const withIds: ScheduleCourse = {
                                        ...editing,
                                        periodIds,
                                        timeMode: 'periods',
                                      }
                                      const sessions = getCourseTimeSessions(withIds, periodTemplate)
                                      setEditing({
                                        ...editing,
                                        periodIds,
                                        timeMode: 'periods',
                                        startTime: sessions[0]?.startTime ?? editing.startTime,
                                        endTime: sessions[0]?.endTime ?? editing.endTime,
                                        timeSessions: sessions.length > 1 ? sessions : undefined,
                                      })
                                    }}
                                  />
                                  <span>{p.label}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {p.startTime}–{p.endTime}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="space-y-2">
                <Label>{t('scheduleManager.editor.anchorDate')}</Label>
                <Input
                  type="date"
                  value={editing.anchorDate}
                  onChange={(e) =>
                    setEditing({ ...editing, anchorDate: e.target.value })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  {t('scheduleManager.editor.anchorDateHint')}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t('scheduleManager.editor.untilDate')}</Label>
                <Input
                  type="date"
                  value={editing.untilDate ?? ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      untilDate: e.target.value || undefined,
                    })
                  }
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={commitEditor}>
              {t('scheduleManager.editor.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={icsDialogOpen} onOpenChange={setIcsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('scheduleManager.icsImport.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t('scheduleManager.icsImport.selectFile')}</Label>
              <FileSelectTrigger
                accept=".ics,.ical,text/calendar"
                buttonLabel={t('scheduleManager.icsImport.selectFile')}
                emptyLabel={t('common.noFileSelected')}
                onSelect={onFileUpload}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('scheduleManager.icsImport.orPasteContent')}</Label>
              <Textarea
                value={icsPaste}
                onChange={(e) => setIcsPaste(e.target.value)}
                rows={8}
                className="font-mono text-xs"
                placeholder={t('scheduleManager.icsImport.placeholder')}
              />
            </div>
            <RadioGroup
              value={icsMergeMode}
              onValueChange={(v) => setIcsMergeMode(v as 'replace' | 'append')}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="replace" id="ics-replace" />
                <Label htmlFor="ics-replace" className="font-normal cursor-pointer">
                  {t('scheduleManager.icsImport.replaceExisting')}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="append" id="ics-append" />
                <Label htmlFor="ics-append" className="font-normal cursor-pointer">
                  {t('scheduleManager.icsImport.appendWithDuplicateUid')}
                </Label>
              </div>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIcsDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={applyIcsImport}>
              {t('scheduleManager.icsImport.parseAndWrite')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    <UnsavedChangesBar
      open={scheduleDirty}
      saving={saveSettingsMutation.isPending}
      onSave={save}
      onRevert={revertUnsavedSchedule}
      saveLabel={t('scheduleManager.saveToSiteConfig')}
      revertLabel={t('unsavedChanges.revert')}
    />
    </>
  )
})
