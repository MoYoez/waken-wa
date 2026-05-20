import { NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { getRuleToolsExportPayload } from '@/lib/rule-tools-config'

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
      data: await getRuleToolsExportPayload(),
    })
  } catch (error) {
    console.error('Failed to export rule tools:', error)
    return NextResponse.json({ success: false, error: 'Failed to export' }, { status: 500 })
  }
}
