import { NextRequest, NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { getSafeSiteConfig, updateSiteConfigFromPayload } from '@/lib/llm-site-config'
import { readJsonObject } from '@/lib/request-json'
import { assertNoRuleToolsFields, omitRuleToolsFields } from '@/lib/rule-tools-config'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const data = await getSafeSiteConfig('admin')
    return NextResponse.json({
      success: true,
      data: data ? omitRuleToolsFields(data as Record<string, unknown>) : null,
    })
  } catch (error) {
    console.error('Failed to read site settings:', error)
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
    assertNoRuleToolsFields(body)
    const data = await updateSiteConfigFromPayload(omitRuleToolsFields(body), {
      allowRestrictedFields: true,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof Error && typeof (error as any).status === 'number') {
      const extra =
        Array.isArray((error as any).deniedKeys) && (error as any).deniedKeys.length > 0
          ? { deniedKeys: (error as any).deniedKeys }
          : {}
      return NextResponse.json(
        { success: false, error: error.message, ...extra },
        { status: (error as any).status },
      )
    }

    console.error('Failed to update site settings:', error)
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 })
  }
}
