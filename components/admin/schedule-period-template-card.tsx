'use client'

import { AnimatePresence, motion, type Transition, type Variants } from 'motion/react'
import { useT } from 'next-i18next/client'

import { getPeriodPartLabel } from '@/components/admin/schedule-manager-utils'
import { SortablePeriodTemplatePart } from '@/components/admin/sortable-period-template-part'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type {
  SchedulePeriodPart,
  SchedulePeriodTemplateItem,
} from '@/lib/schedule-courses'

type SchedulePeriodTemplateCardProps = {
  compatWarnings: string[]
  periodTemplate: SchedulePeriodTemplateItem[]
  sectionTransition: Transition
  compactSectionVariants: Variants
  onAddPeriodTemplateItem: (part: SchedulePeriodPart) => void
  onReorderPeriodTemplatePart: (part: SchedulePeriodPart, orderedIds: string[]) => void
  onPatchPeriodTemplateItem: (
    id: string,
    patch: Partial<SchedulePeriodTemplateItem>,
  ) => void
  onRemovePeriodTemplateItem: (id: string) => void
}

export function SchedulePeriodTemplateCard({
  compatWarnings,
  periodTemplate,
  sectionTransition,
  compactSectionVariants,
  onAddPeriodTemplateItem,
  onReorderPeriodTemplatePart,
  onPatchPeriodTemplateItem,
  onRemovePeriodTemplateItem,
}: SchedulePeriodTemplateCardProps) {
  const { t } = useT('admin')

  return (
    <div className="rounded-lg border border-border bg-muted/10 p-2.5 sm:p-3 space-y-2.5 sm:space-y-3 overflow-x-hidden min-w-0">
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
            .filter((item) => item.part === part)
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
                  onClick={() => onAddPeriodTemplateItem(part)}
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
                  onReorderOrderedIds={onReorderPeriodTemplatePart}
                  patchItem={onPatchPeriodTemplateItem}
                  removeItem={onRemovePeriodTemplateItem}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
