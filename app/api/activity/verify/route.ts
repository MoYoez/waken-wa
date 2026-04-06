import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { resolveActiveApiTokenFromPlainSecret } from '@/lib/api-token-secret'
import { clearDeviceAuthCache } from '@/lib/device-auth-cache'
import { db } from '@/lib/db'
import { devices } from '@/lib/drizzle-schema'
import { buildDeviceApprovalUrl } from '@/lib/public-request-url'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { sqlTimestamp } from '@/lib/sql-timestamp'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function validateToken(request: NextRequest): Promise<{ id: number } | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  return resolveActiveApiTokenFromPlainSecret(authHeader.slice(7))
}

function pendingResponse(
  request: NextRequest,
  generatedHashKey: string,
  displayName: string,
  message: string,
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      pending: true,
      approvalUrl: buildDeviceApprovalUrl(request, generatedHashKey),
      registration: {
        displayName,
        generatedHashKey,
        status: 'pending' as const,
      },
    },
    { status: 202 },
  )
}

export async function POST(request: NextRequest) {
  try {
    const tokenInfo = await validateToken(request)
    if (!tokenInfo) {
      return NextResponse.json(
        { success: false, error: '无效的 API Token' },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: '请求体格式无效' },
        { status: 400 },
      )
    }

    const payload = body as Record<string, unknown>
    const generatedHashKey = String(payload.generatedHashKey ?? '').trim()
    const displayName = String(payload.device ?? '').trim() || 'Unknown Device'

    if (!generatedHashKey) {
      return NextResponse.json(
        { success: false, error: '缺少 generatedHashKey（设备身份牌）' },
        { status: 400 },
      )
    }

    let [deviceRecord] = await db
      .select()
      .from(devices)
      .where(eq(devices.generatedHashKey, generatedHashKey))
      .limit(1)

    if (!deviceRecord) {
      const siteCfg = await getSiteConfigMemoryFirst()
      const autoAccept = Boolean(siteCfg?.autoAcceptNewDevices)
      const now = sqlTimestamp()
      const [created] = await db
        .insert(devices)
        .values({
          generatedHashKey,
          displayName,
          status: autoAccept ? 'active' : 'pending',
          apiTokenId: tokenInfo.id,
          lastSeenAt: autoAccept ? now : null,
          updatedAt: now,
        })
        .returning()
      deviceRecord = created!
      clearDeviceAuthCache()

      if (!autoAccept) {
        return pendingResponse(
          request,
          generatedHashKey,
          displayName,
          '设备待后台审核后可用',
        )
      }
    }

    if (deviceRecord.status === 'pending') {
      return pendingResponse(
        request,
        generatedHashKey,
        String(deviceRecord.displayName ?? '').trim() || displayName,
        '设备待后台审核后可用',
      )
    }

    if (deviceRecord.status !== 'active') {
      return NextResponse.json(
        { success: false, error: '设备不可用或不存在' },
        { status: 403 },
      )
    }

    if (!deviceRecord.apiTokenId) {
      const [updated] = await db
        .update(devices)
        .set({
          status: 'pending',
          apiTokenId: tokenInfo.id,
          updatedAt: sqlTimestamp(),
        })
        .where(eq(devices.id, deviceRecord.id))
        .returning()
      if (updated) {
        deviceRecord = updated
      }
      clearDeviceAuthCache()
      return pendingResponse(
        request,
        generatedHashKey,
        String(deviceRecord.displayName ?? '').trim() || displayName,
        '设备未绑定 Token，需后台绑定并审核后可用',
      )
    }

    if (deviceRecord.apiTokenId !== tokenInfo.id) {
      const [updated] = await db
        .update(devices)
        .set({
          status: 'pending',
          apiTokenId: tokenInfo.id,
          updatedAt: sqlTimestamp(),
        })
        .where(eq(devices.id, deviceRecord.id))
        .returning()
      if (updated) {
        deviceRecord = updated
      }
      clearDeviceAuthCache()
      return pendingResponse(
        request,
        generatedHashKey,
        String(deviceRecord.displayName ?? '').trim() || displayName,
        '设备已切换到新的 Token，需重新审核后可用',
      )
    }

    if (displayName && displayName !== String(deviceRecord.displayName ?? '').trim()) {
      const [updated] = await db
        .update(devices)
        .set({
          displayName,
          updatedAt: sqlTimestamp(),
        })
        .where(eq(devices.id, deviceRecord.id))
        .returning()
      if (updated) {
        deviceRecord = updated
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        tokenValid: true,
        approved: true,
        deviceStatus: 'active',
        generatedHashKey,
        displayName: String(deviceRecord.displayName ?? '').trim() || displayName,
      },
    })
  } catch (error) {
    console.error('校验设备 Token 失败:', error)
    return NextResponse.json(
      { success: false, error: '校验失败' },
      { status: 500 },
    )
  }
}
