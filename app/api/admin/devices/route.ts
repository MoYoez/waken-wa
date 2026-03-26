import { createHash, randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function requireAdmin() {
  const session = await getSession()
  return session ?? null
}

function generateHashKey(seed = ''): string {
  const raw = `${seed}:${Date.now()}:${randomBytes(24).toString('hex')}`
  return createHash('sha256').update(raw).digest('hex')
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = String(searchParams.get('status') ?? '').trim()
    const q = String(searchParams.get('q') ?? '').trim()

    const where: any = {}
    if (status) where.status = status
    if (q) {
      where.OR = [
        { displayName: { contains: q, mode: 'insensitive' } },
        { generatedHashKey: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [items, total] = await Promise.all([
      (prisma as any).device.findMany({
        where,
        include: {
          apiToken: { select: { id: true, name: true, isActive: true } },
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      (prisma as any).device.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: items,
      pagination: { limit, offset, total },
    })
  } catch (error) {
    console.error('获取设备列表失败:', error)
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const displayName = String(body?.displayName ?? '').trim()
    const apiTokenIdRaw = body?.apiTokenId
    const apiTokenId =
      typeof apiTokenIdRaw === 'number' && Number.isFinite(apiTokenIdRaw) ? Math.floor(apiTokenIdRaw) : null

    if (!displayName) {
      return NextResponse.json({ success: false, error: '请输入设备显示名' }, { status: 400 })
    }

    if (apiTokenId) {
      const token = await prisma.apiToken.findUnique({ where: { id: apiTokenId } })
      if (!token) {
        return NextResponse.json({ success: false, error: '绑定的 Token 不存在' }, { status: 400 })
      }
    }

    let generatedHashKey = generateHashKey(displayName)
    // very low collision chance, but keep a bounded retry for safety
    for (let i = 0; i < 3; i++) {
      const exists = await (prisma as any).device.findUnique({ where: { generatedHashKey } })
      if (!exists) break
      generatedHashKey = generateHashKey(`${displayName}:${i}`)
    }

    const item = await (prisma as any).device.create({
      data: {
        displayName,
        generatedHashKey,
        status: 'active',
        apiTokenId,
      },
    })

    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch (error) {
    console.error('创建设备失败:', error)
    return NextResponse.json({ success: false, error: '创建失败' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const id = Number(body?.id)
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ success: false, error: '缺少有效的 id' }, { status: 400 })
    }

    const data: any = {}
    if (typeof body?.displayName === 'string') {
      const displayName = body.displayName.trim()
      if (!displayName) {
        return NextResponse.json({ success: false, error: '设备显示名不能为空' }, { status: 400 })
      }
      data.displayName = displayName
    }
    if (typeof body?.status === 'string') {
      const status = body.status.trim().toLowerCase()
      if (status !== 'active' && status !== 'revoked' && status !== 'pending') {
        return NextResponse.json({ success: false, error: '状态仅支持 active/pending/revoked' }, { status: 400 })
      }
      data.status = status
    }
    if (body?.apiTokenId === null) {
      data.apiTokenId = null
    } else if (typeof body?.apiTokenId === 'number' && Number.isFinite(body.apiTokenId)) {
      const tokenId = Math.floor(body.apiTokenId)
      const token = await prisma.apiToken.findUnique({ where: { id: tokenId } })
      if (!token) {
        return NextResponse.json({ success: false, error: '绑定的 Token 不存在' }, { status: 400 })
      }
      data.apiTokenId = tokenId
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: '没有可更新的字段' }, { status: 400 })
    }

    const item = await (prisma as any).device.update({
      where: { id },
      data,
    })

    return NextResponse.json({ success: true, data: item })
  } catch (error) {
    console.error('更新设备失败:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = Number(searchParams.get('id'))
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ success: false, error: '缺少有效的 id' }, { status: 400 })
    }

    await (prisma as any).device.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除设备失败:', error)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}

