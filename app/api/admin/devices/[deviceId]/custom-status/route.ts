import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { clearActivityFeedDataCache } from '@/lib/activity-feed'
import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { db } from '@/lib/db'
import { devices } from '@/lib/drizzle-schema'
import { readJsonObject } from '@/lib/request-json'
import { sqlTimestamp } from '@/lib/sql-timestamp'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface CustomStatusUpdateBody {
  customOfflineStatus?: string | null
  customOfflineStatusEnabled?: boolean
  customLockStatus?: string | null
  customLockStatusEnabled?: boolean
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const { deviceId: deviceIdStr } = await params
    const deviceId = parseInt(deviceIdStr, 10)
    if (isNaN(deviceId)) {
      return NextResponse.json({ error: 'Invalid device ID' }, { status: 400 })
    }

    const device = await db.query.devices.findFirst({
      where: eq(devices.id, deviceId),
      columns: {
        id: true,
        displayName: true,
        customOfflineStatus: true,
        customOfflineStatusEnabled: true,
        customOfflineStatusUpdatedAt: true,
        customLockStatus: true,
        customLockStatusEnabled: true,
        customLockStatusUpdatedAt: true,
      },
    })

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: device.id,
        displayName: device.displayName,
        customOfflineStatus: device.customOfflineStatus,
        customOfflineStatusEnabled: device.customOfflineStatusEnabled ?? false,
        customOfflineStatusUpdatedAt: device.customOfflineStatusUpdatedAt
          ? (device.customOfflineStatusUpdatedAt instanceof Date
              ? device.customOfflineStatusUpdatedAt.toISOString()
              : device.customOfflineStatusUpdatedAt)
          : null,
        customLockStatus: device.customLockStatus,
        customLockStatusEnabled: device.customLockStatusEnabled ?? false,
        customLockStatusUpdatedAt: device.customLockStatusUpdatedAt
          ? (device.customLockStatusUpdatedAt instanceof Date
              ? device.customLockStatusUpdatedAt.toISOString()
              : device.customLockStatusUpdatedAt)
          : null,
      },
    })
  } catch (error) {
    console.error('Error fetching device custom status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const { deviceId: deviceIdStr } = await params
    const deviceId = parseInt(deviceIdStr, 10)
    if (isNaN(deviceId)) {
      return NextResponse.json({ error: 'Invalid device ID' }, { status: 400 })
    }

    const body = await readJsonObject(request) as CustomStatusUpdateBody

    const updateData: Record<string, unknown> = {}

    if (body.customOfflineStatus !== undefined) {
      if (body.customOfflineStatus === null || body.customOfflineStatus === '') {
        updateData.customOfflineStatus = null
        updateData.customOfflineStatusUpdatedAt = null
      } else if (typeof body.customOfflineStatus === 'string') {
        const trimmed = body.customOfflineStatus.trim()
        if (trimmed.length > 100) {
          return NextResponse.json(
            { error: 'Custom offline status must be 100 characters or less' },
            { status: 400 },
          )
        }
        updateData.customOfflineStatus = trimmed
        updateData.customOfflineStatusUpdatedAt = sqlTimestamp()
      }
    }

    if (body.customOfflineStatusEnabled !== undefined) {
      updateData.customOfflineStatusEnabled = Boolean(body.customOfflineStatusEnabled)
    }

    if (body.customLockStatus !== undefined) {
      if (body.customLockStatus === null || body.customLockStatus === '') {
        updateData.customLockStatus = null
        updateData.customLockStatusUpdatedAt = null
      } else if (typeof body.customLockStatus === 'string') {
        const trimmed = body.customLockStatus.trim()
        if (trimmed.length > 100) {
          return NextResponse.json(
            { error: 'Custom lock status must be 100 characters or less' },
            { status: 400 },
          )
        }
        updateData.customLockStatus = trimmed
        updateData.customLockStatusUpdatedAt = sqlTimestamp()
      }
    }

    if (body.customLockStatusEnabled !== undefined) {
      updateData.customLockStatusEnabled = Boolean(body.customLockStatusEnabled)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const [updatedDevice] = await db
      .update(devices)
      .set(updateData)
      .where(eq(devices.id, deviceId))
      .returning({
        id: devices.id,
        displayName: devices.displayName,
        customOfflineStatus: devices.customOfflineStatus,
        customOfflineStatusEnabled: devices.customOfflineStatusEnabled,
        customOfflineStatusUpdatedAt: devices.customOfflineStatusUpdatedAt,
        customLockStatus: devices.customLockStatus,
        customLockStatusEnabled: devices.customLockStatusEnabled,
        customLockStatusUpdatedAt: devices.customLockStatusUpdatedAt,
      })

    if (!updatedDevice) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    clearActivityFeedDataCache()

    return NextResponse.json({
      success: true,
      data: {
        id: updatedDevice.id,
        displayName: updatedDevice.displayName,
        customOfflineStatus: updatedDevice.customOfflineStatus,
        customOfflineStatusEnabled: updatedDevice.customOfflineStatusEnabled ?? false,
        customOfflineStatusUpdatedAt: updatedDevice.customOfflineStatusUpdatedAt
          ? (updatedDevice.customOfflineStatusUpdatedAt instanceof Date
              ? updatedDevice.customOfflineStatusUpdatedAt.toISOString()
              : updatedDevice.customOfflineStatusUpdatedAt)
          : null,
        customLockStatus: updatedDevice.customLockStatus,
        customLockStatusEnabled: updatedDevice.customLockStatusEnabled ?? false,
        customLockStatusUpdatedAt: updatedDevice.customLockStatusUpdatedAt
          ? (updatedDevice.customLockStatusUpdatedAt instanceof Date
              ? updatedDevice.customLockStatusUpdatedAt.toISOString()
              : updatedDevice.customLockStatusUpdatedAt)
          : null,
      },
    })
  } catch (error) {
    console.error('Error updating device custom status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
