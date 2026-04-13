import { NextRequest, NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'
import { getRequestLanguage } from '@/lib/i18n/request-locale'
import { getT } from '@/lib/i18n/server'

export async function GET(request: NextRequest) {
  const { t } = await getT('auth', { lng: getRequestLanguage(request) })
  const session = await getSession()
  
  if (!session) {
    return NextResponse.json(
      { success: false, error: t('session.notLoggedIn') },
      { status: 401 }
    )
  }
  
  return NextResponse.json({
    success: true,
    user: { id: session.userId, username: session.username }
  })
}
