'use client'

import { useAtom } from 'jotai'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useT } from 'next-i18next/client'
import { useState } from 'react'

import {
  getAdminPanelTransition,
  getAdminSectionVariants,
} from '@/components/admin/admin-motion'
import {
  WebSettingsInset,
  WebSettingsRow,
  WebSettingsRows,
} from '@/components/admin/web-settings-layout'
import {
  webSettingsFormAtom,
  webSettingsLegacyMcpConfiguredAtom,
  webSettingsLegacyMcpGeneratedApiKeyAtom,
  webSettingsPublicOriginAtom,
  webSettingsSkillsAiAuthorizationsAtom,
  webSettingsSkillsApiKeyConfiguredAtom,
  webSettingsSkillsAuthModeAtom,
  webSettingsSkillsEnabledAtom,
  webSettingsSkillsGeneratedApiKeyAtom,
  webSettingsSkillsOauthConfiguredAtom,
  webSettingsSkillsOauthTokenTtlMinutesAtom,
  webSettingsSkillsRevokingAiClientIdAtom,
  webSettingsSkillsSavingAtom,
} from '@/components/admin/web-settings-store'
import { useSiteTimeFormat } from '@/components/site-timezone-provider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
  const { formatPattern } = useSiteTimeFormat()
  const [form, setForm] = useAtom(webSettingsFormAtom)
  const [skillsSaving] = useAtom(webSettingsSkillsSavingAtom)
  const [skillsEnabled, setSkillsEnabled] = useAtom(webSettingsSkillsEnabledAtom)
  const [skillsAuthMode, setSkillsAuthMode] = useAtom(webSettingsSkillsAuthModeAtom)
  const [skillsApiKeyConfigured] = useAtom(webSettingsSkillsApiKeyConfiguredAtom)
  const [skillsOauthConfigured] = useAtom(webSettingsSkillsOauthConfiguredAtom)
  const [skillsOauthTokenTtlMinutes, setSkillsOauthTokenTtlMinutes] = useAtom(
    webSettingsSkillsOauthTokenTtlMinutesAtom,
  )
  const [skillsAiAuthorizations] = useAtom(webSettingsSkillsAiAuthorizationsAtom)
  const [skillsRevokingAiClientId] = useAtom(webSettingsSkillsRevokingAiClientIdAtom)
  const [skillsGeneratedApiKey] = useAtom(webSettingsSkillsGeneratedApiKeyAtom)
  const [legacyMcpConfigured] = useAtom(webSettingsLegacyMcpConfiguredAtom)
  const [legacyMcpGeneratedApiKey] = useAtom(webSettingsLegacyMcpGeneratedApiKeyAtom)
  const [publicOrigin] = useAtom(webSettingsPublicOriginAtom)
  const [skillsAiAuthDialogOpen, setSkillsAiAuthDialogOpen] = useState(false)
  const [revokeDialogAiClientId, setRevokeDialogAiClientId] = useState('')
  const prefersReducedMotion = Boolean(useReducedMotion())
  const aiToolMode = form.aiToolMode
  const mcpThemeToolsEnabled = form.mcpThemeToolsEnabled
  const sectionTransition = getAdminPanelTransition(prefersReducedMotion)
  const sectionVariants = getAdminSectionVariants(prefersReducedMotion, {
    enterY: 10,
    exitY: 8,
    scale: 0.996,
  })

  const mdUrl = publicOrigin ? `${publicOrigin}/api/llm/md` : '/api/llm/md'
  const directUrl = skillsAuthMode
    ? publicOrigin
      ? `${publicOrigin}/api/llm/direct?mode=${skillsAuthMode}`
      : `/api/llm/direct?mode=${skillsAuthMode}`
    : ''
  const legacyMcpApiKeyUrl = publicOrigin ? `${publicOrigin}/api/llm/mcp/apikey` : '/api/llm/mcp/apikey'
  const legacyMcpEndpointUrl = publicOrigin ? `${publicOrigin}/api/llm/mcp` : '/api/llm/mcp'

  const handleConfirmRevoke = async () => {
    if (!revokeDialogAiClientId) return
    await onRevokeSkillsOauthByAiClientId(revokeDialogAiClientId)
    setRevokeDialogAiClientId('')
  }

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
          value={aiToolMode}
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
        <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-background/50 px-3 py-2">
          {t('webSettingsSkills.currentToolMode', {
            value:
              aiToolMode === 'mcp'
                ? t('webSettingsSkills.toolModes.mcp')
                : t('webSettingsSkills.toolModes.skills'),
          })}
        </div>
      </WebSettingsInset>

      <AnimatePresence initial={false}>
        {skillsEnabled && aiToolMode === 'skills' ? (
          <motion.div
            className="space-y-4"
            variants={sectionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={sectionTransition}
            layout
          >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('webSettingsSkills.authModeLabel')}</Label>
              <Select
                value={skillsAuthMode || ''}
                onValueChange={(value) => {
                  const mode = value === 'oauth' || value === 'apikey' ? value : ''
                  setSkillsAuthMode(mode)
                }}
                disabled={skillsSaving}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('webSettingsSkills.authModePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oauth">{t('webSettingsSkills.authModes.oauth')}</SelectItem>
                  <SelectItem value="apikey">{t('webSettingsSkills.authModes.apikey')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('webSettingsSkills.authStatusLabel')}</Label>
              <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-background/50 px-3 py-2">
                {skillsAuthMode === 'oauth' ? (
                  <>
                    {t('webSettingsSkills.oauthStatus', {
                      value: skillsOauthConfigured
                        ? t('webSettingsSkills.status.authorized')
                        : t('webSettingsSkills.status.unauthorized'),
                    })}
                  </>
                ) : skillsAuthMode === 'apikey' ? (
                  <>
                    {t('webSettingsSkills.apikeyStatus', {
                      value: skillsApiKeyConfigured
                        ? t('webSettingsSkills.status.configured')
                        : t('webSettingsSkills.status.notConfigured'),
                    })}
                  </>
                ) : (
                  <>{t('webSettingsSkills.authModeUnselected')}</>
                )}
              </div>
            </div>
          </div>

          <AnimatePresence initial={false} mode="wait">
            {skillsAuthMode === 'apikey' ? (
              <motion.div
                className="space-y-3 rounded-md border border-border/60 bg-background/40 px-3 py-3"
                variants={sectionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={sectionTransition}
                layout
              >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Label className="text-sm font-normal">{t('webSettingsSkills.apikeyTitle')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('webSettingsSkills.apikeyDescription')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={skillsSaving}
                  onClick={() => void onSaveSkillsConfig({ rotateApiKey: true })}
                >
                  {skillsSaving
                    ? t('skillsAuthorizeCard.processing')
                    : t('webSettingsSkills.generateOrRotateKey')}
                </Button>
              </div>

              {skillsGeneratedApiKey ? (
                <div className="space-y-2">
                  <Label className="text-xs">{t('webSettingsSkills.generatedKeyLabel')}</Label>
                  <Input value={skillsGeneratedApiKey} readOnly className="font-mono text-xs" />
                </div>
              ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence initial={false} mode="wait">
            {skillsAuthMode === 'oauth' ? (
              <motion.div
                className="space-y-3 rounded-md border border-border/60 bg-background/40 px-3 py-3"
                variants={sectionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={sectionTransition}
                layout
              >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Label className="text-sm font-normal">{t('webSettingsSkills.oauthTtlTitle')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('webSettingsSkills.oauthTtlDescription')}
                  </p>
                </div>
              </div>
              <div className="max-w-xs space-y-2">
                <Input
                  type="number"
                  onWheel={(event) => event.currentTarget.blur()}
                  min={5}
                  max={1440}
                  step={1}
                  value={skillsOauthTokenTtlMinutes}
                  onChange={(event) =>
                    setSkillsOauthTokenTtlMinutes(
                      Math.min(1440, Math.max(5, Math.round(Number(event.target.value) || 60))),
                    )
                  }
                  disabled={skillsSaving}
                />
                <p className="text-[11px] text-muted-foreground">
                  {t('webSettingsSkills.oauthTtlCurrent', {
                    value: skillsOauthTokenTtlMinutes,
                  })}
                </p>
              </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {skillsAuthMode ? (
              <motion.div
                className="space-y-2 rounded-md border border-border/60 bg-background/40 px-3 py-3"
                variants={sectionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={sectionTransition}
                layout
              >
              <Label className="text-xs">{t('webSettingsSkills.mdLinkLabel')}</Label>
              <div className="flex gap-2">
                <Input value={mdUrl} readOnly className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() =>
                    void onCopyPlainText(mdUrl, t('webSettingsSkills.toasts.copiedMdUrl'))
                  }
                >
                  {t('webSettingsSkills.copy')}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {t('webSettingsSkills.mdLinkHint')}
              </p>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {t('webSettingsSkills.directLinkHintPrefix')}{' '}
                <code className="rounded bg-muted px-1">LLM-Skills-*</code>{' '}
                {t('webSettingsSkills.directLinkHintMiddle')}{' '}
                {t('webSettingsSkills.directLinkHintSuffix')}{' '}
                <code className="rounded bg-muted px-1">LLM-Skills-Token</code>。
              </p>
              <div className="flex gap-2">
                <Input value={directUrl} readOnly className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() =>
                    void onCopyPlainText(directUrl, t('webSettingsSkills.toasts.copiedDirectUrl'))
                  }
                >
                  {t('webSettingsSkills.copy')}
                </Button>
              </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {skillsAuthMode === 'oauth' ? (
              <motion.div
                className="space-y-3 rounded-md border border-border/60 bg-background/40 px-3 py-3"
                variants={sectionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={sectionTransition}
                layout
              >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Label className="text-xs">{t('webSettingsSkills.aiAuthTitle')}</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {t('webSettingsSkills.aiAuthDescription')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSkillsAiAuthDialogOpen(true)}
                >
                  {t('webSettingsSkills.viewAiAuth')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('webSettingsSkills.aiAuthCount', { value: skillsAiAuthorizations.length })}
              </p>
              <Dialog open={skillsAiAuthDialogOpen} onOpenChange={setSkillsAiAuthDialogOpen}>
                <DialogContent className="sm:max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>{t('webSettingsSkills.aiAuthDialogTitle')}</DialogTitle>
                    <DialogDescription>
                      {t('webSettingsSkills.aiAuthDialogDescription')}
                    </DialogDescription>
                  </DialogHeader>
                  {skillsAiAuthorizations.length > 0 ? (
                    <div className="max-h-[60vh] overflow-auto space-y-2 pr-1">
                      {skillsAiAuthorizations.map((item) => (
                        <div
                          key={item.aiClientId}
                          className="rounded-md border border-border/60 bg-muted/20 px-3 py-3 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <code className="text-xs rounded bg-muted px-1.5 py-0.5">{item.aiClientId}</code>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={skillsSaving || skillsRevokingAiClientId === item.aiClientId}
                              onClick={() => setRevokeDialogAiClientId(item.aiClientId)}
                            >
                              {skillsRevokingAiClientId === item.aiClientId
                                ? t('webSettingsSkills.revoking')
                                : t('webSettingsSkills.revokeAiAuth')}
                            </Button>
                          </div>
                          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                            <span>{t('webSettingsSkills.pendingCodes', { value: item.pendingCodeCount })}</span>
                            <span>{t('webSettingsSkills.approvedCodes', { value: item.approvedCodeCount })}</span>
                            <span>{t('webSettingsSkills.activeTokens', { value: item.activeTokenCount })}</span>
                          </div>
                          <div className="grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
                            <span>
                              {t('webSettingsSkills.lastApproved', {
                                value: formatPattern(item.lastApprovedAt, 'yyyy-MM-dd HH:mm:ss', '—'),
                              })}
                            </span>
                            <span>
                              {t('webSettingsSkills.lastExchanged', {
                                value: formatPattern(item.lastExchangedAt, 'yyyy-MM-dd HH:mm:ss', '—'),
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('webSettingsSkills.noAiAuth')}</p>
                  )}
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setSkillsAiAuthDialogOpen(false)}>
                      {t('webSettingsSkills.close')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog
                open={Boolean(revokeDialogAiClientId)}
                onOpenChange={(open) => {
                  if (!open) setRevokeDialogAiClientId('')
                }}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('webSettingsSkills.revokeDialogTitle')}</DialogTitle>
                    <DialogDescription>
                      {t('webSettingsSkills.revokeDialogDescription')}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs">
                    {t('webSettingsSkills.aiClientIdLabel')}: <code>{revokeDialogAiClientId || '—'}</code>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setRevokeDialogAiClientId('')}
                      disabled={skillsSaving || Boolean(skillsRevokingAiClientId)}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleConfirmRevoke()}
                      disabled={!revokeDialogAiClientId || skillsSaving || Boolean(skillsRevokingAiClientId)}
                    >
                      {t('webSettingsSkills.confirmRevoke')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              </motion.div>
            ) : null}
          </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {skillsEnabled && aiToolMode === 'mcp' ? (
          <motion.div
            className="space-y-4"
            variants={sectionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={sectionTransition}
            layout
          >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label className="font-normal">{t('webSettingsSkills.mcpEnabledTitle')}</Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t('webSettingsSkills.mcpEnabledDescriptionPrefix')}{' '}
                <code className="rounded bg-muted px-1">mcpThemeToolsEnabled</code>{' '}
                {t('webSettingsSkills.mcpEnabledDescriptionSuffix')}
              </p>
            </div>
            <Switch
              checked={mcpThemeToolsEnabled}
              onCheckedChange={(value) =>
                setForm((prev) => ({ ...prev, mcpThemeToolsEnabled: Boolean(value) }))
              }
              className="shrink-0"
            />
          </div>

          <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-background/50 px-3 py-2">
            {t('webSettingsSkills.mcpModeHint')}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('webSettingsSkills.mcpStatusLabel')}</Label>
              <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-background/50 px-3 py-2">
                {t('webSettingsSkills.mcpStatus', {
                  enabled: mcpThemeToolsEnabled
                    ? t('webSettingsSkills.status.enabled')
                    : t('webSettingsSkills.status.disabled'),
                  apiKey: legacyMcpConfigured
                    ? t('webSettingsSkills.status.configured')
                    : t('webSettingsSkills.status.notConfigured'),
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('webSettingsSkills.authModeLabel')}</Label>
              <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-background/50 px-3 py-2">
                {t('webSettingsSkills.mcpAuthModeValue')}
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-border/60 bg-background/40 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <Label className="text-sm font-normal">{t('webSettingsSkills.legacyMcpKeyTitle')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('webSettingsSkills.legacyMcpKeyDescription')}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={skillsSaving}
                onClick={() => void onSaveSkillsConfig({ rotateLegacyMcpKey: true })}
              >
                {skillsSaving
                  ? t('skillsAuthorizeCard.processing')
                  : t('webSettingsSkills.generateOrRotateKey')}
              </Button>
            </div>

            {legacyMcpGeneratedApiKey ? (
              <div className="space-y-2">
                <Label className="text-xs">{t('webSettingsSkills.generatedLegacyMcpKeyLabel')}</Label>
                <Input value={legacyMcpGeneratedApiKey} readOnly className="font-mono text-xs" />
              </div>
            ) : null}
          </div>

          <div className="space-y-2 rounded-md border border-border/60 bg-background/40 px-3 py-3">
            <Label className="text-xs">{t('webSettingsSkills.legacyMcpApiKeyUrlLabel')}</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={legacyMcpApiKeyUrl} readOnly className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full shrink-0 sm:w-auto"
                  onClick={() =>
                    void onCopyPlainText(
                      legacyMcpApiKeyUrl,
                      t('webSettingsSkills.toasts.copiedLegacyMcpApiKeyUrl'),
                    )
                  }
                >
                  {t('webSettingsSkills.copy')}
                </Button>
              </div>
          </div>

          <div className="space-y-2 rounded-md border border-border/60 bg-background/40 px-3 py-3">
            <Label className="text-xs">{t('webSettingsSkills.legacyMcpEndpointLabel')}</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={legacyMcpEndpointUrl} readOnly className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full shrink-0 sm:w-auto"
                  onClick={() =>
                    void onCopyPlainText(
                      legacyMcpEndpointUrl,
                      t('webSettingsSkills.toasts.copiedLegacyMcpEndpoint'),
                    )
                  }
                >
                  {t('webSettingsSkills.copy')}
                </Button>
              </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t('webSettingsSkills.legacyMcpEndpointHintPrefix')}{' '}
              <code className="rounded bg-muted px-1">
                Authorization: Bearer YOUR_LEGACY_MCP_APIKEY
              </code>{' '}
              {t('webSettingsSkills.legacyMcpEndpointHintSuffix')}
            </p>
          </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {!skillsEnabled ? (
          <motion.div
            className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-background/50 px-3 py-2"
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
