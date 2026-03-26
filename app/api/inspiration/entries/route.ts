import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// Force dynamic rendering, disable caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

async function validateApiToken(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return false

  const token = authHeader.slice(7)
  const result = await prisma.apiToken.findFirst({
    where: { token, isActive: true },
  })

  if (!result) return false

  await prisma.apiToken.update({
    where: { id: result.id },
    data: { lastUsedAt: new Date() },
  })

  return true
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const q = searchParams.get('q')?.trim()

    const where: any = q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { content: { contains: q, mode: 'insensitive' } },
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
  const tokenOk = await validateApiToken(request)

  if (!session && !tokenOk) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const body = await request.json()

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

    const entry = await (prisma as any).inspirationEntry.create({
      data: {
        title: titleFinal,
        content,
        imageDataUrl,
      },
    })

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

