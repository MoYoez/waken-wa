import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'

export async function requireAdminSession() {
  return (await getSession()) ?? null
}

export function unauthorizedJson() {
  return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
}
