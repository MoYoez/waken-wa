import {
  AnimatePresence,
  motion,
  type Transition,
  type Variants,
} from 'motion/react'

import { getTitleRuleRegexErrorMessage } from '@/components/admin/rule-tools-utils'
import { Autocomplete } from '@/components/ui/autocomplete'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import type {
  AppMessageTitleRule,
  AppTitleRuleMode,
  RuleToolsRuleItem,
} from '@/types/rule-tools'

type RuleToolsGroupEditorT = (key: string, values?: Record<string, unknown>) => string

function GetTitleRuleModeDescriptionKey(mode: AppTitleRuleMode): string {
  switch (mode) {
    case 'regex':
      return 'webSettingsRuleTools.appRules.titleRuleModeRegexDescription'
    case 'plain':
    default:
      return 'webSettingsRuleTools.appRules.titleRuleModePlainDescription'
  }
}

function GetTitleRulePatternPlaceholderKey(mode: AppTitleRuleMode): string {
  switch (mode) {
    case 'regex':
      return 'webSettingsRuleTools.appRules.titleRulePatternRegexPlaceholder'
    case 'plain':
    default:
      return 'webSettingsRuleTools.appRules.titleRulePatternPlainPlaceholder'
  }
}

function ParseTitleRuleMode(value: string): AppTitleRuleMode {
  switch (value) {
    case 'regex':
      return 'regex'
    case 'plain':
    default:
      return 'plain'
  }
}

