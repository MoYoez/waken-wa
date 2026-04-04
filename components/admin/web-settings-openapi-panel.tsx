'use client'

import { useAtom } from 'jotai'

import { webSettingsFormAtom } from '@/components/admin/web-settings-store'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export function WebSettingsOpenApiPanel() {
  const [form, setForm] = useAtom(webSettingsFormAtom)

  return (
    <div className="space-y-4 rounded-lg border border-border/60 bg-muted/10 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <Label htmlFor="openapi-docs-toggle" className="font-normal cursor-pointer">
            OpenAPI 文档 / 接口
          </Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            控制开发者文档页与 OpenAPI JSON 是否可访问。
          </p>
        </div>
        <Switch
          id="openapi-docs-toggle"
          checked={form.openApiDocsEnabled}
          onCheckedChange={(value) =>
            setForm((prev) => ({ ...prev, openApiDocsEnabled: value }))
          }
        />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        关闭后将同时禁用 <code className="rounded bg-muted px-1">/api/openapi.json</code> 与{' '}
        <code className="rounded bg-muted px-1">/api-reference</code>。
      </p>
    </div>
  )
}
