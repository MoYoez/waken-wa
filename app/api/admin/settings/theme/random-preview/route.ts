import { NextRequest, NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { readJsonObject } from '@/lib/request-json'
import {
  fetchThemeRandomImageUrl,
  isAllowedThemeRemoteImageUrl,
} from '@/lib/theme-random-api'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) return unauthorizedJson()

  try {
    const body = await readJsonObject(request)
    const apiUrl = String(body?.apiUrl ?? '').trim()
    if (!apiUrl || !isAllowedThemeRemoteImageUrl(apiUrl)) {
      return NextResponse.json(
        { success: false, error: 'Invalid api url' },
        { status: 400 },
      )
    }

    const imageUrl = await fetchThemeRandomImageUrl(apiUrl)
    return NextResponse.json({ success: true, data: { imageUrl } })
  } catch (error) {
    console.error('theme random preview failed:', error)
    return NextResponse.json(
      { success: false, error: 'Random api preview failed' },
      { status: 502 },
    )
  }
}
