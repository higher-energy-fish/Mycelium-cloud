import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

// PATCH - 更新对话（重命名）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 验证用户登录
  const { error, user } = await requireAuth()
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()
    const { title } = body

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { error: '标题不能为空' },
        { status: 400 }
      )
    }

    // 验证对话所有权
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { document: true }
    })

    if (!conversation) {
      return NextResponse.json(
        { error: '对话不存在' },
        { status: 404 }
      )
    }

    if (conversation.document.userId !== user!.id) {
      return NextResponse.json(
        { error: '无权修改该对话' },
        { status: 403 }
      )
    }

    // 更新对话标题
    const updatedConversation = await prisma.conversation.update({
      where: { id },
      data: {
        title: title.trim(),
        updatedAt: new Date()
      }
    })

    return NextResponse.json({ conversation: updatedConversation })
  } catch (error) {
    console.error('更新对话失败:', error)
    return NextResponse.json(
      { error: '更新对话失败' },
      { status: 500 }
    )
  }
}

// DELETE - 删除对话
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 验证用户登录
  const { error, user } = await requireAuth()
  if (error) return error

  try {
    const { id } = await params

    // 检查对话是否存在并验证所有权
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        document: true,
        _count: {
          select: { messages: true }
        }
      }
    })

    if (!conversation) {
      return NextResponse.json(
        { error: '对话不存在' },
        { status: 404 }
      )
    }

    if (conversation.document.userId !== user!.id) {
      return NextResponse.json(
        { error: '无权删除该对话' },
        { status: 403 }
      )
    }

    // 删除对话（级联删除所有消息）
    await prisma.conversation.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: `已删除对话"${conversation.title}"及其 ${conversation._count.messages} 条消息`
    })
  } catch (error) {
    console.error('删除对话失败:', error)
    return NextResponse.json(
      { error: '删除对话失败' },
      { status: 500 }
    )
  }
}
