import { NextRequest, NextResponse } from 'next/server'

import { exportActivityAppsSnapshot } from '@/lib/activity-app-export'
import { enforceApiRateLimit } from '@/lib/api-rate-limit'
import { verifySkillsRequest } from '@/lib/skills-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const LLM_APPS_EXPORT_RATE_LIMIT_MAX = 60
const LLM_APPS_EXPORT_RATE_LIMIT_WINDOW_MS = 60_000

export async function GET(request: NextRequest) {
  const limitedResponse = await enforceApiRateLimit(request, {
    bucket: 'llm-apps-export',
    maxRequests: LLM_APPS_EXPORT_RATE_LIMIT_MAX,
    windowMs: LLM_APPS_EXPORT_RATE_LIMIT_WINDOW_MS,
  })
  if (limitedResponse) return limitedResponse

  const auth = await verifySkillsRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    return NextResponse.json({
      success: true,
      data: await exportActivityAppsSnapshot(),
    })
  } catch (error) {
    console.error('LLM 导出应用记录失败:', error)
    return NextResponse.json({ success: false, error: '导出失败' }, { status: 500 })
  }
}
