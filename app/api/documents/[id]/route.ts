import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import fs from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 验证用户登录
  const { error, user } = await requireAuth()
  if (error) return error

  try {
    // Next.js 15+ params 是 Promise
    const { id } = await params

    const document = await prisma.pdfDocument.findUnique({
      where: { id },
      include: {
        conversations: {
          orderBy: { updatedAt: 'desc' },
          take: 10
        }
      }
    })

    if (!document) {
      return NextResponse.json(
        { error: '文档不存在' },
        { status: 404 }
      )
    }

    // 验证文档所有权
    if (document.userId !== user!.id) {
      return NextResponse.json(
        { error: '无权访问该文档' },
        { status: 403 }
      )
    }

    return NextResponse.json({ document })
  } catch (error) {
    console.error('获取文档失败:', error)
    return NextResponse.json(
      { error: '获取文档失败' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth()
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()
    const { originalName } = body

    if (!originalName || typeof originalName !== 'string' || !originalName.trim()) {
      return NextResponse.json({ error: '文件名不能为空' }, { status: 400 })
    }

    const document = await prisma.pdfDocument.findUnique({ where: { id } })

    if (!document) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 })
    }

    if (document.userId !== user!.id) {
      return NextResponse.json({ error: '无权修改该文档' }, { status: 403 })
    }

    const updated = await prisma.pdfDocument.update({
      where: { id },
      data: { originalName: originalName.trim() }
    })

    return NextResponse.json({ document: updated })
  } catch (error) {
    console.error('重命名文档失败:', error)
    return NextResponse.json({ error: '重命名失败' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 验证用户登录
  const { error, user } = await requireAuth()
  if (error) return error

  try {
    const { id } = await params

    // 查找文档
    const document = await prisma.pdfDocument.findUnique({
      where: { id }
    })

    if (!document) {
      return NextResponse.json(
        { error: '文档不存在' },
        { status: 404 }
      )
    }

    // 验证文档所有权
    if (document.userId !== user!.id) {
      return NextResponse.json(
        { error: '无权删除该文档' },
        { status: 403 }
      )
    }

    // 删除物理文件
    let filePath = document.filePath
    if (filePath.startsWith('/uploads/')) {
      filePath = path.join(process.cwd(), 'public', filePath)
    } else if (!path.isAbsolute(filePath)) {
      filePath = path.join(process.cwd(), filePath)
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    // 删除数据库记录（级联删除 pages, conversations, messages）
    await prisma.pdfDocument.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除文档失败:', error)
    return NextResponse.json(
      { error: '删除文档失败' },
      { status: 500 }
    )
  }
}
