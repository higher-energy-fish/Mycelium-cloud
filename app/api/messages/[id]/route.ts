import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

// 允许的颜色值
const ALLOWED_COLORS = ['gray', 'blue', 'green', 'yellow', 'purple', 'red']

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
    const { displayName, color } = body

    // 验证 color 如果提供
    if (color !== undefined && color !== null && !ALLOWED_COLORS.includes(color)) {
      return NextResponse.json(
        { error: `颜色必须是以下之一: ${ALLOWED_COLORS.join(', ')}` },
        { status: 400 }
      )
    }

    // 检查消息是否存在并验证所有权
    const existingMessage = await prisma.message.findUnique({
      where: { id },
      include: {
        conversation: {
          include: { document: true }
        }
      }
    })

    if (!existingMessage) {
      return NextResponse.json(
        { error: '消息不存在' },
        { status: 404 }
      )
    }

    if (existingMessage.conversation.document.userId !== user!.id) {
      return NextResponse.json(
        { error: '无权修改该消息' },
        { status: 403 }
      )
    }

    // 更新消息
    const updatedMessage = await prisma.message.update({
      where: { id },
      data: {
        displayName: displayName === '' ? null : displayName,
        color: color === '' ? null : color
      }
    })

    return NextResponse.json({
      success: true,
      message: updatedMessage
    })
  } catch (error) {
    console.error('更新消息失败:', error)
    return NextResponse.json(
      { error: `更新消息失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    )
  }
}
