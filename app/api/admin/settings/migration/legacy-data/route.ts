import { NextRequest, NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import {
  readSiteSettingsMigrationSnapshot,
  serializeSiteSettingsMigrationSnapshot,
} from '@/lib/site-settings-read'
import { clearLegacySiteSettingsData } from '@/lib/site-settings-write'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function DELETE(_request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    await clearLegacySiteSettingsData()
    return NextResponse.json({
      success: true,
      data: serializeSiteSettingsMigrationSnapshot(await readSiteSettingsMigrationSnapshot()),
    })
  } catch (error) {
    if (error instanceof Error && typeof (error as any).status === 'number') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: (error as any).status },
      )
    }

    console.error('Failed to clear legacy data:', error)
    return NextResponse.json({ success: false, error: 'Failed to clear legacy data' }, { status: 500 })
  }
}
