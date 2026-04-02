import { NextRequest, NextResponse } from 'next/server'

import { enforceApiRateLimit } from '@/lib/api-rate-limit'
import { getSafeSiteConfig, updateSiteConfigFromPayload } from '@/lib/llm-site-config'
import { verifySkillsRequest } from '@/lib/skills-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const LLM_SETTINGS_RATE_LIMIT_MAX = 60
const LLM_SETTINGS_RATE_LIMIT_WINDOW_MS = 60_000

export async function GET(request: NextRequest) {
  const limitedResponse = await enforceApiRateLimit(request, {
    bucket: 'llm-settings-get',
    maxRequests: LLM_SETTINGS_RATE_LIMIT_MAX,
    windowMs: LLM_SETTINGS_RATE_LIMIT_WINDOW_MS,
  })
  if (limitedResponse) return limitedResponse

  const auth = await verifySkillsRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    return NextResponse.json({
      success: true,
      data: await getSafeSiteConfig(),
    })
  } catch (error) {
    console.error('读取 LLM 站点配置失败:', error)
    return NextResponse.json({ success: false, error: '读取失败' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const limitedResponse = await enforceApiRateLimit(request, {
    bucket: 'llm-settings-patch',
    maxRequests: LLM_SETTINGS_RATE_LIMIT_MAX,
    windowMs: LLM_SETTINGS_RATE_LIMIT_WINDOW_MS,
  })
  if (limitedResponse) return limitedResponse

  const auth = await verifySkillsRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json().catch(() => null)
    const data = await updateSiteConfigFromPayload(body)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof Error && typeof (error as any).status === 'number') {
      const extra =
        Array.isArray((error as any).deniedKeys) && (error as any).deniedKeys.length > 0
          ? { deniedKeys: (error as any).deniedKeys }
          : {}
      return NextResponse.json(
        { success: false, error: error.message, ...extra },
        { status: (error as any).status },
      )
    }

    console.error('更新 LLM 站点配置失败:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}
