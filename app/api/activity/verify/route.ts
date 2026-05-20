import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import {
  consumeApiTokenSecondaryReviewBypass,
  resolveActiveApiTokenFromPlainSecret,
} from '@/lib/api-token-secret'
import { db } from '@/lib/db'
import { clearDeviceAuthCache } from '@/lib/device-auth-cache'
import { devices } from '@/lib/drizzle-schema'
import { buildDeviceApprovalUrl } from '@/lib/public-request-url'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { sqlTimestamp } from '@/lib/sql-timestamp'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function validateToken(
  request: NextRequest,
): Promise<{
  id: number
  bypassSecondaryReview: boolean
  bypassSecondaryReviewFirstUseOnly: boolean
} | null> {
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
        { success: false, error: 'Invalid API token' },
        { status: 401 },
      )
    }
    const canBypassSecondaryReview = !tokenInfo.bypassSecondaryReview
      ? false
      : tokenInfo.bypassSecondaryReviewFirstUseOnly
        ? await consumeApiTokenSecondaryReviewBypass(tokenInfo.id)
        : true

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 },
      )
    }

    const payload = body as Record<string, unknown>
    const generatedHashKey = String(payload.generatedHashKey ?? '').trim()
    const displayName = String(payload.device ?? '').trim() || 'Unknown Device'

    if (!generatedHashKey) {
      return NextResponse.json(
        { success: false, error: 'Missing generatedHashKey' },
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
      const skipReview = autoAccept || canBypassSecondaryReview
      const [created] = await db
        .insert(devices)
        .values({
          generatedHashKey,
          displayName,
          status: skipReview ? 'active' : 'pending',
          apiTokenId: tokenInfo.id,
          lastSeenAt: skipReview ? now : null,
          updatedAt: now,
        })
        .returning()
      deviceRecord = created!
      clearDeviceAuthCache()

      if (!skipReview) {
        return pendingResponse(
          request,
          generatedHashKey,
          displayName,
          'Device is pending admin review',
        )
      }
    }

    if (deviceRecord.status === 'pending') {
      return pendingResponse(
        request,
        generatedHashKey,
        String(deviceRecord.displayName ?? '').trim() || displayName,
        'Device is pending admin review',
      )
    }

    if (deviceRecord.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Device is unavailable or does not exist' },
        { status: 403 },
      )
    }

    if (!deviceRecord.apiTokenId) {
      const nextStatus = canBypassSecondaryReview ? 'active' : 'pending'
      const [updated] = await db
        .update(devices)
        .set({
          status: nextStatus,
          apiTokenId: tokenInfo.id,
          lastSeenAt: canBypassSecondaryReview ? sqlTimestamp() : deviceRecord.lastSeenAt,
          updatedAt: sqlTimestamp(),
        })
        .where(eq(devices.id, deviceRecord.id))
        .returning()
      if (updated) {
        deviceRecord = updated
      }
      clearDeviceAuthCache()
      if (canBypassSecondaryReview) {
        if (deviceRecord.status !== 'active') {
          return NextResponse.json(
            { success: false, error: 'Device is unavailable or does not exist' },
            { status: 403 },
          )
        }
      } else {
      return pendingResponse(
        request,
        generatedHashKey,
        String(deviceRecord.displayName ?? '').trim() || displayName,
        'Device is not bound to a token. Bind and approve it in admin first.',
      )
      }
    }

    if (deviceRecord.apiTokenId !== tokenInfo.id) {
      const nextStatus = canBypassSecondaryReview ? 'active' : 'pending'
      const [updated] = await db
        .update(devices)
        .set({
          status: nextStatus,
          apiTokenId: tokenInfo.id,
          lastSeenAt: canBypassSecondaryReview ? sqlTimestamp() : deviceRecord.lastSeenAt,
          updatedAt: sqlTimestamp(),
        })
        .where(eq(devices.id, deviceRecord.id))
        .returning()
      if (updated) {
        deviceRecord = updated
      }
      clearDeviceAuthCache()
      if (canBypassSecondaryReview) {
        if (deviceRecord.status !== 'active') {
          return NextResponse.json(
            { success: false, error: 'Device is unavailable or does not exist' },
            { status: 403 },
          )
        }
      } else {
      return pendingResponse(
        request,
        generatedHashKey,
        String(deviceRecord.displayName ?? '').trim() || displayName,
        'Device switched to a new token and requires review before it can be used.',
      )
      }
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
    console.error('Failed to verify device token:', error)
    return NextResponse.json(
      { success: false, error: 'Verification failed' },
      { status: 500 },
    )
  }
}
