'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, addWeeks, format, startOfWeek } from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useT } from 'next-i18next/client'
import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  getAdminPanelTransition,
  getAdminSectionVariants,
} from '@/components/admin/admin-motion'
import {
  fetchAdminSettings,
  fetchAdminSettingsMigration,
} from '@/components/admin/admin-query-fetchers'
import { adminQueryKeys } from '@/components/admin/admin-query-keys'
import {
  clearAdminLegacySettingsData,
  migrateAdminSettings,
  patchAdminSettingsSchedule,
} from '@/components/admin/admin-query-mutations'
import { ScheduleCourseEditorDialog } from '@/components/admin/schedule-course-editor-dialog'
import { ScheduleIcsImportDialog } from '@/components/admin/schedule-ics-import-dialog'
import {
  buildScheduleManagerInitialData,
  emptyCourse,
  formatCourseTimeRanges,
  getPeriodPartLabel,
  getWeekdayOptions,
  type ScheduleFormBaseline,
  type ScheduleManagerHandle,
  type ScheduleManagerInitialData,
} from '@/components/admin/schedule-manager-utils'
import { SiteSettingsMigrationCard } from '@/components/admin/site-settings-migration-card'
import { SortablePeriodTemplatePart } from '@/components/admin/sortable-period-template-part'
import { UnsavedChangesBar } from '@/components/admin/unsaved-changes-bar'
import type { SiteSettingsMigrationInfo } from '@/components/admin/web-settings-types'
import { WeekTimetableGrid } from '@/components/admin/week-timetable-grid'
import { useSiteTimeFormat } from '@/components/site-timezone-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { buildAdminSettingsPatchBody } from '@/lib/admin-settings-patch-body'
import {
  backfillCoursePeriodIdsFromTemplate,
  defaultSchedulePeriodTemplate,
  expandOccurrencesInWeek,
  getCourseTimeSessions,
  parseSchedulePeriodTemplateJson,
  resolveSchedulePeriodTemplate,
  type ScheduleCourse,
  type SchedulePeriodPart,
  type SchedulePeriodTemplateItem,
  validateCoursePeriodIdsAgainstTemplate,
} from '@/lib/schedule-courses'
import { exportCoursesToIcs } from '@/lib/schedule-ics'
import {
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
} from '@/lib/site-config-constants'

export type { ScheduleManagerHandle }

export const ScheduleManager = forwardRef<ScheduleManagerHandle, object>(function ScheduleManager(_, ref) {
  const { t } = useT('admin')
  const [migrationActionPending, setMigrationActionPending] = useState(false)
  const settingsQuery = useQuery({
    queryKey: adminQueryKeys.settings.detail(),
    queryFn: fetchAdminSettings,
  })
  const migrationQuery = useQuery({
    queryKey: adminQueryKeys.settings.migration(),
    queryFn: fetchAdminSettingsMigration,
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

  const refreshAll = async () => {
    await Promise.all([settingsQuery.refetch(), migrationQuery.refetch()])
  }

  const runMigration = async () => {
    setMigrationActionPending(true)
    try {
      await migrateAdminSettings()
      await refreshAll()
      toast.success(t('webSettingsMigration.toasts.migrated'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('common.networkErrorRetry'))
    } finally {
      setMigrationActionPending(false)
    }
  }

  const clearLegacyData = async () => {
    setMigrationActionPending(true)
    try {
      await clearAdminLegacySettingsData()
      await refreshAll()
      toast.success(t('webSettingsMigration.toasts.legacyDataCleared'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('common.networkErrorRetry'))
    } finally {
      setMigrationActionPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <SiteSettingsMigrationCard
        migration={migrationQuery.data ?? null}
        pending={migrationActionPending}
        onMigrate={runMigration}
        onClearLegacyData={clearLegacyData}
      />
      <ScheduleManagerEditor
        key={`${String(settingsQuery.dataUpdatedAt)}:${migrationQuery.data?.migrationState ?? 'legacy'}`}
        ref={ref}
        initialData={initialData}
        migration={migrationQuery.data ?? null}
      />
    </div>
  )
})

const ScheduleManagerEditor = forwardRef<
  ScheduleManagerHandle,
  { initialData: ScheduleManagerInitialData; migration: SiteSettingsMigrationInfo | null }
>(function ScheduleManagerEditor({ initialData, migration }, ref) {
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
  const scheduleLocked = migration?.heavyEditingLocked === true
  const saveSettingsMutation = useMutation({
    mutationFn: patchAdminSettingsSchedule,
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
    if (scheduleLocked) {
      toast.error(t('webSettingsMigration.lockedToast'))
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

  const onCourseSave = (next: ScheduleCourse) => {
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

  const onIcsImport = (result: { courses: ScheduleCourse[]; icsRaw: string; compatWarnings: string[]; icsWarnings: string[]; importedCount: number }) => {
    setCourses(result.courses)
    setCompatWarnings(result.compatWarnings)
    setIcsRaw(result.icsRaw)
    const w = result.icsWarnings.length ? `（${result.icsWarnings.join('；')}）` : ''
    setMessage(
      t('scheduleManager.messages.importedCourses', {
        value: result.importedCount,
        warnings: w,
      }),
    )
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

      <ScheduleCourseEditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        courses={courses}
        periodTemplate={periodTemplate}
        weekdayOptions={weekdayOptions}
        onSave={onCourseSave}
        sectionVariants={sectionVariants}
        sectionTransition={sectionTransition}
        busy={saveSettingsMutation.isPending}
        t={t}
      />

      <ScheduleIcsImportDialog
        open={icsDialogOpen}
        onOpenChange={setIcsDialogOpen}
        courses={courses}
        periodTemplate={periodTemplate}
        onImport={onIcsImport}
        t={t}
      />
    </div>
    <UnsavedChangesBar
      open={scheduleDirty}
      saving={saveSettingsMutation.isPending}
      saveDisabled={scheduleLocked}
      message={
        scheduleLocked ? t('webSettingsMigration.lockedMessage') : undefined
      }
      onSave={save}
      onRevert={revertUnsavedSchedule}
      saveLabel={t('scheduleManager.saveToSiteConfig')}
      revertLabel={t('unsavedChanges.revert')}
    />
    </>
  )
})
