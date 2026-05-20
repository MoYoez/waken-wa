'use client'

import { useAtom } from 'jotai'
import { useT } from 'next-i18next/client'

import {
  webSettingsFormAtom,
  webSettingsLegacyMcpConfiguredAtom,
  webSettingsLegacyMcpGeneratedApiKeyAtom,
  webSettingsPublicOriginAtom,
  webSettingsSkillsSavingAtom,
} from '@/components/admin/web-settings-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export type WebSettingsSkillsMcpActions = {
  onSaveSkillsConfig: (options: {
    rotateApiKey?: boolean
    rotateLegacyMcpKey?: boolean
  }) => Promise<void>
  onCopyPlainText: (value: string, successText: string) => Promise<void>
}

export function WebSettingsSkillsMcpPanel({
  onSaveSkillsConfig,
  onCopyPlainText,
}: WebSettingsSkillsMcpActions) {
  const { t } = useT('admin')
  const [form, setForm] = useAtom(webSettingsFormAtom)
  const [publicOrigin] = useAtom(webSettingsPublicOriginAtom)
  const [legacyMcpConfigured] = useAtom(webSettingsLegacyMcpConfiguredAtom)
  const [legacyMcpGeneratedApiKey] = useAtom(webSettingsLegacyMcpGeneratedApiKeyAtom)
  const [skillsSaving] = useAtom(webSettingsSkillsSavingAtom)

  const legacyMcpApiKeyUrl = publicOrigin ? `${publicOrigin}/api/llm/mcp/apikey` : '/api/llm/mcp/apikey'
  const legacyMcpEndpointUrl = publicOrigin ? `${publicOrigin}/api/llm/mcp` : '/api/llm/mcp'
  const mcpThemeToolsEnabled = form.mcpThemeToolsEnabled

  return (
    <div className="space-y-4">
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

      <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border bg-background/50 px-3 py-2">
        {t('webSettingsSkills.mcpModeHint')}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('webSettingsSkills.mcpStatusLabel')}</Label>
          <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border bg-background/50 px-3 py-2">
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
          <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border bg-background/50 px-3 py-2">
            {t('webSettingsSkills.mcpAuthModeValue')}
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-border bg-background/40 px-3 py-3">
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

      <div className="space-y-2 rounded-md border border-border bg-background/40 px-3 py-3">
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

      <div className="space-y-2 rounded-md border border-border bg-background/40 px-3 py-3">
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
          <code className="rounded bg-muted px-1">Authorization: Bearer YOUR_LEGACY_MCP_APIKEY</code>{' '}
          {t('webSettingsSkills.legacyMcpEndpointHintSuffix')}
        </p>
      </div>
    </div>
  )
}
