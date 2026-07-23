import type { Message } from '@prisma/client'
import { extractPageFromPayload, type SortMode } from './branchTree'

/**
 * 问答回合节点
 * 一个 Turn = 一个 user message + 对应的 assistant message
 */
export interface ConversationTurnNode {
  id: string // turn 的唯一 ID，使用 userMessage.id
  userMessage: Message
  assistantMessage: Message | null
  parentTurnId: string | null
  children: ConversationTurnNode[]

  createdAt: string
  pageInfo: {
    label: string
    startPage?: number
    endPage?: number
  }

  displayName: string | null
  color: string | null

  // 用于 AI 总结标题功能
  summaryStatus?: 'idle' | 'loading' | 'error' | 'done'
}

/**
 * 从 messages 构建 Turn 树
 */
export function buildConversationTurnTree(
  messages: Message[],
  sortMode: SortMode = 'time'
): ConversationTurnNode[] {
  if (messages.length === 0) return []

  // 1. 按 role 分组
  const userMessages = messages.filter(m => m.role === 'user')
  const assistantMessages = messages.filter(m => m.role === 'assistant')

  // 2. 为每个 user message 找到对应的 assistant message
  const turnMap = new Map<string, ConversationTurnNode>()

  userMessages.forEach(userMsg => {
    // 找到以此 user message 为 parent 的 assistant message
    const assistantMsg = assistantMessages.find(a => a.parentId === userMsg.id)

    const turn: ConversationTurnNode = {
      id: userMsg.id,
      userMessage: userMsg,
      assistantMessage: assistantMsg || null,
      parentTurnId: null, // 稍后计算
      children: [],
      createdAt: userMsg.createdAt.toString(),
      pageInfo: extractTurnPageInfo(userMsg),
      displayName: userMsg.displayName,
      color: userMsg.color,
      summaryStatus: 'idle'
    }

    turnMap.set(userMsg.id, turn)
  })

  // 3. 建立 turn 之间的父子关系
  turnMap.forEach(turn => {
    const userMsg = turn.userMessage

    if (userMsg.parentId) {
      // user message 的 parentId 指向上一轮的 assistant message
      // 需要找到包含该 assistant message 的 turn
      const parentAssistantMsg = assistantMessages.find(a => a.id === userMsg.parentId)

      if (parentAssistantMsg) {
        // 找到该 assistant 对应的 user message（即 parent turn）
        const parentUserMsg = userMessages.find(u => u.id === parentAssistantMsg.parentId)

        if (parentUserMsg) {
          const parentTurn = turnMap.get(parentUserMsg.id)
          if (parentTurn) {
            turn.parentTurnId = parentTurn.id
            parentTurn.children.push(turn)
          }
        }
      } else {
        // 如果 parentId 指向 user message（兼容某些边缘情况）
        const parentUserMsg = userMessages.find(u => u.id === userMsg.parentId)
        if (parentUserMsg) {
          const parentTurn = turnMap.get(parentUserMsg.id)
          if (parentTurn) {
            turn.parentTurnId = parentTurn.id
            parentTurn.children.push(turn)
          }
        }
      }
    }
  })

  // 4. 找到根节点（没有 parent 的 turn）
  const rootTurns = Array.from(turnMap.values()).filter(t => !t.parentTurnId)

  // 5. 排序
  if (sortMode === 'page') {
    sortTurnsByPage(rootTurns)
  } else {
    sortTurnsByTime(rootTurns)
  }

  return rootTurns
}

/**
 * 提取 turn 的页码信息
 */
export function extractTurnPageInfo(userMessage: Message): {
  label: string
  startPage?: number
  endPage?: number
} {
  const contextType = userMessage.contextType
  const contextPayload = userMessage.contextPayload

  if (!contextType || !contextPayload) {
    return { label: 'No page' }
  }

  try {
    const payload = JSON.parse(contextPayload)

    switch (contextType) {
      case 'current_page':
        return {
          label: `P${payload.pageNumber}`,
          startPage: payload.pageNumber
        }

      case 'surrounding_pages':
        const start = payload.centerPage - (payload.range || 1)
        const end = payload.centerPage + (payload.range || 1)
        return {
          label: `P${start}-${end}`,
          startPage: start,
          endPage: end
        }

      case 'page_range':
        return {
          label: `P${payload.startPage}-${payload.endPage}`,
          startPage: payload.startPage,
          endPage: payload.endPage
        }

      case 'selected_text':
        return {
          label: `Selected P${payload.sourcePage || payload.pageNumber}`,
          startPage: payload.sourcePage || payload.pageNumber
        }

      default:
        return { label: 'No page' }
    }
  } catch (e) {
    return { label: 'No page' }
  }
}

