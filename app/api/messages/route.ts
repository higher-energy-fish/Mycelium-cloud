import { NextRequest, NextResponse } from 'next/server'
import { getConversationTree, getMessagePath } from '@/lib/conversationTree'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

// 获取对话的所有消息（树形结构）
export async function GET(request: NextRequest) {
  // 验证用户登录
  const { error, user } = await requireAuth()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')
    const messageId = searchParams.get('messageId')
    const flat = searchParams.get('flat') === 'true'

    if (conversationId) {
      // 验证对话所有权
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
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
          { error: '无权访问该对话的消息' },
          { status: 403 }
        )
      }

      if (flat) {
        // 返回扁平的消息列表（用于 BranchMap）
        const messages = await prisma.message.findMany({
          where: { conversationId },
          orderBy: { createdAt: 'asc' }
        })
        return NextResponse.json({ messages })
      } else {
        // 获取整个对话树
        const tree = await getConversationTree(conversationId)
        return NextResponse.json({ tree })
      }
    } else if (messageId) {
      // 验证消息所有权
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: {
          conversation: {
            include: { document: true }
          }
        }
      })

      if (!message) {
        return NextResponse.json(
          { error: '消息不存在' },
          { status: 404 }
        )
      }

      if (message.conversation.document.userId !== user!.id) {
        return NextResponse.json(
          { error: '无权访问该消息' },
          { status: 403 }
        )
      }

      // 获取特定消息的路径
      const path = await getMessagePath(messageId)
      return NextResponse.json({ path })
    } else {
      return NextResponse.json(
        { error: '需要提供 conversationId 或 messageId' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('获取消息失败:', error)
    return NextResponse.json(
      { error: '获取消息失败' },
      { status: 500 }
    )
  }
}
