import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  
  if (!session) {
    return NextResponse.json(
      { success: false, error: '未登录' },
      { status: 401 }
    )
  }
  
  return NextResponse.json({
    success: true,
    user: { id: session.userId, username: session.username }
  })
}
