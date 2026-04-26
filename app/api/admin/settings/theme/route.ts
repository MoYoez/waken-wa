import { NextRequest, NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { getSafeSiteConfig,prepareSiteConfigValuesFromPayload } from '@/lib/llm-site-config'
import { readJsonObject } from '@/lib/request-json'
import { pickThemeSettingsFromConfig } from '@/lib/site-settings-read'
import { persistThemeSettingsFromPrepared } from '@/lib/site-settings-write'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const data = await getSafeSiteConfig()
    return NextResponse.json({
      success: true,
      data: data ? pickThemeSettingsFromConfig(data as Record<string, unknown>) : null,
    })
  } catch (error) {
    console.error('读取主题配置失败:', error)
    return NextResponse.json({ success: false, error: '读取失败' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const body = await readJsonObject(request)
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

    console.error('更新主题配置失败:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}
