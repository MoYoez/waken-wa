import { NextRequest, NextResponse } from 'next/server'

import { ADMIN_LIST_DEFAULT_PAGE_SIZE, ADMIN_LIST_MAX_PAGE_SIZE } from '@/constants/admin-list'
import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { parsePaginationParams } from '@/lib/pagination'
import { readJsonObject } from '@/lib/request-json'
import {
  getRuleToolsListPage,
  isRuleToolsListKey,
  patchRuleToolsList,
} from '@/lib/rule-tools-config'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type RouteContext = {
  params: Promise<{ listKey: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  const { listKey } = await context.params
  if (!isRuleToolsListKey(listKey)) {
    return NextResponse.json({ success: false, error: 'Unknown list' }, { status: 404 })
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
      data: await getRuleToolsListPage({ listKey, q, limit, offset }),
    })
  } catch (error) {
    console.error('Failed to read rule list:', error)
    return NextResponse.json({ success: false, error: 'Failed to read' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  const { listKey } = await context.params
  if (!isRuleToolsListKey(listKey)) {
    return NextResponse.json({ success: false, error: 'Unknown list' }, { status: 404 })
  }

  try {
    const body = await readJsonObject(request)
    return NextResponse.json({
      success: true,
      data: await patchRuleToolsList(listKey, body),
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
    console.error('Failed to update rule list:', error)
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 })
  }
}
