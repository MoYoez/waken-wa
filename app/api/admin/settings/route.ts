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
    const data = await getSafeSiteConfig()
    return NextResponse.json({
      success: true,
      data: data ? omitRuleToolsFields(data as Record<string, unknown>) : null,
    })
  } catch (error) {
    console.error('读取站点配置失败:', error)
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

    console.error('更新站点配置失败:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}
