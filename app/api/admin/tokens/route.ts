import crypto from 'crypto'
import { and, count, desc, eq, isNull } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import {
  ADMIN_API_TOKENS_PAGE_DEFAULT_SIZE,
  ADMIN_API_TOKENS_RECENT_DEVICES_LIMIT,
  ADMIN_LIST_MAX_PAGE_SIZE,
} from '@/lib/admin-list-constants'
import { clearApiTokenAuthCache, storedFormFromPlainSecret } from '@/lib/api-token-secret'
import { db } from '@/lib/db'
import { clearDeviceAuthCache } from '@/lib/device-auth-cache'
import { apiTokens, devices } from '@/lib/drizzle-schema'
import { parsePaginationParams } from '@/lib/pagination'
import { getPublicOrigin } from '@/lib/public-request-url'
import { readJsonObject } from '@/lib/request-json'
import { sqlTimestamp } from '@/lib/sql-timestamp'

// GET - list API tokens (masked); plaintext secret is only returned once on POST create.
export async function GET(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const { searchParams } = new URL(request.url)
    const rawLimit = searchParams.get('limit')
    const usePagination = rawLimit !== null && rawLimit !== ''

    type DeviceRow = { displayName: string; generatedHashKey: string; lastSeenAt: Date | null }

    const maskWithRecent = (
      tokens: { id: number; name: string; token: string; isActive: boolean; createdAt: Date; lastUsedAt: Date | null }[],
      recentByToken: DeviceRow[][],
    ) =>
      tokens.map((t, i) => ({
        ...t,
        token: t.token.startsWith('h$') ? '••••••••' : t.token.slice(0, 8) + '...',
        recentDevices: (recentByToken[i] as DeviceRow[]).map((d) => ({
          displayName: d.displayName,
          generatedHashKey: d.generatedHashKey,
          lastSeenAt: d.lastSeenAt,
        })),
      }))

    if (usePagination) {
      const { limit, offset } = parsePaginationParams(searchParams, {
        defaultLimit: ADMIN_API_TOKENS_PAGE_DEFAULT_SIZE,
        maxLimit: ADMIN_LIST_MAX_PAGE_SIZE,
      })

      const [tokens, [totalRow]] = await Promise.all([
        db
          .select()
          .from(apiTokens)
          .orderBy(desc(apiTokens.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ c: count() }).from(apiTokens),
      ])
      const total = Number(totalRow?.c ?? 0)

      const recentByToken = await Promise.all(
        tokens.map((t: { id: number }) =>
          db
            .select({
              displayName: devices.displayName,
              generatedHashKey: devices.generatedHashKey,
              lastSeenAt: devices.lastSeenAt,
            })
            .from(devices)
            .where(eq(devices.apiTokenId, t.id))
            .orderBy(desc(devices.lastSeenAt), desc(devices.updatedAt))
            .limit(ADMIN_API_TOKENS_RECENT_DEVICES_LIMIT),
        ),
      )

      const maskedTokens = maskWithRecent(tokens, recentByToken)

      return NextResponse.json({
        success: true,
        data: maskedTokens,
        pagination: { limit, offset, total },
      })
    }

    // Full list (no limit): used by device binding dropdown etc.
    const tokens = await db.select().from(apiTokens).orderBy(desc(apiTokens.createdAt))

    const recentByToken = await Promise.all(
      tokens.map((t: { id: number }) =>
        db
          .select({
            displayName: devices.displayName,
            generatedHashKey: devices.generatedHashKey,
            lastSeenAt: devices.lastSeenAt,
          })
          .from(devices)
          .where(eq(devices.apiTokenId, t.id))
          .orderBy(desc(devices.lastSeenAt), desc(devices.updatedAt))
          .limit(ADMIN_API_TOKENS_RECENT_DEVICES_LIMIT),
      ),
    )

    const maskedTokens = maskWithRecent(tokens, recentByToken)

    return NextResponse.json({ success: true, data: maskedTokens })
  } catch (error) {
    console.error('获取 Token 失败:', error)
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 })
  }
}

// POST - 创建新 Token
export async function POST(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const { name } = await readJsonObject(request)

    if (!name) {
      return NextResponse.json({ success: false, error: '请输入名称' }, { status: 400 })
    }

    const plainToken = crypto.randomBytes(32).toString('hex')
    const storedToken = storedFormFromPlainSecret(plainToken)

    const [result] = await db
      .insert(apiTokens)
      .values({ name, token: storedToken, isActive: true })
      .returning()
    clearApiTokenAuthCache()

    const endpoint = `${getPublicOrigin(request)}/api/activity`
    const tokenBundle = Buffer.from(
      JSON.stringify({
        version: 1,
        endpoint,
        apiKey: plainToken,
        tokenName: result!.name,
      }),
      'utf8',
    ).toString('base64')

    // Plain secret only in this response; DB holds h$ + sha256(plain).
    return NextResponse.json(
      {
        success: true,
        data: { ...result!, token: plainToken },
        tokenBundleBase64: tokenBundle,
        endpoint,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('创建 Token 失败:', error)
    return NextResponse.json({ success: false, error: '创建失败' }, { status: 500 })
  }
}

// PATCH - 切换 Token 状态
export async function PATCH(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const { id, is_active } = await readJsonObject(request)

    if (typeof id !== 'number' || !Number.isFinite(id)) {
      return NextResponse.json({ success: false, error: '无效的 ID' }, { status: 400 })
    }
    if (typeof is_active !== 'boolean') {
      return NextResponse.json({ success: false, error: '无效的状态值' }, { status: 400 })
    }

    await db.update(apiTokens).set({ isActive: is_active }).where(eq(apiTokens.id, id))
    clearApiTokenAuthCache()
    clearDeviceAuthCache()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('更新 Token 失败:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}

// DELETE - 删除 Token
export async function DELETE(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: '缺少有效的 ID' }, { status: 400 })
    }
    const idNum = parseInt(id, 10)
    if (isNaN(idNum)) {
      return NextResponse.json({ success: false, error: '无效的 ID' }, { status: 400 })
    }

    await db.delete(apiTokens).where(eq(apiTokens.id, idNum))
    await db
      .update(devices)
      .set({
        status: 'pending',
        updatedAt: sqlTimestamp(),
      })
      .where(and(isNull(devices.apiTokenId), eq(devices.status, 'active')))
    clearApiTokenAuthCache()
    clearDeviceAuthCache()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除 Token 失败:', error)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}
