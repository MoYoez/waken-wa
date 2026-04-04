import { createHash, randomBytes } from 'node:crypto'

import { asc, count, eq, getTableColumns, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { clearActivityFeedDataCache } from '@/lib/activity-feed'
import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import {
  ADMIN_LIST_DEFAULT_PAGE_SIZE,
  ADMIN_LIST_MAX_PAGE_SIZE,
} from '@/lib/admin-list-constants'
import { db } from '@/lib/db'
import { clearDeviceAuthCache } from '@/lib/device-auth-cache'
import {
  GENERATED_HASH_KEY_MAX_LENGTH,
  GENERATED_HASH_KEY_MIN_LENGTH,
  WEB_ADMIN_QUICK_ADD_DEVICE_HASH_KEY,
} from '@/lib/device-constants'
import { apiTokens, devices } from '@/lib/drizzle-schema'
import { parsePaginationParams } from '@/lib/pagination'
import { buildDeviceApprovalUrl } from '@/lib/public-request-url'
import { readJsonObject } from '@/lib/request-json'
import { sqlTimestamp } from '@/lib/sql-timestamp'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function generateHashKey(seed = ''): string {
  const raw = `${seed}:${Date.now()}:${randomBytes(24).toString('hex')}`
  return createHash('sha256').update(raw).digest('hex')
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const { searchParams } = new URL(request.url)
    const { limit, offset } = parsePaginationParams(searchParams, {
      defaultLimit: ADMIN_LIST_DEFAULT_PAGE_SIZE,
      maxLimit: ADMIN_LIST_MAX_PAGE_SIZE,
    })
    const status = String(searchParams.get('status') ?? '').trim()
    const q = String(searchParams.get('q') ?? '').trim()

    const filters: ReturnType<typeof sql>[] = []
    if (status) {
      filters.push(sql`${devices.status} = ${status}`)
    }
    if (q) {
      const pattern = `%${q}%`
      filters.push(
        sql`(lower(${devices.displayName}) like lower(${pattern}) or lower(${devices.generatedHashKey}) like lower(${pattern}))`,
      )
    }
    const whereClause = filters.length ? sql.join(filters, sql` and `) : undefined

    const baseCols = getTableColumns(devices)
    const baseList = db
      .select({
        ...baseCols,
        tId: apiTokens.id,
        tName: apiTokens.name,
        tActive: apiTokens.isActive,
      })
      .from(devices)
      .leftJoin(apiTokens, eq(devices.apiTokenId, apiTokens.id))
    const baseCount = db.select({ c: count() }).from(devices)

    const [rows, [totalRow]] = await Promise.all([
      (whereClause ? baseList.where(whereClause) : baseList)
        .orderBy(asc(devices.id))
        .limit(limit)
        .offset(offset),
      whereClause ? baseCount.where(whereClause) : baseCount,
    ])

    const items = rows.map(
      ({ tId, tName, tActive, ...rest }: Record<string, unknown> & {
        tId: number | null
        tName: string | null
        tActive: boolean | null
      }) => {
        const row: Record<string, unknown> = {
          ...rest,
          apiToken:
            tId != null && tName != null
              ? { id: tId, name: tName, isActive: Boolean(tActive) }
              : null,
        }
        if (rest.status === 'pending' && typeof rest.generatedHashKey === 'string') {
          row.approvalUrl = buildDeviceApprovalUrl(request, rest.generatedHashKey)
        }
        return row
      },
    )

    return NextResponse.json({
      success: true,
      data: items,
      pagination: { limit, offset, total: Number(totalRow?.c ?? 0) },
    })
  } catch (error) {
    console.error('获取设备列表失败:', error)
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const body = await readJsonObject(request)
    const displayName = String(body?.displayName ?? '').trim()
    const apiTokenIdRaw = body?.apiTokenId
    const apiTokenId =
      typeof apiTokenIdRaw === 'number' && Number.isFinite(apiTokenIdRaw) ? Math.floor(apiTokenIdRaw) : null

    if (!displayName) {
      return NextResponse.json({ success: false, error: '请输入设备显示名' }, { status: 400 })
    }

    if (apiTokenId) {
      const [token] = await db.select().from(apiTokens).where(eq(apiTokens.id, apiTokenId)).limit(1)
      if (!token) {
        return NextResponse.json({ success: false, error: '绑定的 Token 不存在' }, { status: 400 })
      }
    }

    const customKeyRaw = body?.generatedHashKey
    const customKey =
      typeof customKeyRaw === 'string' ? customKeyRaw.trim() : ''
    if (customKey) {
      if (customKey === WEB_ADMIN_QUICK_ADD_DEVICE_HASH_KEY) {
        return NextResponse.json(
          { success: false, error: '该 Key 为系统预留（Web 后台快速添加），不可手动占用' },
          { status: 400 },
        )
      }
      if (
        customKey.length > GENERATED_HASH_KEY_MAX_LENGTH ||
        customKey.length < GENERATED_HASH_KEY_MIN_LENGTH
      ) {
        return NextResponse.json(
          { success: false, error: '自定义设备身份牌长度需在 8～128 之间' },
          { status: 400 },
        )
      }
      const [taken] = await db
        .select()
        .from(devices)
        .where(eq(devices.generatedHashKey, customKey))
        .limit(1)
      if (taken) {
        return NextResponse.json({ success: false, error: '该设备身份牌已被使用' }, { status: 400 })
      }
    }

    let generatedHashKey = customKey || generateHashKey(displayName)
    if (!customKey) {
      for (let i = 0; i < 3; i++) {
        const [exists] = await db
          .select()
          .from(devices)
          .where(eq(devices.generatedHashKey, generatedHashKey))
          .limit(1)
        if (!exists) break
        generatedHashKey = generateHashKey(`${displayName}:${i}`)
      }
    }

    const now = sqlTimestamp()
    const [item] = await db
      .insert(devices)
      .values({
        displayName,
        generatedHashKey,
        status: 'active',
        apiTokenId,
        ...(typeof body?.showSteamNowPlaying === 'boolean'
          ? { showSteamNowPlaying: body.showSteamNowPlaying }
          : {}),
        updatedAt: now,
      })
      .returning()
    clearDeviceAuthCache()
    await clearActivityFeedDataCache()

    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch (error) {
    console.error('创建设备失败:', error)
    return NextResponse.json({ success: false, error: '创建失败' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const body = await readJsonObject(request)
    const id = Number(body?.id)
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ success: false, error: '缺少有效的 id' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (typeof body?.displayName === 'string') {
      const displayName = body.displayName.trim()
      if (!displayName) {
        return NextResponse.json({ success: false, error: '设备显示名不能为空' }, { status: 400 })
      }
      data.displayName = displayName
    }
    if (typeof body?.status === 'string') {
      const status = body.status.trim().toLowerCase()
      if (status !== 'active' && status !== 'revoked' && status !== 'pending') {
        return NextResponse.json({ success: false, error: '状态仅支持 active/pending/revoked' }, { status: 400 })
      }
      data.status = status
    }
    if (body?.apiTokenId === null) {
      data.apiTokenId = null
    } else if (typeof body?.apiTokenId === 'number' && Number.isFinite(body.apiTokenId)) {
      const tokenId = Math.floor(body.apiTokenId)
      const [token] = await db.select().from(apiTokens).where(eq(apiTokens.id, tokenId)).limit(1)
      if (!token) {
        return NextResponse.json({ success: false, error: '绑定的 Token 不存在' }, { status: 400 })
      }
      data.apiTokenId = tokenId
    }
    if (typeof body?.showSteamNowPlaying === 'boolean') {
      data.showSteamNowPlaying = body.showSteamNowPlaying
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: '没有可更新的字段' }, { status: 400 })
    }

    data.updatedAt = sqlTimestamp()

    const [item] = await db
      .update(devices)
      .set(data as Record<string, never>)
      .where(eq(devices.id, id))
      .returning()
    clearDeviceAuthCache()
    await clearActivityFeedDataCache()

    return NextResponse.json({ success: true, data: item })
  } catch (error) {
    console.error('更新设备失败:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = Number(searchParams.get('id'))
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ success: false, error: '缺少有效的 id' }, { status: 400 })
    }

    await db.delete(devices).where(eq(devices.id, id))
    clearDeviceAuthCache()
    await clearActivityFeedDataCache()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除设备失败:', error)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}