/**
 * 生成 turn 的显示标签
 */
export function getTurnDisplayLabel(turn: ConversationTurnNode): string {
  // 1. 优先使用 displayName
  if (turn.displayName) {
    return turn.displayName
  }

  // 2. 生成默认标题：页码 + 摘要
  const pageLabel = turn.pageInfo.label
  const summary = generateSummaryFromContent(turn.userMessage.content)

  return `${pageLabel} ${summary}`
}

/**
 * 从内容生成摘要
 */
function generateSummaryFromContent(content: string): string {
  // 清理内容
  const cleaned = content
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // 检测是否中文为主
  const chineseChars = cleaned.match(/[一-龥]/g)
  const isChinese = chineseChars && chineseChars.length > cleaned.length * 0.3

  if (isChinese) {
    // 中文：截取 8-20 字
    return cleaned.slice(0, 20)
  } else {
    // 英文：截取 4-8 个词
    const words = cleaned.split(/\s+/).slice(0, 8)
    return words.join(' ')
  }
}

/**
 * 查找从根节点到指定 turn 的路径
 */
export function findPathToTurn(
  rootTurns: ConversationTurnNode[],
  targetTurnId: string
): ConversationTurnNode[] {
  const path: ConversationTurnNode[] = []

  function dfs(turns: ConversationTurnNode[]): boolean {
    for (const turn of turns) {
      path.push(turn)

      if (turn.id === targetTurnId) {
        return true
      }

      if (dfs(turn.children)) {
        return true
      }

      path.pop()
    }
    return false
  }

  dfs(rootTurns)
  return path
}

/**
 * 通过 messageId 找到对应的 turn
 */
export function findTurnByMessageId(
  rootTurns: ConversationTurnNode[],
  messageId: string
): ConversationTurnNode | null {
  function dfs(turns: ConversationTurnNode[]): ConversationTurnNode | null {
    for (const turn of turns) {
      // 检查 user message 或 assistant message
      if (turn.userMessage.id === messageId || turn.assistantMessage?.id === messageId) {
        return turn
      }

      const result = dfs(turn.children)
      if (result) return result
    }
    return null
  }

  return dfs(rootTurns)
}

/**
 * 获取当前路径的线性消息列表
 */
export function getMessagesForActiveTurnPath(
  rootTurns: ConversationTurnNode[],
  activeTurnId: string | null
): Message[] {
  if (!activeTurnId) {
    // 如果没有选中，返回最新路径
    const latestPath = findLatestPath(rootTurns)
    return turnPathToMessages(latestPath)
  }

  const path = findPathToTurn(rootTurns, activeTurnId)
  return turnPathToMessages(path)
}

/**
 * 将 turn 路径转换为线性消息列表
 */
function turnPathToMessages(turnPath: ConversationTurnNode[]): Message[] {
  const messages: Message[] = []

  turnPath.forEach(turn => {
    messages.push(turn.userMessage)
    if (turn.assistantMessage) {
      messages.push(turn.assistantMessage)
    }
  })

  return messages
}

/**
 * 找到最新的路径（最后创建的叶子节点）
 */
function findLatestPath(rootTurns: ConversationTurnNode[]): ConversationTurnNode[] {
  if (rootTurns.length === 0) return []

  let latestLeaf: ConversationTurnNode | null = null
  let latestTime = new Date(0).getTime()

  function findLeaf(turn: ConversationTurnNode): void {
    if (turn.children.length === 0) {
      // 这是叶子节点
      const turnTime = new Date(turn.createdAt).getTime()
      if (turnTime > latestTime) {
        latestTime = turnTime
        latestLeaf = turn
      }
    } else {
      turn.children.forEach(child => findLeaf(child))
    }
  }

  rootTurns.forEach(root => findLeaf(root))

  // 如果没有找到叶子节点，返回第一个根节点的路径
  const targetLeaf = latestLeaf || rootTurns[0]
  if (!targetLeaf) return []

  // 回溯找到完整路径
  return findPathToTurn(rootTurns, targetLeaf.id)
}

/**
 * 按页码排序（递归）
 */
function sortTurnsByPage(turns: ConversationTurnNode[]) {
  turns.sort((a, b) => {
    const pageA = a.pageInfo.startPage || 0
    const pageB = b.pageInfo.startPage || 0
    if (pageA !== pageB) return pageA - pageB
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  turns.forEach(turn => {
    if (turn.children.length > 0) {
      sortTurnsByPage(turn.children)
    }
  })
}

/**
 * 按时间排序（递归）
 */
function sortTurnsByTime(turns: ConversationTurnNode[]) {
  turns.sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  turns.forEach(turn => {
    if (turn.children.length > 0) {
      sortTurnsByTime(turn.children)
    }
  })
}
