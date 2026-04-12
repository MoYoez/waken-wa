'use client'

import { useAtom } from 'jotai'

import { WebSettingsRow,WebSettingsRows } from '@/components/admin/web-settings-layout'
import { webSettingsFormAtom } from '@/components/admin/web-settings-store'
import { Switch } from '@/components/ui/switch'

export function WebSettingsOpenApiPanel() {
  const [form, setForm] = useAtom(webSettingsFormAtom)

  return (
    <WebSettingsRows>
      <WebSettingsRow
        htmlFor="openapi-docs-toggle"
        title="OpenAPI 文档 / 接口"
        description={
          <>
            控制开发者文档页与 OpenAPI JSON 是否可访问。关闭后将同时禁用{' '}
            <code className="rounded bg-muted px-1">/api/openapi.json</code> 与{' '}
            <code className="rounded bg-muted px-1">/api-reference</code>。
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
