import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { createSiteLockSession } from '@/lib/auth'
import { resolveCookieSecureFlag } from '@/lib/cookie-security'
import { verifyHCaptchaIfEnabled } from '@/lib/hcaptcha'
import { getRequestLanguage } from '@/lib/i18n/request-locale'
import { getT } from '@/lib/i18n/server'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'

export async function POST(request: NextRequest) {
  try {
    const { t } = await getT('auth', { lng: getRequestLanguage(request) })
    const { password, hcaptchaToken } = await request.json()
    const rawPassword = String(password ?? '')
    if (!rawPassword) {
      return NextResponse.json({ success: false, error: t('siteLock.passwordRequired') }, { status: 400 })
    }

    const config = await getSiteConfigMemoryFirst()
    if (!config?.pageLockEnabled) {
      return NextResponse.json({ success: true })
    }

    const captchaOk = await verifyHCaptchaIfEnabled(hcaptchaToken)
    if (!captchaOk) {
      return NextResponse.json(
        { success: false, error: t('siteLock.captchaFailed') },
        { status: 403 },
      )
    }

    const hash = String(config.pageLockPasswordHash || '')
    const ok = !!hash && (await bcrypt.compare(rawPassword, hash))
    if (!ok) {
      return NextResponse.json({ success: false, error: t('siteLock.invalidPassword') }, { status: 401 })
    }

    const token = await createSiteLockSession()
    const cookieStore = await cookies()
    cookieStore.set('site_lock', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: await resolveCookieSecureFlag(request, 'site_lock'),
      path: '/',
      maxAge: 60 * 60 * 24,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('解锁主页失败:', error)
    const { t } = await getT('auth', { lng: getRequestLanguage(request) })
    return NextResponse.json({ success: false, error: t('siteLock.unlockFailed') }, { status: 500 })
  }
}
