import { prisma } from './prisma'
import type { Message } from '@prisma/client'

/**
 * 对话树管理
 *
 * 核心概念：
 * - 每条消息有 parentId，形成树形结构
 * - 用户可以从任意历史消息节点继续对话，创建新分支
 * - 原分支保留，支持多个对话分支并存
 */

export interface MessageNode extends Message {
  children?: MessageNode[]
}

/**
 * 获取对话的完整树形结构
 */
export async function getConversationTree(conversationId: string): Promise<MessageNode[]> {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' }
  })

  // 构建树形结构
  const messageMap = new Map<string, MessageNode>()
  const roots: MessageNode[] = []

  // 第一遍：创建所有节点
  messages.forEach(msg => {
    messageMap.set(msg.id, { ...msg, children: [] })
  })

  // 第二遍：建立父子关系
  messages.forEach(msg => {
    const node = messageMap.get(msg.id)!
    if (msg.parentId) {
      const parent = messageMap.get(msg.parentId)
      if (parent) {
        parent.children = parent.children || []
        parent.children.push(node)
      }
    } else {
      roots.push(node)
    }
  })

  return roots
}

/**
 * 获取从根节点到指定消息的路径
 * 用于显示当前分支路径
 */
export async function getMessagePath(messageId: string): Promise<Message[]> {
  const path: Message[] = []
  let currentId: string | null = messageId

  while (currentId) {
    const message: Message | null = await prisma.message.findUnique({
      where: { id: currentId }
    })

    if (!message) break

    path.unshift(message)
    currentId = message.parentId
  }

  return path
}

/**
 * 创建新消息
 * 如果 parentId 存在，说明是从某个历史节点继续，创建新分支
 */
export async function createMessage(
  conversationId: string,
  parentId: string | null,
  role: 'user' | 'assistant',
  content: string,
  contextType?: string,
  contextPayload?: any,
  contextTextSnapshot?: string,
  model?: string
): Promise<Message> {
  const message = await prisma.message.create({
    data: {
      conversationId,
      parentId,
      role,
      content,
      contextType,
      contextPayload: contextPayload ? JSON.stringify(contextPayload) : null,
      contextTextSnapshot,
      model
    }
  })

  return message
}

/**
 * 获取对话的所有叶子节点（最新的分支端点）
 */
export async function getLeafMessages(conversationId: string): Promise<Message[]> {
  const allMessages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' }
  })

  const childIds = new Set(
    allMessages.map(m => m.parentId).filter((id): id is string => id !== null)
  )

  // 没有被任何消息作为 parent 的消息，就是叶子节点
  return allMessages.filter(m => !childIds.has(m.id))
}

/**
 * 获取某个消息的所有兄弟节点（同一个 parent 的其他子节点）
 * 用于 UI 展示"还有其他分支"
 */
export async function getSiblingMessages(messageId: string): Promise<Message[]> {
  const message = await prisma.message.findUnique({
    where: { id: messageId }
  })

  if (!message || !message.parentId) {
    return []
  }

  const siblings = await prisma.message.findMany({
    where: {
      conversationId: message.conversationId,
      parentId: message.parentId,
      id: { not: messageId }
    },
    orderBy: { createdAt: 'asc' }
  })

  return siblings
}

/**
 * 获取消息的子节点数量
 * 用于判断是否有分支
 */
export async function getChildrenCount(messageId: string): Promise<number> {
  const count = await prisma.message.count({
    where: { parentId: messageId }
  })

  return count
}

/**
 * 删除消息及其所有子孙节点
 * 注意：这是危险操作，通常不应该提供给用户
 */
export async function deleteMessageBranch(messageId: string): Promise<void> {
  // Prisma 的 onDelete: Cascade 会自动删除所有子孙节点
  await prisma.message.delete({
    where: { id: messageId }
  })
}
