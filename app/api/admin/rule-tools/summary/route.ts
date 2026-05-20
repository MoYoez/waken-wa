import { NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { getRuleToolsSummary } from '@/lib/rule-tools-config'

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
      data: await getRuleToolsSummary(),
    })
  } catch (error) {
    console.error('Failed to read rule tools summary:', error)
    return NextResponse.json({ success: false, error: 'Failed to read' }, { status: 500 })
  }
}
