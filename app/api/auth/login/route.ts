import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { authenticateAdmin, createSession } from '@/lib/auth'
import { resolveCookieSecureFlag } from '@/lib/cookie-security'
import { verifyHCaptchaIfEnabled } from '@/lib/hcaptcha'
import { getRequestLanguage } from '@/lib/i18n/request-locale'
import { getT } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { t } = await getT('auth', { lng: getRequestLanguage(request) })
    const { username, password, hcaptchaToken } = await request.json()
    
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: t('login.usernamePasswordRequired') },
        { status: 400 }
      )
    }

    const captchaOk = await verifyHCaptchaIfEnabled(hcaptchaToken)
    if (!captchaOk) {
      return NextResponse.json(
        { success: false, error: t('login.captchaFailed') },
        { status: 403 },
      )
    }
    
    const user = await authenticateAdmin(username, password)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: t('login.invalidCredentials') },
        { status: 401 }
      )
    }
    
    const token = await createSession(user.id, user.username)
    
    const cookieStore = await cookies()

    cookieStore.set('session', token, {
      httpOnly: true,
      secure: await resolveCookieSecureFlag(request, 'session'),
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: '/',
    })
    
    return NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username }
    })
  } catch (error) {
    console.error('登录失败:', error)
    const { t } = await getT('auth', { lng: getRequestLanguage(request) })
    return NextResponse.json(
      { success: false, error: t('login.failed') },
      { status: 500 }
    )
  }
}
