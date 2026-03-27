import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

async function requireAdmin() {
  const session = await getSession()
  if (!session) return null
  return session
}

// GET - 获取所有 API Token / 指定 Token 接入配置
export async function GET(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }
  
  try {
    const { searchParams } = new URL(request.url)
    const bundleId = searchParams.get('bundle_id')

    if (bundleId) {
      const id = parseInt(bundleId, 10)
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ success: false, error: '无效的 Token ID' }, { status: 400 })
      }

      const tokenRecord = await prisma.apiToken.findUnique({
        where: { id }
      })
      if (!tokenRecord) {
        return NextResponse.json({ success: false, error: 'Token 不存在' }, { status: 404 })
      }

      const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000'
      const proto = request.headers.get('x-forwarded-proto') || 'http'
      const endpoint = `${proto}://${host}/api/activity`
      const encoded = Buffer.from(
        JSON.stringify({
          version: 1,
          endpoint,
          apiKey: tokenRecord.token,
          tokenName: tokenRecord.name,
        }),
        'utf8'
      ).toString('base64')

      return NextResponse.json({
        success: true,
        data: {
          id: tokenRecord.id,
          name: tokenRecord.name,
          endpoint,
          encoded,
        },
      })
    }

    const rawLimit = searchParams.get('limit')
    const usePagination = rawLimit !== null && rawLimit !== ''

    const recentLimit = 5
    type DeviceRow = { displayName: string; generatedHashKey: string; lastSeenAt: Date | null }

    const maskWithRecent = (
      tokens: { id: number; name: string; token: string; isActive: boolean; createdAt: Date; lastUsedAt: Date | null }[],
      recentByToken: DeviceRow[][],
    ) =>
      tokens.map((t, i) => ({
        ...t,
        token: t.token.slice(0, 8) + '...',
        recentDevices: (recentByToken[i] as DeviceRow[]).map((d) => ({
          displayName: d.displayName,
          generatedHashKey: d.generatedHashKey,
          lastSeenAt: d.lastSeenAt,
        })),
      }))

    if (usePagination) {
      const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 10, 1), 100)
      const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0)

      const [tokens, total] = await Promise.all([
        prisma.apiToken.findMany({
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.apiToken.count(),
      ])

      const recentByToken = await Promise.all(
        tokens.map((t) =>
          (prisma as any).device.findMany({
            where: { apiTokenId: t.id },
            orderBy: [{ lastSeenAt: 'desc' }, { updatedAt: 'desc' }],
            take: recentLimit,
            select: {
              displayName: true,
              generatedHashKey: true,
              lastSeenAt: true,
            },
          })
        )
      )

      const maskedTokens = maskWithRecent(tokens, recentByToken)

      return NextResponse.json({
        success: true,
        data: maskedTokens,
        pagination: { limit, offset, total },
      })
    }

    // Full list (no limit): used by device binding dropdown etc.
    const tokens = await prisma.apiToken.findMany({
      orderBy: { createdAt: 'desc' },
    })

    const recentByToken = await Promise.all(
      tokens.map((t) =>
        (prisma as any).device.findMany({
          where: { apiTokenId: t.id },
          orderBy: [{ lastSeenAt: 'desc' }, { updatedAt: 'desc' }],
          take: recentLimit,
          select: {
            displayName: true,
            generatedHashKey: true,
            lastSeenAt: true,
          },
        })
      )
    )

    const maskedTokens = maskWithRecent(tokens, recentByToken)

    return NextResponse.json({ success: true, data: maskedTokens })
  } catch (error) {
    console.error('获取 Token 失败:', error)
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 })
  }
}

// POST - 创建新 Token
export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }
  
  try {
    const { name } = await request.json()
    
    if (!name) {
      return NextResponse.json({ success: false, error: '请输入名称' }, { status: 400 })
    }
    
    const token = crypto.randomBytes(32).toString('hex')
    
    const result = await prisma.apiToken.create({
      data: { name, token, isActive: true }
    })
    
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000'
    const proto = request.headers.get('x-forwarded-proto') || 'http'
    const endpoint = `${proto}://${host}/api/activity`
    const tokenBundle = Buffer.from(
      JSON.stringify({
        version: 1,
        endpoint,
        apiKey: result.token,
        tokenName: result.name,
      }),
      'utf8'
    ).toString('base64')

    // 返回完整 token（仅创建时可见）
    return NextResponse.json(
      { success: true, data: result, tokenBundleBase64: tokenBundle, endpoint },
      { status: 201 }
    )
  } catch (error) {
    console.error('创建 Token 失败:', error)
    return NextResponse.json({ success: false, error: '创建失败' }, { status: 500 })
  }
}

// PATCH - 切换 Token 状态
export async function PATCH(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }
  
  try {
    const { id, is_active } = await request.json()
    
    if (!id) {
      return NextResponse.json({ success: false, error: '缺少 ID' }, { status: 400 })
    }
    
    await prisma.apiToken.update({
      where: { id },
      data: { isActive: is_active }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('更新 Token 失败:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}

// DELETE - 删除 Token
export async function DELETE(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }
  
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ success: false, error: '缺少 ID' }, { status: 400 })
    }
    
    await prisma.apiToken.delete({
      where: { id: parseInt(id) }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除 Token 失败:', error)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}
