import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authenticateAdmin, createSession } from '@/lib/auth'

// 强制动态渲染
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: '请输入用户名和密码' },
        { status: 400 }
      )
    }
    
    const user = await authenticateAdmin(username, password)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: '用户名或密码错误' },
        { status: 401 }
      )
    }
    
    const token = await createSession(user.id, user.username)
    
    const cookieStore = await cookies()
    const isProduction = process.env.NODE_ENV === 'production'
    
    console.log('[v0] Setting session cookie, production:', isProduction)
    
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: isProduction,
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
    return NextResponse.json(
      { success: false, error: '登录失败' },
      { status: 500 }
    )
  }
}
