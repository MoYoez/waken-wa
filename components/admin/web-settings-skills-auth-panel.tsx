'use client'

import { useAtom } from 'jotai'
import { AnimatePresence, motion } from 'motion/react'
import { useT } from 'next-i18next/client'
import { useState } from 'react'

import { formatNumberRange, NumberSettingInput } from '@/components/admin/number-setting-input'
import {
  webSettingsPublicOriginAtom,
  webSettingsSkillsAiAuthorizationsAtom,
  webSettingsSkillsApiKeyConfiguredAtom,
  webSettingsSkillsAuthModeAtom,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type WebSettingsSkillsActions = {
  onSaveSkillsConfig: (options: {
    rotateApiKey?: boolean
    rotateLegacyMcpKey?: boolean
  }) => Promise<void>
  onRevokeSkillsOauthByAiClientId: (aiClientId: string) => Promise<void>
  onCopyPlainText: (value: string, successText: string) => Promise<void>
}

export function WebSettingsSkillsAuthPanel({
  onSaveSkillsConfig,
  onRevokeSkillsOauthByAiClientId,
  onCopyPlainText,
}: WebSettingsSkillsActions) {
  const { t } = useT('admin')
  const { formatPattern } = useSiteTimeFormat()
  const [skillsSaving] = useAtom(webSettingsSkillsSavingAtom)
  const [skillsAuthMode, setSkillsAuthMode] = useAtom(webSettingsSkillsAuthModeAtom)
  const [publicOrigin] = useAtom(webSettingsPublicOriginAtom)
  const [skillsApiKeyConfigured] = useAtom(webSettingsSkillsApiKeyConfiguredAtom)
  const [skillsOauthConfigured] = useAtom(webSettingsSkillsOauthConfiguredAtom)
  const [skillsOauthTokenTtlMinutes, setSkillsOauthTokenTtlMinutes] = useAtom(
    webSettingsSkillsOauthTokenTtlMinutesAtom,
  )
  const [skillsAiAuthorizations] = useAtom(webSettingsSkillsAiAuthorizationsAtom)
  const [skillsRevokingAiClientId] = useAtom(webSettingsSkillsRevokingAiClientIdAtom)
  const [skillsGeneratedApiKey] = useAtom(webSettingsSkillsGeneratedApiKeyAtom)
  const [revokeDialogAiClientId, setRevokeDialogAiClientId] = useState('')
  const [skillsAiAuthDialogOpen, setSkillsAiAuthDialogOpen] = useState(false)

  const mdUrl = publicOrigin ? `${publicOrigin}/api/llm/md` : '/api/llm/md'
  const directUrl = skillsAuthMode
    ? publicOrigin
      ? `${publicOrigin}/api/llm/direct?mode=${skillsAuthMode}`
      : `/api/llm/direct?mode=${skillsAuthMode}`
    : ''

  const handleConfirmRevoke = async () => {
    if (!revokeDialogAiClientId) return
    await onRevokeSkillsOauthByAiClientId(revokeDialogAiClientId)
    setRevokeDialogAiClientId('')
  }

  return (
    <div className="space-y-4">
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
              <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border bg-background/50 px-3 py-2">
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
                className="space-y-3 rounded-md border border-border bg-background/40 px-3 py-3"
                initial="initial"
                animate="animate"
                exit="exit"
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
                className="space-y-3 rounded-md border border-border bg-background/40 px-3 py-3"
                initial="initial"
                animate="animate"
                exit="exit"
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
                  <NumberSettingInput
                    min={5}
                    max={1440}
                    step={1}
                    value={skillsOauthTokenTtlMinutes}
                    rangeMessage={formatNumberRange(5, 1440)}
                    onValueChange={(value) => setSkillsOauthTokenTtlMinutes(value)}
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
                className="space-y-2 rounded-md border border-border bg-background/40 px-3 py-3"
                initial="initial"
                animate="animate"
                exit="exit"
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
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {skillsAuthMode ? (
              <motion.div
                className="space-y-2 rounded-md border border-border bg-background/40 px-3 py-3"
                initial="initial"
                animate="animate"
                exit="exit"
                layout
              >
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
                      void onCopyPlainText(
                        directUrl,
                        t('webSettingsSkills.toasts.copiedDirectUrl'),
                      )
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
                className="space-y-3 rounded-md border border-border bg-background/40 px-3 py-3"
                initial="initial"
                animate="animate"
                exit="exit"
                layout
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Label className="text-xs">{t('webSettingsSkills.aiAuthTitle')}</Label>
                    <p className="text-[11px] text-muted-foreground">
                      {t('webSettingsSkills.aiAuthDescription')}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setSkillsAiAuthDialogOpen(true)}>
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
                            className="rounded-md border border-border bg-muted/20 px-3 py-3 space-y-2"
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
                    <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">
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
    </div>
  )
}
