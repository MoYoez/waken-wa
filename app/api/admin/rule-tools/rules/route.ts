import { NextRequest, NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { ADMIN_LIST_DEFAULT_PAGE_SIZE, ADMIN_LIST_MAX_PAGE_SIZE } from '@/lib/admin-list-constants'
import { parsePaginationParams } from '@/lib/pagination'
import { readJsonObject } from '@/lib/request-json'
import { getRuleToolsRulesPage, patchRuleToolsRules } from '@/lib/rule-tools-config'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const { searchParams } = new URL(request.url)
    const q = String(searchParams.get('q') ?? '').trim()
    const { limit, offset } = parsePaginationParams(searchParams, {
      defaultLimit: ADMIN_LIST_DEFAULT_PAGE_SIZE,
      maxLimit: ADMIN_LIST_MAX_PAGE_SIZE,
    })

    return NextResponse.json({
      success: true,
      data: await getRuleToolsRulesPage({ q, limit, offset }),
    })
  } catch (error) {
    console.error('读取规则组失败:', error)
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
    return NextResponse.json({
      success: true,
      data: await patchRuleToolsRules(body),
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
    console.error('更新规则组失败:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}
