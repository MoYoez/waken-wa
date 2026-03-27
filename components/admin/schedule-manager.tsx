'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addWeeks, format, startOfWeek } from 'date-fns'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'

import { WeekTimetableGrid } from '@/components/admin/week-timetable-grid'
import { Button } from '@/components/ui/button'
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
import { exportCoursesToIcs, importIcsToCourses } from '@/lib/schedule-ics'
import {
  expandOccurrencesInWeek,
  getCourseTimeSessions,
  MAX_TIME_SESSIONS_PER_COURSE,
  newScheduleCourseId,
  SCHEDULE_SLOT_MINUTES_ALLOWED,
  type ScheduleCourse,
  type ScheduleTimeSession,
  snapAnchorToWeekday,
} from '@/lib/schedule-courses'

const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '周一' },
  { value: 1, label: '周二' },
  { value: 2, label: '周三' },
  { value: 3, label: '周四' },
  { value: 4, label: '周五' },
  { value: 5, label: '周六' },
  { value: 6, label: '周日' },
]

function emptyCourse(): ScheduleCourse {
  const today = format(new Date(), 'yyyy-MM-dd')
  return {
    id: newScheduleCourseId(),
    title: '',
    weekday: 0,
    startTime: '09:00',
    endTime: '10:00',
    timeSessions: [{ startTime: '09:00', endTime: '10:00' }],
    anchorDate: today,
    untilDate: undefined,
  }
}

function formatCourseTimeRanges(c: ScheduleCourse): string {
  return getCourseTimeSessions(c).map((s) => `${s.startTime}–${s.endTime}`).join('、')
}

