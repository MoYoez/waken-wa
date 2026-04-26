'use client'

import { useState } from 'react'

import { FileSelectTrigger } from '@/components/admin/file-select-trigger'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import {
  backfillCoursePeriodIdsFromTemplate,
  newScheduleCourseId,
  type ScheduleCourse,
  type SchedulePeriodTemplateItem,
} from '@/lib/schedule-courses'
import { importIcsToCourses } from '@/lib/schedule-ics'

interface ScheduleIcsImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courses: ScheduleCourse[]
  periodTemplate: SchedulePeriodTemplateItem[]
  scheduleSlotMinutes?: number
  onImport: (result: { courses: ScheduleCourse[]; icsRaw: string; compatWarnings: string[]; icsWarnings: string[]; importedCount: number }) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

export function ScheduleIcsImportDialog({
  open,
  onOpenChange,
  courses,
  periodTemplate,
  onImport,
  t,
}: ScheduleIcsImportDialogProps) {
  const [icsPaste, setIcsPaste] = useState('')
  const [icsMergeMode, setIcsMergeMode] = useState<'replace' | 'append'>('replace')
  const [message, setMessage] = useState('')

  const onFileUpload = (file?: File) => {
    if (!file) return
    file.text().then((text) => {
      setIcsPaste(text)
    })
  }

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
    onImport({
      courses: backfilled.courses,
      icsRaw: text,
      compatWarnings: backfilled.warnings,
      icsWarnings: result.warnings,
      importedCount: result.courses.length,
    })
    onOpenChange(false)
    setIcsPaste('')
    setMessage('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('scheduleManager.icsImport.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {message ? (
            <div className="text-sm text-muted-foreground border border-border/60 rounded-md px-3 py-2 bg-muted/20">
              {message}
            </div>
          ) : null}
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={applyIcsImport}>
            {t('scheduleManager.icsImport.parseAndWrite')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
