import { NextRequest, NextResponse } from 'next/server'

import { getSession, isSiteLockSatisfied } from '@/lib/auth'
import { resolveCookieSecureFlag } from '@/lib/cookie-security'
import {
  createViewerPresenceId,
  getViewerPresenceCount,
  normalizeViewerPresenceId,
  touchViewerPresence,
} from '@/lib/viewer-presence'
import {
  VIEWER_PRESENCE_COOKIE_MAX_AGE_SECONDS,
  VIEWER_PRESENCE_COOKIE_NAME,
} from '@/lib/viewer-presence-constants'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function canReadViewerPresence(): Promise<boolean> {
  const session = await getSession()
  if (session) return true
  return isSiteLockSatisfied()
}

export async function GET() {
  try {
    if (!(await canReadViewerPresence())) {
      return NextResponse.json({ success: false, error: '请先解锁页面' }, { status: 403 })
    }

    const count = await getViewerPresenceCount()
    return NextResponse.json({ success: true, data: { count } })
  } catch (error) {
    console.error('读取在线访客数失败:', error)
    return NextResponse.json({ success: false, error: '读取在线访客数失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await canReadViewerPresence())) {
      return NextResponse.json({ success: false, error: '请先解锁页面' }, { status: 403 })
    }

    const existingViewerId = normalizeViewerPresenceId(
      request.cookies.get(VIEWER_PRESENCE_COOKIE_NAME)?.value,
    )
    const viewerId = existingViewerId ?? createViewerPresenceId()
    const count = await touchViewerPresence(viewerId)

    const response = NextResponse.json({ success: true, data: { count } })
    if (!existingViewerId) {
      response.cookies.set(VIEWER_PRESENCE_COOKIE_NAME, viewerId, {
        httpOnly: false,
        sameSite: 'lax',
        secure: await resolveCookieSecureFlag(request, VIEWER_PRESENCE_COOKIE_NAME),
        path: '/',
        maxAge: VIEWER_PRESENCE_COOKIE_MAX_AGE_SECONDS,
      })
    }
    return response
  } catch (error) {
    console.error('更新在线访客心跳失败:', error)
    return NextResponse.json({ success: false, error: '更新在线访客心跳失败' }, { status: 500 })
  }
}
