'use client'

import { useT } from 'next-i18next/client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

type ScheduleHomeDisplayCardProps = {
  inClassOnHome: boolean
  homeShowLocation: boolean
  homeShowTeacher: boolean
  homeShowNextUpcoming: boolean
  homeAfterClassesLabel: string
  onSetInClassOnHome: (value: boolean) => void
  onSetHomeShowLocation: (value: boolean) => void
  onSetHomeShowTeacher: (value: boolean) => void
  onSetHomeShowNextUpcoming: (value: boolean) => void
  onSetHomeAfterClassesLabel: (value: string) => void
}

export function ScheduleHomeDisplayCard({
  inClassOnHome,
  homeShowLocation,
  homeShowTeacher,
  homeShowNextUpcoming,
  homeAfterClassesLabel,
  onSetInClassOnHome,
  onSetHomeShowLocation,
  onSetHomeShowTeacher,
  onSetHomeShowNextUpcoming,
  onSetHomeAfterClassesLabel,
}: ScheduleHomeDisplayCardProps) {
  const { t } = useT('admin')

  return (
    <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-3">
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
          onCheckedChange={onSetInClassOnHome}
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
          onCheckedChange={onSetHomeShowNextUpcoming}
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
          onCheckedChange={onSetHomeShowLocation}
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
          onCheckedChange={onSetHomeShowTeacher}
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
          onChange={(e) => onSetHomeAfterClassesLabel(e.target.value.slice(0, 40))}
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
  )
}
