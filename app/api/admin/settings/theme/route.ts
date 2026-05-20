import { NextRequest, NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { getSafeSiteConfig,prepareSiteConfigValuesFromPayload } from '@/lib/llm-site-config'
import { readJsonObject } from '@/lib/request-json'
import { pickThemeSettingsFromConfig, readEffectiveSiteConfig } from '@/lib/site-settings-read'
import { persistThemeSettingsFromPrepared } from '@/lib/site-settings-write'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

async function mergeThemeCustomSurfacePatch(
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!isPlainRecord(body.themeCustomSurface)) return body
  const currentConfig = await readEffectiveSiteConfig()
  if (!isPlainRecord(currentConfig?.themeCustomSurface)) return body
  return {
    ...body,
    themeCustomSurface: {
      ...currentConfig.themeCustomSurface,
      ...body.themeCustomSurface,
    },
  }
}

export async function GET() {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const data = await getSafeSiteConfig('masked')
    return NextResponse.json({
      success: true,
      data: data ? pickThemeSettingsFromConfig(data as Record<string, unknown>) : null,
    })
  } catch (error) {
    console.error('Failed to read theme settings:', error)
    return NextResponse.json({ success: false, error: 'Failed to read' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const body = await mergeThemeCustomSurfacePatch(await readJsonObject(request))
    const preparedValues = await prepareSiteConfigValuesFromPayload(body, {
      allowRestrictedFields: true,
    })
    const data = await persistThemeSettingsFromPrepared(preparedValues)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof Error && typeof (error as any).status === 'number') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: (error as any).status },
      )
    }

    console.error('Failed to update theme settings:', error)
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 })
  }
}
