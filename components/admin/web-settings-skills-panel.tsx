'use client'

import { useAtom } from 'jotai'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useT } from 'next-i18next/client'

import { getAdminPanelTransition, getAdminSectionVariants } from '@/components/admin/admin-motion'
import {
  WebSettingsInset,
  WebSettingsRow,
  WebSettingsRows,
} from '@/components/admin/web-settings-layout'
import { WebSettingsSkillsAuthPanel } from '@/components/admin/web-settings-skills-auth-panel'
import { WebSettingsSkillsMcpPanel } from '@/components/admin/web-settings-skills-mcp-panel'
import {
  webSettingsFormAtom,
  webSettingsSkillsEnabledAtom,
  webSettingsSkillsSavingAtom,
} from '@/components/admin/web-settings-store'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

type SaveSkillsConfigOptions = {
  rotateApiKey?: boolean
  rotateLegacyMcpKey?: boolean
}

type WebSettingsSkillsPanelProps = {
  onSaveSkillsConfig: (options: SaveSkillsConfigOptions) => Promise<void>
  onRevokeSkillsOauthByAiClientId: (aiClientId: string) => Promise<void>
  onCopyPlainText: (value: string, successText: string) => Promise<void>
}

export function WebSettingsSkillsPanel({
  onSaveSkillsConfig,
  onRevokeSkillsOauthByAiClientId,
  onCopyPlainText,
}: WebSettingsSkillsPanelProps) {
  const { t } = useT('admin')
  const [form, setForm] = useAtom(webSettingsFormAtom)
  const [skillsEnabled, setSkillsEnabled] = useAtom(webSettingsSkillsEnabledAtom)
  const [skillsSaving] = useAtom(webSettingsSkillsSavingAtom)
  const toolMode = form.aiToolMode
  const prefersReducedMotion = Boolean(useReducedMotion())
  const sectionTransition = getAdminPanelTransition(prefersReducedMotion)
  const sectionVariants = getAdminSectionVariants(prefersReducedMotion, {
    enterY: 10,
    exitY: 8,
    scale: 0.996,
  })

  return (
    <div className="space-y-4">
      <WebSettingsRows>
        <WebSettingsRow
          title={t('webSettingsSkills.enabledTitle')}
          description={t('webSettingsSkills.enabledDescription')}
          action={
            <Switch
              checked={skillsEnabled}
              onCheckedChange={(value) => setSkillsEnabled(Boolean(value))}
              disabled={skillsSaving}
              className="shrink-0"
            />
          }
        />
      </WebSettingsRows>

      <WebSettingsInset className="space-y-2">
        <Label>{t('webSettingsSkills.toolModeLabel')}</Label>
        <Select
          value={toolMode}
          onValueChange={(value) =>
            setForm((prev) => ({
              ...prev,
              aiToolMode: value === 'mcp' ? 'mcp' : 'skills',
              mcpThemeToolsEnabled:
                value === 'mcp' ? prev.mcpThemeToolsEnabled : false,
            }))
          }
          disabled={!skillsEnabled}
        >
          <SelectTrigger className="w-full sm:max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="skills">{t('webSettingsSkills.toolModes.skills')}</SelectItem>
            <SelectItem value="mcp">{t('webSettingsSkills.toolModes.mcp')}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('webSettingsSkills.toolModeHint')}
        </p>
        <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border bg-background/50 px-3 py-2">
          {t('webSettingsSkills.currentToolMode', {
            value:
              toolMode === 'mcp'
                ? t('webSettingsSkills.toolModes.mcp')
                : t('webSettingsSkills.toolModes.skills'),
          })}
        </div>
      </WebSettingsInset>

      <AnimatePresence initial={false}>
        {skillsEnabled && toolMode === 'skills' ? (
          <motion.div
            className="space-y-4"
            variants={sectionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={sectionTransition}
            layout
          >
            <WebSettingsSkillsAuthPanel
              onSaveSkillsConfig={onSaveSkillsConfig}
              onRevokeSkillsOauthByAiClientId={onRevokeSkillsOauthByAiClientId}
              onCopyPlainText={onCopyPlainText}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {skillsEnabled && toolMode === 'mcp' ? (
          <motion.div
            className="space-y-4"
            variants={sectionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={sectionTransition}
            layout
          >
            <WebSettingsSkillsMcpPanel
              onSaveSkillsConfig={onSaveSkillsConfig}
              onCopyPlainText={onCopyPlainText}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {!skillsEnabled ? (
          <motion.div
            className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border bg-background/50 px-3 py-2"
            variants={sectionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={sectionTransition}
            layout
          >
            {t('webSettingsSkills.disabledHint')}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
