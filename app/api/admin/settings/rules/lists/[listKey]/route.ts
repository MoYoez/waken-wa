import { NextRequest, NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import {
  getRuleToolsListPage,
  isRuleToolsListKey,
  patchRuleToolsList,
} from '@/lib/rule-tools-config'
import { readJsonObject } from '@/lib/request-json'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ listKey: string }> },
) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  const { listKey } = await context.params
  if (!isRuleToolsListKey(listKey)) {
    return NextResponse.json({ success: false, error: '不支持的列表类型' }, { status: 404 })
  }

  const q = request.nextUrl.searchParams.get('q') ?? ''
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? '')
  const offset = Number(request.nextUrl.searchParams.get('offset') ?? '')

  try {
    return NextResponse.json({
      success: true,
      data: await getRuleToolsListPage({ listKey, q, limit, offset }),
    })
  } catch (error) {
    console.error('读取规则列表失败:', error)
    return NextResponse.json({ success: false, error: '读取失败' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ listKey: string }> },
) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  const { listKey } = await context.params
  if (!isRuleToolsListKey(listKey)) {
    return NextResponse.json({ success: false, error: '不支持的列表类型' }, { status: 404 })
  }

  try {
    return NextResponse.json({
      success: true,
      data: await patchRuleToolsList(listKey, await readJsonObject(request)),
    })
  } catch (error) {
    if (error instanceof Error && typeof (error as any).status === 'number') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: (error as any).status },
      )
    }

    console.error('更新规则列表失败:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}