export function RuleToolsGroupEditor({
  mobile,
  isLoading,
  hasPayload,
  busy,
  selectedRule,
  totalRuleCount,
  ruleProcessSuggestions,
  captureReportedAppsEnabled,
  sectionVariants,
  sectionTransition,
  t,
  onChooseGroup,
  onAddRuleGroup,
  onMoveRuleGroup,
  onDeleteRuleGroup,
  onAddTitleRule,
  onDeleteTitleRule,
  onMoveTitleRule,
  onTitleRuleModeChange,
  updateRuleDraft,
  updateTitleRuleDraft,
}: {
  mobile: boolean
  isLoading: boolean
  hasPayload: boolean
  busy: boolean
  selectedRule: RuleToolsRuleItem | null
  totalRuleCount: number
  ruleProcessSuggestions: string[]
  captureReportedAppsEnabled: boolean
  sectionVariants: Variants
  sectionTransition: Transition
  t: RuleToolsGroupEditorT
  onChooseGroup: () => void
  onAddRuleGroup: (openEditor: boolean) => void
  onMoveRuleGroup: (groupId: string, nextPosition: number) => void
  onDeleteRuleGroup: (groupId: string) => void
  onAddTitleRule: () => void
  onDeleteTitleRule: (titleRuleId: string) => void
  onMoveTitleRule: (titleRuleId: string, nextPosition: number) => void
  onTitleRuleModeChange: (titleRuleId: string, nextMode: AppTitleRuleMode) => void
  updateRuleDraft: (updater: (current: RuleToolsRuleItem) => RuleToolsRuleItem) => void
  updateTitleRuleDraft: (
    titleRuleId: string,
    updater: (current: AppMessageTitleRule) => AppMessageTitleRule,
  ) => void
}) {
  if (isLoading && !selectedRule) {
    return <p className="text-xs text-muted-foreground">{t('webSettings.loading')}</p>
  }
  if (!selectedRule) {
    return (
      <div className="flex h-full min-h-[18rem] items-center justify-center rounded-lg border border-dashed border-border bg-background/30 px-6 py-8 text-center">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            {t('webSettingsRuleTools.appRules.emptyEditorTitle')}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t('webSettingsRuleTools.appRules.emptyEditorDescription')}
          </p>
          {mobile ? (
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <Button
                type="button"
                disabled={!hasPayload || busy}
                onClick={() => onAddRuleGroup(true)}
              >
                {t('webSettingsRuleTools.appRules.addGroup')}
              </Button>
              <Button type="button" variant="outline" onClick={onChooseGroup}>
                {t('webSettingsRuleTools.appRules.chooseAnotherGroup')}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  const groupIndex = selectedRule.position

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/[0.08] p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {t('webSettingsRuleTools.appRules.groupEditorTitle')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('webSettingsRuleTools.appRules.ruleIndex', {
                index: groupIndex + 1,
                total: totalRuleCount,
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {mobile ? (
              <Button type="button" size="sm" variant="outline" onClick={onChooseGroup}>
                {t('webSettingsRuleTools.appRules.chooseAnotherGroup')}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy || selectedRule.position <= 0}
              onClick={() => onMoveRuleGroup(selectedRule.id, selectedRule.position - 1)}
            >
              {t('webSettingsRuleTools.appRules.moveUp')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy || selectedRule.position >= totalRuleCount - 1}
              onClick={() => onMoveRuleGroup(selectedRule.id, selectedRule.position + 1)}
            >
              {t('webSettingsRuleTools.appRules.moveDown')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => onDeleteRuleGroup(selectedRule.id)}
            >
              {t('common.delete')}
            </Button>
          </div>
        </div>
        <p className="text-xs leading-6 text-muted-foreground">
          {t('webSettingsRuleTools.appRules.groupEditorDescription')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rule-group-process-match">
          {t('webSettingsRuleTools.appRules.processMatchLabel')}
        </Label>
        <Autocomplete
          id="rule-group-process-match"
          items={ruleProcessSuggestions}
          value={selectedRule.processMatch}
          onValueChange={(value) =>
            updateRuleDraft((current) => ({
              ...current,
              processMatch: value,
            }))
          }
          placeholder={t('webSettingsRuleTools.appRules.processMatchPlaceholder')}
          inputClassName="font-mono"
          emptyText={
            captureReportedAppsEnabled
              ? t('webSettingsRuleTools.appRules.noMatchingHistoryApp')
              : t('webSettingsRuleTools.appNameListEditor.historyDisabled')
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rule-group-default-text">
          {t('webSettingsRuleTools.appRules.defaultTextLabel')}
        </Label>
        <Textarea
          id="rule-group-default-text"
          rows={3}
          value={selectedRule.defaultText ?? ''}
          onChange={(event) =>
            updateRuleDraft((current) => ({
              ...current,
              defaultText: event.target.value || undefined,
            }))
          }
          placeholder={t('webSettingsRuleTools.appRules.defaultTextPlaceholder')}
        />
        <p className="text-xs leading-6 text-muted-foreground">
          {t('webSettingsRuleTools.appRules.defaultTextDescription')}
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-background/70 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {t('webSettingsRuleTools.appRules.titleRulesTitle')}
            </p>
            <p className="text-xs leading-6 text-muted-foreground">
              {t('webSettingsRuleTools.appRules.titleRulesDescription')}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={onAddTitleRule}
          >
            {t('webSettingsRuleTools.appRules.addTitleRule')}
          </Button>
        </div>

        {selectedRule.titleRules.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t('webSettingsRuleTools.appRules.noTitleRules')}
          </p>
        ) : (
          <motion.ul className="space-y-3" layout>
            <AnimatePresence initial={false}>
              {selectedRule.titleRules.map((titleRule, index) => {
                const isFirst = index <= 0
                const isLast = index >= selectedRule.titleRules.length - 1
                const regexError = getTitleRuleRegexErrorMessage(
                  titleRule,
                  groupIndex,
                  index,
                  t,
                )
                return (
                  <motion.li
                    key={titleRule.id}
                    className="rounded-xl border border-border bg-muted/[0.04] p-4"
                    variants={sectionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={sectionTransition}
                    layout
                  >
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">
                            {t('webSettingsRuleTools.appRules.titleRuleIndex', {
                              index: index + 1,
                              total: selectedRule.titleRules.length,
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t(GetTitleRuleModeDescriptionKey(titleRule.mode))}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy || isFirst}
                            onClick={() => onMoveTitleRule(titleRule.id, index - 1)}
                          >
                            {t('webSettingsRuleTools.appRules.moveUp')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy || isLast}
                            onClick={() => onMoveTitleRule(titleRule.id, index + 1)}
                          >
                            {t('webSettingsRuleTools.appRules.moveDown')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => onDeleteTitleRule(titleRule.id)}
                          >
                            {t('common.delete')}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>{t('webSettingsRuleTools.appRules.titleRuleModeLabel')}</Label>
                        <RadioGroup
                          value={titleRule.mode}
                          onValueChange={(value) => {
                            onTitleRuleModeChange(titleRule.id, ParseTitleRuleMode(value))
                          }}
                          className="grid gap-3 sm:grid-cols-2"
                        >
                          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background/60 px-3 py-3">
                            <RadioGroupItem value="plain" id={`${titleRule.id}-plain`} />
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-foreground">
                                {t('webSettingsRuleTools.appRules.titleRuleModePlain')}
                              </p>
                              <p className="text-xs leading-6 text-muted-foreground">
                                {t('webSettingsRuleTools.appRules.titleRuleModePlainDescription')}
                              </p>
                            </div>
                          </label>
                          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background/60 px-3 py-3">
                            <RadioGroupItem value="regex" id={`${titleRule.id}-regex`} />
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-foreground">
                                {t('webSettingsRuleTools.appRules.titleRuleModeRegex')}
                              </p>
                              <p className="text-xs leading-6 text-muted-foreground">
                                {t('webSettingsRuleTools.appRules.titleRuleModeRegexDescription')}
                              </p>
                            </div>
                          </label>
                        </RadioGroup>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`${titleRule.id}-pattern`}>
                          {t('webSettingsRuleTools.appRules.titleRulePatternLabel')}
                        </Label>
                        <Input
                          id={`${titleRule.id}-pattern`}
                          value={titleRule.pattern}
                          onChange={(event) =>
                            updateTitleRuleDraft(titleRule.id, (current) => ({
                              ...current,
                              pattern: event.target.value,
                            }))
                          }
                          className="font-mono"
                          placeholder={t(GetTitleRulePatternPlaceholderKey(titleRule.mode))}
                        />
                        {regexError ? (
                          <p className="text-xs leading-6 text-destructive">{regexError}</p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`${titleRule.id}-text`}>
                          {t('webSettingsRuleTools.appRules.titleRuleTextLabel')}
                        </Label>
                        <Textarea
                          id={`${titleRule.id}-text`}
                          rows={2}
                          value={titleRule.text}
                          onChange={(event) =>
                            updateTitleRuleDraft(titleRule.id, (current) => ({
                              ...current,
                              text: event.target.value,
                            }))
                          }
                          placeholder={t('webSettingsRuleTools.appRules.titleRuleTextPlaceholder')}
                        />
                        <p className="text-xs leading-6 text-muted-foreground">
                          {t('webSettingsRuleTools.appRules.titleRuleTextDescription')}
                        </p>
                      </div>
                    </div>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>

      <p className="text-xs leading-6 text-muted-foreground">
        {t('webSettingsRuleTools.appRules.helpText', {
          process: '{process}',
          title: '{title}',
        })}
      </p>
    </div>
  )
}