export function ScheduleManager() {
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [serverData, setServerData] = useState<Record<string, unknown> | null>(null)
  const [courses, setCourses] = useState<ScheduleCourse[]>([])
  const [slotMinutes, setSlotMinutes] = useState<number>(30)
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
  const [homeAfterClassesLabel, setHomeAfterClassesLabel] = useState('正在摸鱼')

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/settings')
      const data = await res.json()
      if (!res.ok || !data?.success || !data?.data) {
        setMessage(data?.error || '加载失败')
        return
      }
      const d = data.data as Record<string, unknown>
      setServerData(d)
      setCourses(Array.isArray(d.scheduleCourses) ? (d.scheduleCourses as ScheduleCourse[]) : [])
      setSlotMinutes(
        typeof d.scheduleSlotMinutes === 'number' ? d.scheduleSlotMinutes : 30,
      )
      setIcsRaw(typeof d.scheduleIcs === 'string' ? d.scheduleIcs : '')
      setInClassOnHome(Boolean(d.scheduleInClassOnHome))
      setHomeShowLocation(Boolean(d.scheduleHomeShowLocation))
      setHomeShowTeacher(Boolean(d.scheduleHomeShowTeacher))
      setHomeAfterClassesLabel(
        typeof d.scheduleHomeAfterClassesLabel === 'string' &&
          d.scheduleHomeAfterClassesLabel.trim().length > 0
          ? d.scheduleHomeAfterClassesLabel.trim().slice(0, 40)
          : '正在摸鱼',
      )
    } catch {
      setMessage('网络异常')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const occurrences = useMemo(
    () => expandOccurrencesInWeek(courses, weekRef),
    [courses, weekRef],
  )

  const save = async () => {
    if (!serverData) {
      setMessage('尚未加载配置')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const body = buildAdminSettingsPatchBody(serverData, {
        scheduleSlotMinutes: slotMinutes,
        scheduleCourses: courses,
        scheduleIcs: icsRaw.length > 0 ? icsRaw : '',
        scheduleInClassOnHome: inClassOnHome,
        scheduleHomeShowLocation: homeShowLocation,
        scheduleHomeShowTeacher: homeShowTeacher,
        scheduleHomeAfterClassesLabel: homeAfterClassesLabel.trim() || '正在摸鱼',
      })
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setMessage(data?.error || '保存失败')
        return
      }
      setMessage('已保存')
      setServerData(data.data as Record<string, unknown>)
    } catch {
      setMessage('网络异常')
    } finally {
      setSaving(false)
    }
  }

  const openNew = () => {
    setEditing(emptyCourse())
    setDialogOpen(true)
  }

  const openEdit = (c: ScheduleCourse) => {
    const sessions = getCourseTimeSessions(c)
    setEditing({
      ...c,
      timeSessions: sessions.map((s) => ({ ...s })),
      startTime: sessions[0].startTime,
      endTime: sessions[0].endTime,
    })
    setDialogOpen(true)
  }

  const commitEditor = () => {
    if (!editing || !editing.title.trim()) {
      setMessage('请填写课程名称')
      return
    }
    const rawSessions: ScheduleTimeSession[] =
      editing.timeSessions && editing.timeSessions.length > 0
        ? editing.timeSessions
        : [{ startTime: editing.startTime, endTime: editing.endTime }]
    if (rawSessions.length > MAX_TIME_SESSIONS_PER_COURSE) {
      setMessage(`同一课程最多 ${MAX_TIME_SESSIONS_PER_COURSE} 个时段`)
      return
    }
    for (let i = 0; i < rawSessions.length; i += 1) {
      const [sh, sm] = rawSessions[i].startTime.split(':').map(Number)
      const [eh, em] = rawSessions[i].endTime.split(':').map(Number)
      if (eh * 60 + em <= sh * 60 + sm) {
        setMessage(`时段 ${i + 1}：结束时间必须晚于开始时间`)
        return
      }
    }
    const first = rawSessions[0]
    let next: ScheduleCourse = {
      ...editing,
      title: editing.title.trim(),
      startTime: first.startTime,
      endTime: first.endTime,
      timeSessions: rawSessions.length > 1 ? rawSessions : undefined,
      anchorDate: snapAnchorToWeekday(editing.anchorDate, editing.weekday),
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
    setCourses(next)
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

  if (loading) {
    return <div className="text-sm text-muted-foreground">加载课表配置中…</div>
  }

  return (
    <div className="rounded-xl border bg-card p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            课表
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            仅管理员可见；支持周视图、ICS 导入/导出与开课日期周期。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setIcsDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-1" />
            导入 ICS
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadIcs}
            disabled={courses.length === 0}
          >
            <Download className="h-4 w-4 mr-1" />
            导出 ICS
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={saving || !serverData}>
            {saving ? '保存中…' : '保存到站点配置'}
          </Button>
        </div>
      </div>

      {message ? (
        <div className="text-sm text-muted-foreground border border-border/60 rounded-md px-3 py-2 bg-muted/20">
          {message}
        </div>
      ) : null}

      <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-4">
        <h4 className="text-sm font-medium text-foreground">主页展示</h4>
        <p className="text-xs text-muted-foreground">
          开启后，访客在自己本地时间的上课时段内，会在首页个人资料右侧看到「正在上课」卡片（仍须点击保存写入配置）。
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

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>网格刻度（分钟）</Label>
          <Select
            value={String(slotMinutes)}
            onValueChange={(v) => setSlotMinutes(Number(v))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCHEDULE_SLOT_MINUTES_ALLOWED.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m} 分钟
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setWeekRef((w) => addWeeks(w, -1))}
            aria-label="上一周"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm tabular-nums min-w-[200px] text-center">
            {format(startOfWeek(weekRef, { weekStartsOn: 1 }), 'yyyy-MM-dd')} 起
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setWeekRef((w) => addWeeks(w, 1))}
            aria-label="下一周"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setWeekRef(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            本周
          </Button>
        </div>
      </div>

      <WeekTimetableGrid weekRef={weekRef} slotMinutes={slotMinutes} occurrences={occurrences} />

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
          <ul className="space-y-2">
            {courses.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">{c.title}</span>
                  <span className="text-muted-foreground ml-2">
                    {WEEKDAY_OPTIONS.find((w) => w.value === c.weekday)?.label}{' '}
                    {formatCourseTimeRanges(c)}
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
                <div className="flex items-center justify-between gap-2">
                  <Label>上课时段</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={
                      (editing.timeSessions?.length ?? 1) >= MAX_TIME_SESSIONS_PER_COURSE
                    }
                    onClick={() => {
                      const cur =
                        editing.timeSessions && editing.timeSessions.length > 0
                          ? editing.timeSessions
                          : [{ startTime: editing.startTime, endTime: editing.endTime }]
                      const extra: ScheduleTimeSession = { startTime: '14:00', endTime: '15:30' }
                      const nextSessions = [...cur, extra]
                      setEditing({
                        ...editing,
                        timeSessions: nextSessions,
                        startTime: nextSessions[0].startTime,
                        endTime: nextSessions[0].endTime,
                      })
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    添加时段
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  同一天可设多段（如上午、下午不同时间）；每段独立显示在课表与「正在上课」中。
                </p>
                {(editing.timeSessions && editing.timeSessions.length > 0
                  ? editing.timeSessions
                  : [{ startTime: editing.startTime, endTime: editing.endTime }]
                ).map((seg, idx, arr) => (
                  <div key={idx} className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground">开始</span>
                      <Input
                        type="time"
                        className="w-[7.5rem]"
                        value={seg.startTime}
                        onChange={(e) => {
                          const v = e.target.value
                          const base =
                            editing.timeSessions && editing.timeSessions.length > 0
                              ? [...editing.timeSessions]
                              : [{ startTime: editing.startTime, endTime: editing.endTime }]
                          base[idx] = { ...base[idx], startTime: v }
                          setEditing({
                            ...editing,
                            timeSessions: base,
                            startTime: base[0].startTime,
                            endTime: base[0].endTime,
                          })
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground">结束</span>
                      <Input
                        type="time"
                        className="w-[7.5rem]"
                        value={seg.endTime}
                        onChange={(e) => {
                          const v = e.target.value
                          const base =
                            editing.timeSessions && editing.timeSessions.length > 0
                              ? [...editing.timeSessions]
                              : [{ startTime: editing.startTime, endTime: editing.endTime }]
                          base[idx] = { ...base[idx], endTime: v }
                          setEditing({
                            ...editing,
                            timeSessions: base,
                            startTime: base[0].startTime,
                            endTime: base[0].endTime,
                          })
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground"
                      disabled={arr.length <= 1}
                      title={arr.length <= 1 ? '至少保留一个时段' : '删除此时段'}
                      onClick={() => {
                        if (arr.length <= 1) return
                        const base =
                          editing.timeSessions && editing.timeSessions.length > 0
                            ? [...editing.timeSessions]
                            : [{ startTime: editing.startTime, endTime: editing.endTime }]
                        base.splice(idx, 1)
                        setEditing({
                          ...editing,
                          timeSessions: base,
                          startTime: base[0].startTime,
                          endTime: base[0].endTime,
                        })
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
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
          <DialogFooter className="gap-2 sm:gap-0">
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
  )
}
