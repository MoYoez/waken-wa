import { NextRequest, NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import {
  readSiteSettingsMigrationSnapshot,
  serializeSiteSettingsMigrationSnapshot,
} from '@/lib/site-settings-read'
import { migrateLegacySiteSettings } from '@/lib/site-settings-write'

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
      data: serializeSiteSettingsMigrationSnapshot(await readSiteSettingsMigrationSnapshot()),
    })
  } catch (error) {
    console.error('读取迁移状态失败:', error)
    return NextResponse.json({ success: false, error: '读取失败' }, { status: 500 })
  }
}

export async function POST(_request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    await migrateLegacySiteSettings()
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

    console.error('执行迁移失败:', error)
    return NextResponse.json({ success: false, error: '迁移失败' }, { status: 500 })
  }
}
