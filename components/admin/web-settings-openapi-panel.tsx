'use client'

import { useAtom } from 'jotai'
import { useT } from 'next-i18next/client'

import { WebSettingsRow, WebSettingsRows } from '@/components/admin/web-settings-layout'
import { webSettingsFormAtom } from '@/components/admin/web-settings-store'
import { Switch } from '@/components/ui/switch'

export function WebSettingsOpenApiPanel() {
  const { t } = useT('admin')
  const [form, setForm] = useAtom(webSettingsFormAtom)

  return (
    <WebSettingsRows>
      <WebSettingsRow
        htmlFor="openapi-docs-toggle"
        title={t('webSettingsOpenApi.title')}
        description={
          <>
            {t('webSettingsOpenApi.descriptionPrefix')}{' '}
            <code className="rounded bg-muted px-1">/api/openapi.json</code>{' '}
            {t('webSettingsOpenApi.descriptionMiddle')}{' '}
            <code className="rounded bg-muted px-1">/api-reference</code>
            {t('webSettingsOpenApi.descriptionSuffix')}
          </>
        }
        action={
          <Switch
            id="openapi-docs-toggle"
            checked={form.openApiDocsEnabled}
            onCheckedChange={(value) =>
              setForm((prev) => ({ ...prev, openApiDocsEnabled: value }))
            }
          />
        }
      />
    </WebSettingsRows>
  )
}
