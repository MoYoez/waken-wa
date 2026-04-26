import { NextRequest, NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { readJsonObject } from '@/lib/request-json'
import { importRuleToolsPayload } from '@/lib/rule-tools-config'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const body = await readJsonObject(request)
    return NextResponse.json({
      success: true,
      data: await importRuleToolsPayload(body),
    })
  } catch (error) {
    const status =
      typeof (error as { status?: unknown }).status === 'number'
        ? (error as unknown as { status: number }).status
        : null
    if (error instanceof Error && status !== null) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status },
      )
    }
    console.error('导入规则工具失败:', error)
    return NextResponse.json({ success: false, error: '导入失败' }, { status: 500 })
  }
}
