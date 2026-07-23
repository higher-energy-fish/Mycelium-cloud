import type { Message } from '@prisma/client'

/**
 * 获取从根节点到当前节点的完整对话路径
 * @param allMessages 所有消息（flat list）
 * @param currentMessageId 当前激活的消息ID
 * @param maxMessages 最多保留多少条历史消息（默认20）
 * @returns 按时间顺序排列的消息数组（root -> current）
 */
export function getBranchMessages(
  allMessages: Message[],
  currentMessageId: string | null,
  maxMessages: number = 20
): Message[] {
  if (!currentMessageId || allMessages.length === 0) {
    return []
  }

  // 构建消息映射
  const messageMap = new Map<string, Message>()
  allMessages.forEach(msg => {
    messageMap.set(msg.id, msg)
  })

  // 从当前节点回溯到根
  const path: Message[] = []
  let currentId: string | null = currentMessageId

  while (currentId) {
    const message = messageMap.get(currentId)
    if (!message) break

    path.unshift(message) // 添加到开头，保持从根到当前的顺序
    currentId = message.parentId
  }

  // 如果历史太长，只保留最近的 N 条消息
  if (path.length > maxMessages) {
    console.log(`历史消息过长 (${path.length} 条)，截断为最近 ${maxMessages} 条`)
    return path.slice(-maxMessages)
  }

  return path
}

/**
 * 将消息数组转换为 AI API 兼容的格式
 * @param messages 消息数组
 * @returns AI API 消息格式
 */
export function messagesToAIFormat(messages: Message[]): Array<{
  role: 'user' | 'assistant' | 'system'
  content: string
}> {
  return messages.map(msg => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content
  }))
}

/**
 * 估算消息的 token 数量（粗略估算：1 token ≈ 4 字符）
 * @param messages 消息数组
 * @returns 估算的 token 数量
 */
export function estimateTokens(messages: Array<{ role: string; content: string }>): number {
  const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0)
  return Math.ceil(totalChars / 4)
}

/**
 * 根据 token 预算截断消息历史
 * @param messages 消息数组
 * @param maxTokens 最大 token 数（默认 8000，为 16k 模型留一半空间）
 * @returns 截断后的消息数组
 */
export function truncateMessagesByTokens(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number = 8000
): Array<{ role: string; content: string }> {
  const tokens = estimateTokens(messages)

  if (tokens <= maxTokens) {
    return messages
  }

  console.log(`消息总 token 数 (${tokens}) 超过预算 (${maxTokens})，开始截断...`)

  // 从最新的消息开始保留
  const result: Array<{ role: string; content: string }> = []
  let currentTokens = 0

  // 倒序遍历（从最新到最旧）
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    const msgTokens = Math.ceil(msg.content.length / 4)

    if (currentTokens + msgTokens > maxTokens) {
      // 如果加上这条消息会超预算，停止
      console.log(`截断到最近 ${result.length} 条消息，约 ${currentTokens} tokens`)
      break
    }

    result.unshift(msg)
    currentTokens += msgTokens
  }

  return result
}
