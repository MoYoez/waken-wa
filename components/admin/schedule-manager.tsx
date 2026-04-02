'use client'

import { addWeeks, format, startOfWeek } from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { SortablePeriodTemplatePart } from '@/components/admin/sortable-period-template-part'
import { UnsavedChangesBar } from '@/components/admin/unsaved-changes-bar'
import { WeekTimetableGrid } from '@/components/admin/week-timetable-grid'
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

const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '周一' },
  { value: 1, label: '周二' },
  { value: 2, label: '周三' },
  { value: 3, label: '周四' },
  { value: 4, label: '周五' },
  { value: 5, label: '周六' },
  { value: 6, label: '周日' },
]

const PERIOD_PART_LABELS: Record<SchedulePeriodPart, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
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

function emptyCourse(): ScheduleCourse {
  const today = format(new Date(), 'yyyy-MM-dd')
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
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [serverData, setServerData] = useState<Record<string, unknown> | null>(null)
  const [courses, setCourses] = useState<ScheduleCourse[]>([])
  const [periodTemplate, setPeriodTemplate] = useState<SchedulePeriodTemplateItem[]>(() =>
    defaultSchedulePeriodTemplate(),
  )
  const [compatWarnings, setCompatWarnings] = useState<string[]>([])
  const [icsRaw, setIcsRaw] = useState('')
  const [weekRef, setWeekRef] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduleCourse | null>(null)

  const [icsDialogOpen, setIcsDialogOpen] = useState(false)
  const [icsPaste, setIcsPaste] = useState('')
  const [icsMergeMode, setIcsMergeMode] = useState<'replace' | 'append'>('replace')

  const [inClassOnHome, setInClassOnHome] = useState(false)
  const [homeShowLocation, setHomeShowLocation] = useState(false)
  const [homeShowTeacher, setHomeShowTeacher] = useState(false)
  const [homeShowNextUpcoming, setHomeShowNextUpcoming] = useState(false)
  const [homeAfterClassesLabel, setHomeAfterClassesLabel] = useState(
    SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
  )
  const [scheduleBaseline, setScheduleBaseline] = useState<ScheduleFormBaseline | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/settings')
      const data = await res.json()
      if (!res.ok || !data?.success || !data?.data) {
        setMessage(data?.error || '加载失败')
        setScheduleBaseline(null)
        return
      }
      const d = data.data as Record<string, unknown>
      setServerData(d)
      const tpl = resolveSchedulePeriodTemplate(d.schedulePeriodTemplate)
      setPeriodTemplate(tpl)
      const parsedCourses = Array.isArray(d.scheduleCourses) ? (d.scheduleCourses as ScheduleCourse[]) : []
      const backfilled = backfillCoursePeriodIdsFromTemplate(parsedCourses, tpl)
      setCourses(backfilled.courses)
      setCompatWarnings(backfilled.warnings)
      setIcsRaw(typeof d.scheduleIcs === 'string' ? d.scheduleIcs : '')
      setInClassOnHome(Boolean(d.scheduleInClassOnHome))
      setHomeShowLocation(Boolean(d.scheduleHomeShowLocation))
      setHomeShowTeacher(Boolean(d.scheduleHomeShowTeacher))
      setHomeShowNextUpcoming(Boolean(d.scheduleHomeShowNextUpcoming))
      const homeLabelResolved =
        typeof d.scheduleHomeAfterClassesLabel === 'string' &&
        d.scheduleHomeAfterClassesLabel.trim().length > 0
          ? d.scheduleHomeAfterClassesLabel.trim().slice(
              0,
              SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
            )
          : SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT
      setHomeAfterClassesLabel(homeLabelResolved)
      const icsLoaded = typeof d.scheduleIcs === 'string' ? d.scheduleIcs : ''
      setScheduleBaseline(
        structuredClone({
          periodTemplate: tpl,
          courses: backfilled.courses,
          icsRaw: icsLoaded,
          inClassOnHome: Boolean(d.scheduleInClassOnHome),
          homeShowLocation: Boolean(d.scheduleHomeShowLocation),
          homeShowTeacher: Boolean(d.scheduleHomeShowTeacher),
          homeShowNextUpcoming: Boolean(d.scheduleHomeShowNextUpcoming),
          homeAfterClassesLabel: homeLabelResolved,
        }),
      )
    } catch {
      setMessage('网络异常')
      setScheduleBaseline(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const occurrences = useMemo(
    () => expandOccurrencesInWeek(courses, weekRef, periodTemplate),
    [courses, weekRef, periodTemplate],
  )

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
    const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    setPeriodTemplate((prev) => [
      ...prev,
      {
        id,
        label: `${part === 'morning' ? '上午' : part === 'afternoon' ? '下午' : '晚上'}新节次`,
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
      toast.error('尚未加载配置')
      return
    }
    setSaving(true)
    try {
      const parsedTemplate = parseSchedulePeriodTemplateJson(periodTemplate)
      if (!parsedTemplate.ok) {
        toast.error(parsedTemplate.error)
        setSaving(false)
        return
      }
      const periodValidation = validateCoursePeriodIdsAgainstTemplate(
        courses,
        parsedTemplate.data,
      )
      if (!periodValidation.ok) {
        toast.error(periodValidation.error)
        setSaving(false)
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
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        toast.error(typeof data?.error === 'string' ? data.error : '保存失败')
        return
      }
      toast.success('课表与主页展示已保存')
      const saved = data.data as Record<string, unknown>
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
    } catch {
      toast.error('网络异常')
    } finally {
      setSaving(false)
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
    const draft = emptyCourse()
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
      setMessage('请填写课程名称')
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
        setMessage(`同一课程最多 ${MAX_TIME_SESSIONS_PER_COURSE} 个时段`)
        return
      }
      for (let i = 0; i < raw.length; i += 1) {
        const seg = raw[i]
        if (parseHmLocal(seg.endTime) <= parseHmLocal(seg.startTime)) {
          setMessage(`时段 ${i + 1}：结束时间须晚于开始时间`)
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
        setMessage('请至少选择一个节次')
        return
      }
      if (periodIds.length > MAX_TIME_SESSIONS_PER_COURSE) {
        setMessage(`同一课程最多 ${MAX_TIME_SESSIONS_PER_COURSE} 个节次`)
        return
      }
      const withIds: ScheduleCourse = { ...editing, periodIds, timeMode: 'periods' }
      const resolvedSessions = getCourseTimeSessions(withIds, periodTemplate)
      if (resolvedSessions.length === 0) {
        setMessage('所选节次无效，请检查固定节次模板')
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
      setMessage('请粘贴 ICS 内容')
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
    setMessage(`已导入 ${result.courses.length} 门课程${w}`)
  }

  const onFileUpload = (file: File | null) => {
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

  if (loading) {
    return <div className="text-sm text-muted-foreground">加载课表配置中…</div>
  }

  return (
    <>
    <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-sm space-y-4 sm:space-y-5">
      {message ? (
        <div className="text-sm text-muted-foreground border border-border/60 rounded-md px-3 py-2 bg-muted/20">
          {message}
        </div>
      ) : null}

      <div className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-3">
        <h4 className="text-sm font-medium text-foreground">主页展示</h4>
        <p className="text-xs text-muted-foreground">
          开启后，访客在自己本地时间的上课时段内，会在首页个人资料右侧看到「正在上课」卡片。
        </p>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="sched-in-class" className="font-normal cursor-pointer">
            上课时间在主页显示「正在上课」
          </Label>
          <Switch
            id="sched-in-class"
            checked={inClassOnHome}
            onCheckedChange={setInClassOnHome}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="sched-home-next" className="font-normal cursor-pointer">
            在课间显示「下一节」课程预告
          </Label>
          <Switch
            id="sched-home-next"
            checked={homeShowNextUpcoming}
            onCheckedChange={setHomeShowNextUpcoming}
            disabled={!inClassOnHome}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="sched-home-loc" className="font-normal cursor-pointer">
            卡片中显示上课地点
          </Label>
          <Switch
            id="sched-home-loc"
            checked={homeShowLocation}
            onCheckedChange={setHomeShowLocation}
            disabled={!inClassOnHome}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="sched-home-teacher" className="font-normal cursor-pointer">
            卡片中显示任课教师
          </Label>
          <Switch
            id="sched-home-teacher"
            checked={homeShowTeacher}
            onCheckedChange={setHomeShowTeacher}
            disabled={!inClassOnHome}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sched-home-after-label">今日课程已全部结束时的左侧文案</Label>
          <Input
            id="sched-home-after-label"
            value={homeAfterClassesLabel}
            onChange={(e) => setHomeAfterClassesLabel(e.target.value.slice(0, 40))}
            placeholder="正在摸鱼"
            maxLength={40}
            disabled={!inClassOnHome}
            className="max-w-md"
          />
          <p className="text-xs text-muted-foreground">
            对应首页「今天已经没课啦！」时，原「正在上课」位置显示此文案；留空保存后为「正在摸鱼」。
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-3 overflow-x-hidden min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-foreground min-w-0">固定节次模板（全站共用）</h4>
        </div>
        <p className="text-xs text-muted-foreground text-pretty leading-relaxed">
          课程只选择节次，不再手填具体时间。修改模板后，已有课程会自动按新节次时间显示。同一时段内拖动左侧手柄调整节次顺序。
        </p>
        {compatWarnings.length > 0 ? (
          <div className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
            {compatWarnings[0]}
            {compatWarnings.length > 1 ? ` 等 ${compatWarnings.length} 条` : ''}
          </div>
        ) : null}
        <div className="space-y-3">
          {(['morning', 'afternoon', 'evening'] as const).map((part) => {
            const rows = [...periodTemplate]
              .filter((p) => p.part === part)
              .sort((a, b) => a.order - b.order)
            return (
              <div key={part} className="space-y-2 min-w-0">
                <div className="flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
                  <Label className="shrink-0 text-sm font-medium">{PERIOD_PART_LABELS[part]}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full shrink-0 min-[480px]:w-auto"
                    onClick={() => addPeriodTemplateItem(part)}
                  >
                    新增节次
                  </Button>
                </div>
                {rows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">暂无节次</p>
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
        <div className="inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-muted/25 p-0.5 shadow-sm">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-full"
            onClick={() => setWeekRef((w) => addWeeks(w, -1))}
            aria-label="上一周"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-xs tabular-nums min-w-[150px] sm:min-w-[180px] text-center text-foreground/90 px-1">
            {format(startOfWeek(weekRef, { weekStartsOn: 1 }), 'yyyy-MM-dd')} 起
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-full"
            onClick={() => setWeekRef((w) => addWeeks(w, 1))}
            aria-label="下一周"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 rounded-full px-2.5 text-xs"
            onClick={() => setWeekRef(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            本周
          </Button>
        </div>
      </div>

      <WeekTimetableGrid
        weekRef={weekRef}
        periodTemplate={periodTemplate}
        occurrences={occurrences}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-foreground">课程列表</h4>
          <Button type="button" size="sm" variant="secondary" onClick={openNew}>
            添加课程
          </Button>
        </div>
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无课程，请添加或导入 ICS。</p>
        ) : (
          <ul className="space-y-1.5">
            {courses.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-2 text-sm transition-colors hover:bg-muted/35"
              >
                <div>
                  <span className="font-medium">{c.title}</span>
                  <span className="text-muted-foreground ml-2">
                    {WEEKDAY_OPTIONS.find((w) => w.value === c.weekday)?.label}{' '}
                    {formatCourseTimeRanges(c, periodTemplate)}
                  </span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    开课 {c.anchorDate}
                    {c.untilDate ? ` 至 ${c.untilDate}` : '（无结课）'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(c)}>
                    编辑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => removeCourse(c.id)}
                  >
                    删除
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id && courses.some((c) => c.id === editing.id) ? '编辑课程' : '添加课程'}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label>课程名称</Label>
                <Input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>地点（可选）</Label>
                <Input
                  value={editing.location ?? ''}
                  onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>任课教师（可选）</Label>
                <Input
                  value={editing.teacher ?? ''}
                  onChange={(e) => setEditing({ ...editing, teacher: e.target.value })}
                  placeholder="仅在开启「显示任课教师」时展示"
                />
              </div>
              <div className="space-y-2">
                <Label>星期</Label>
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
                    {WEEKDAY_OPTIONS.map((w) => (
                      <SelectItem key={w.value} value={String(w.value)}>
                        {w.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>时间方式</Label>
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
                      固定节次（跟随模板）
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="custom" id="sched-tm-custom" />
                    <Label htmlFor="sched-tm-custom" className="font-normal cursor-pointer">
                      自定义时间
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              {(editing.timeMode ?? 'periods') === 'custom' ? (
                <div className="space-y-2">
                  <Label>时段</Label>
                  <p className="text-[11px] text-muted-foreground">
                    手动填写开始与结束时间；同一课程可多段。
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
                        aria-label="删除时段"
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
                    添加时段
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>选择节次（可多选）</Label>
                  <p className="text-[11px] text-muted-foreground">
                    课程时间由固定节次模板决定。若模板修改，课程会自动按新时间变化。
                  </p>
                  <div className="space-y-2">
                    {(['morning', 'afternoon', 'evening'] as const).map((part) => {
                      const rows = [...periodTemplate]
                        .filter((p) => p.part === part)
                        .sort((a, b) => a.order - b.order)
                      if (rows.length === 0) return null
                      return (
                        <div key={part} className="space-y-1">
                          <div className="text-xs text-muted-foreground">{PERIOD_PART_LABELS[part]}</div>
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
                </div>
              )}
              <div className="space-y-2">
                <Label>开课日期（首次上课）</Label>
                <Input
                  type="date"
                  value={editing.anchorDate}
                  onChange={(e) =>
                    setEditing({ ...editing, anchorDate: e.target.value })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  须与「星期」一致；修改星期时会自动对齐到该星期最近的一天（含当天之后）。
                </p>
              </div>
              <div className="space-y-2">
                <Label>结课日期（可选，含当天）</Label>
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
              取消
            </Button>
            <Button type="button" onClick={commitEditor}>
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={icsDialogOpen} onOpenChange={setIcsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>导入 ICS</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>选择文件</Label>
              <Input
                type="file"
                accept=".ics,.ical,text/calendar"
                onChange={(e) => onFileUpload(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label>或粘贴内容</Label>
              <Textarea
                value={icsPaste}
                onChange={(e) => setIcsPaste(e.target.value)}
                rows={8}
                className="font-mono text-xs"
                placeholder="BEGIN:VCALENDAR..."
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
                  替换现有课程
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="append" id="ics-append" />
                <Label htmlFor="ics-append" className="font-normal cursor-pointer">
                  追加（重复 UID 会生成新 id）
                </Label>
              </div>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIcsDialogOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={applyIcsImport}>
              解析并写入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    <UnsavedChangesBar
      open={scheduleDirty}
      saving={saving}
      onSave={save}
      onRevert={revertUnsavedSchedule}
      saveLabel="保存到站点配置"
      revertLabel="撤销"
    />
    </>
  )
})
