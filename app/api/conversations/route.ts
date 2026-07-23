import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

// 创建新对话
export async function POST(request: NextRequest) {
  // 验证用户登录
  const { error, user } = await requireAuth()
  if (error) return error

  try {
    const body = await request.json()
    const { documentId, title } = body

    if (!documentId) {
      return NextResponse.json(
        { error: '缺少 documentId' },
        { status: 400 }
      )
    }

    // 验证文档所有权
    const document = await prisma.pdfDocument.findUnique({
      where: { id: documentId }
    })

    if (!document) {
      return NextResponse.json(
        { error: '文档不存在' },
        { status: 404 }
      )
    }

    if (document.userId !== user!.id) {
      return NextResponse.json(
        { error: '无权创建该文档的对话' },
        { status: 403 }
      )
    }

    const conversation = await prisma.conversation.create({
      data: {
        documentId,
        title: title || '新对话'
      }
    })

    return NextResponse.json({ conversation })
  } catch (error) {
    console.error('创建对话失败:', error)
    return NextResponse.json(
      { error: '创建对话失败' },
      { status: 500 }
    )
  }
}

// 获取文档的所有对话
export async function GET(request: NextRequest) {
  // 验证用户登录
  const { error, user } = await requireAuth()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      return NextResponse.json(
        { error: '缺少 documentId' },
        { status: 400 }
      )
    }

    // 验证文档所有权
    const document = await prisma.pdfDocument.findUnique({
      where: { id: documentId }
    })

    if (!document) {
      return NextResponse.json(
        { error: '文档不存在' },
        { status: 404 }
      )
    }

    if (document.userId !== user!.id) {
      return NextResponse.json(
        { error: '无权访问该文档的对话' },
        { status: 403 }
      )
    }

    const conversations = await prisma.conversation.findMany({
      where: { documentId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('获取对话列表失败:', error)
    return NextResponse.json(
      { error: '获取对话列表失败' },
      { status: 500 }
    )
  }
}
