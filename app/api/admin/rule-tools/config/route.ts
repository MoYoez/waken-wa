import { NextRequest, NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { readJsonObject } from '@/lib/request-json'
import { getRuleToolsConfig, patchRuleToolsConfig } from '@/lib/rule-tools-config'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    return NextResponse.json({
      success: true,
      data: await getRuleToolsConfig(),
    })
  } catch (error) {
    console.error('Failed to read rule tools settings:', error)
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
    return NextResponse.json({
      success: true,
      data: await patchRuleToolsConfig(body),
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
    console.error('Failed to update rule tools settings:', error)
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 })
  }
}
