import { NextRequest, NextResponse } from 'next/server'

import { getActivityFeedData } from '@/lib/activity-feed'
import { getBearerApiTokenRecord, getSession, isSiteLockSatisfied } from '@/lib/auth'
import { gateInspirationApiForDevice } from '@/lib/inspiration-device-allowlist'
import { linkInspirationAssetsToEntry, validateInlineImageDataUrl } from '@/lib/inspiration-inline-images'
import prisma from '@/lib/prisma'

function formatStatusSnapshotFromFeed(feed: Awaited<ReturnType<typeof getActivityFeedData>>): string | null {
  const lines = feed.activeStatuses
    .map((s: { statusText?: string; processName?: string; processTitle?: string | null }) => {
      const st = String(s?.statusText ?? '').trim()
      if (st) return st
      const pn = String(s?.processName ?? '').trim()
      const pt = s?.processTitle != null ? String(s.processTitle).trim() : ''
      if (pt && pn) return `${pt} | ${pn}`
      return pn || pt || ''
    })
    .filter(Boolean)
  if (lines.length === 0) return null
  return lines.join('\n')
}

// Force dynamic rendering, disable caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    if (!(await isSiteLockSatisfied())) {
      return NextResponse.json({ success: false, error: '页面已锁定' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const q = searchParams.get('q')?.trim()

    const dbUrl = process.env.DATABASE_URL ?? ''
    const useInsensitive =
      dbUrl.startsWith('postgresql:') || dbUrl.startsWith('postgres:')

    const textContains = (value: string) =>
      useInsensitive
        ? ({ contains: value, mode: 'insensitive' as const } as const)
        : ({ contains: value } as const)

    const where: any = q
      ? {
          OR: [
            { title: textContains(q) },
            { content: textContains(q) },
            { statusSnapshot: textContains(q) },
          ],
        }
      : {}

    const [items, total] = await Promise.all([
      (prisma as any).inspirationEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      (prisma as any).inspirationEntry.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: items,
      pagination: { limit, offset, total },
    })
  } catch (error) {
    console.error('获取灵感条目失败:', error)
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 })
  }
}

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
    const attachCurrentStatus = Boolean(body?.attachCurrentStatus)

    if (attachCurrentStatus && !session) {
      return NextResponse.json(
        { success: false, error: '仅登录管理员可附带当前状态' },
        { status: 403 }
      )
    }

    const titleRaw = body?.title ?? body?.heading
    const title =
      typeof titleRaw === 'string' ? titleRaw.trim() : null
    const titleFinal = title && title.length > 0 ? title : null

    const contentRaw = body?.content ?? body?.text ?? body?.body
    const content =
      typeof contentRaw === 'string' ? contentRaw.trim() : ''
    if (!content) {
      return NextResponse.json({ success: false, error: '缺少 content' }, { status: 400 })
    }

    const imageDataUrlRaw = body?.imageDataUrl ?? body?.dataUrl ?? body?.image_data_url
    const imageDataUrl =
      typeof imageDataUrlRaw === 'string' && imageDataUrlRaw.trim().length > 0
        ? imageDataUrlRaw.trim()
        : null

    if (imageDataUrl) {
      const imgCheck = validateInlineImageDataUrl(imageDataUrl)
      if (!imgCheck.ok) {
        return NextResponse.json({ success: false, error: imgCheck.error }, { status: 400 })
      }
    }

    let statusSnapshot: string | null = null
    if (attachCurrentStatus && session) {
      const feed = await getActivityFeedData(50)
      statusSnapshot = formatStatusSnapshotFromFeed(feed)
    }

    const entry = await (prisma as any).inspirationEntry.create({
      data: {
        title: titleFinal,
        content,
        imageDataUrl,
        statusSnapshot,
      },
    })

    await linkInspirationAssetsToEntry(prisma as any, entry.id, content)

    return NextResponse.json({ success: true, data: entry }, { status: 201 })
  } catch (error) {
    console.error('提交灵感条目失败:', error)
    return NextResponse.json({ success: false, error: '提交失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const idRaw = searchParams.get('id')
    const id = idRaw ? parseInt(idRaw) : NaN
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ success: false, error: '缺少有效的 id' }, { status: 400 })
    }

    await (prisma as any).inspirationEntry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除灵感条目失败:', error)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}

