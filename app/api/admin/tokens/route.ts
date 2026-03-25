import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

async function requireAdmin() {
  const session = await getSession()
  if (!session) return null
  return session
}

// GET - 获取所有 API Token
export async function GET() {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }
  
  try {
    const tokens = await prisma.apiToken.findMany({
      orderBy: { createdAt: 'desc' }
    })
    
    // 隐藏完整 token，只显示前8位
    const maskedTokens = tokens.map(t => ({
      ...t,
      token: t.token.slice(0, 8) + '...'
    }))
    
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
    
    // 返回完整 token（仅创建时可见）
    return NextResponse.json({ success: true, data: result }, { status: 201 })
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
