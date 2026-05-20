import {
  AnimatePresence,
  motion,
  type Transition,
  type Variants,
} from 'motion/react'

import { summarizeAppRuleGroup } from '@/components/admin/rule-tools-utils'
import { Button } from '@/components/ui/button'
import type { RuleToolsRuleItem } from '@/types/rule-tools'

export function RuleToolsPreview({
  isLoading,
  previewItems,
  previewTotal,
  previewOverflow,
  canEdit,
  sectionVariants,
  sectionTransition,
  t,
  onOpenRuleEditor,
}: {
  isLoading: boolean
  previewItems: RuleToolsRuleItem[]
  previewTotal: number
  previewOverflow: number
  canEdit: boolean
  sectionVariants: Variants
  sectionTransition: Transition
  t: (key: string, values?: Record<string, unknown>) => string
  onOpenRuleEditor: (id: string) => void
}) {
  if (isLoading && previewItems.length === 0) {
    return <p className="text-xs text-muted-foreground">{t('webSettings.loading')}</p>
  }
  if (previewItems.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {t('webSettingsRuleTools.appRules.noRules')}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <motion.ul className="space-y-3" layout>
        <AnimatePresence initial={false}>
          {previewItems.map((item) => (
            <motion.li
              key={item.id}
              className="rounded-xl border border-border bg-background/70 px-3 py-3"
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={sectionTransition}
              layout
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {t('webSettingsRuleTools.appRules.ruleIndex', {
                      index: item.position + 1,
                      total: previewTotal,
                    })}
                  </p>
                  <p className="text-sm leading-6 text-foreground">
                    {summarizeAppRuleGroup(item, t)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!canEdit}
                  onClick={() => onOpenRuleEditor(item.id)}
                >
                  {t('common.edit')}
                </Button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
      {previewOverflow > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('webSettingsRuleTools.appRules.moreRulesHint', { value: previewOverflow })}
        </p>
      ) : null}
    </div>
  )
}
