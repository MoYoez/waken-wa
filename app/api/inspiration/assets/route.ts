import { NextRequest, NextResponse } from 'next/server'

import { getBearerApiTokenRecord, getSession } from '@/lib/auth'
import { gateInspirationApiForDevice } from '@/lib/inspiration-device-allowlist'
import {
  inspirationInlineImageUrl,
  validateInlineImageDataUrl,
} from '@/lib/inspiration-inline-images'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  const session = await getSession()
  const apiToken = await getBearerApiTokenRecord(request.headers.get('authorization'))

  if (!session && !apiToken) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const body = await request.json()
    if (!session && apiToken) {
      const gate = await gateInspirationApiForDevice(
        prisma,
        apiToken.id,
        request,
        body && typeof body === 'object' ? (body as Record<string, unknown>) : null,
      )
      if (!gate.ok) {
        return NextResponse.json({ success: false, error: gate.error }, { status: gate.status })
      }
    }
    const imageDataUrlRaw = body?.imageDataUrl ?? body?.dataUrl
    const imageDataUrl =
      typeof imageDataUrlRaw === 'string' && imageDataUrlRaw.trim().length > 0
        ? imageDataUrlRaw.trim()
        : ''

    if (!imageDataUrl) {
      return NextResponse.json({ success: false, error: '缺少 imageDataUrl' }, { status: 400 })
    }

    const check = validateInlineImageDataUrl(imageDataUrl)
    if (!check.ok) {
      return NextResponse.json({ success: false, error: check.error }, { status: 400 })
    }

    const row = await (prisma as any).inspirationAsset.create({
      data: {
        imageDataUrl,
        inspirationEntryId: null,
      },
    })

    const url = inspirationInlineImageUrl(row.publicKey)

    return NextResponse.json(
      {
        success: true,
        data: {
          publicKey: row.publicKey,
          url,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('inspiration asset upload failed:', error)
    return NextResponse.json({ success: false, error: '上传失败' }, { status: 500 })
  }
}
