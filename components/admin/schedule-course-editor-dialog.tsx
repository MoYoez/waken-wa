'use client'

import { Plus, Trash2 } from 'lucide-react'
import { AnimatePresence, motion, type Transition, type Variants } from 'motion/react'
import { useState } from 'react'

import { getPeriodPartLabel } from '@/components/admin/schedule-manager-utils'
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
import {
  getCourseTimeSessions,
  MAX_TIME_SESSIONS_PER_COURSE,
  type ScheduleCourse,
  type SchedulePeriodTemplateItem,
  type ScheduleTimeSession,
  snapAnchorToWeekday,
} from '@/lib/schedule-courses'

interface ScheduleCourseEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: ScheduleCourse | null
  courses: ScheduleCourse[]
  periodTemplate: SchedulePeriodTemplateItem[]
  weekdayOptions: { value: number; label: string }[]
  onSave: (course: ScheduleCourse) => void
  sectionVariants: Variants
  sectionTransition: Transition
  busy?: boolean
  t: (key: string, opts?: Record<string, unknown>) => string
}

export function ScheduleCourseEditorDialog({
  open,
  onOpenChange,
  editing: editingProp,
  courses,
  periodTemplate,
  weekdayOptions,
  onSave,
  sectionVariants,
  sectionTransition,
  t,
}: ScheduleCourseEditorDialogProps) {
  const [editing, setEditing] = useState<ScheduleCourse | null>(editingProp)
  const [message, setMessage] = useState('')

  // Sync from parent when editingProp changes
  // We use a ref-like check to detect prop changes
  const [prevEditingProp, setPrevEditingProp] = useState<ScheduleCourse | null>(editingProp)
  if (editingProp !== prevEditingProp) {
    setPrevEditingProp(editingProp)
    setEditing(editingProp)
    setMessage('')
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
    onSave(next)
    setMessage('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={commitEditor}>
            {t('scheduleManager.editor.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
