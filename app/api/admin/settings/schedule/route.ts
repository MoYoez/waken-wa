import { NextRequest, NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { getSafeSiteConfig,prepareSiteConfigValuesFromPayload } from '@/lib/llm-site-config'
import { readJsonObject } from '@/lib/request-json'
import { pickScheduleSettingsFromConfig } from '@/lib/site-settings-read'
import { persistScheduleSettingsFromPrepared } from '@/lib/site-settings-write'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const data = await getSafeSiteConfig('admin')
    return NextResponse.json({
      success: true,
      data: data ? pickScheduleSettingsFromConfig(data as Record<string, unknown>) : null,
    })
  } catch (error) {
    console.error('Failed to read schedule settings:', error)
    return NextResponse.json({ success: false, error: 'Failed to read' }, { status: 500 })
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
    const data = await persistScheduleSettingsFromPrepared(preparedValues)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof Error && typeof (error as any).status === 'number') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: (error as any).status },
      )
    }

    console.error('Failed to update schedule settings:', error)
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 })
  }
}
