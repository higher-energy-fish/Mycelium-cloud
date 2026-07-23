import type { Message } from '@prisma/client'

export type SortMode = 'page' | 'time'

export interface BranchTreeNode {
  id: string
  message: Message
  children: BranchTreeNode[]
  rootPage?: number
  createdAt: string
}

/**
 * 从 contextPayload 提取页码信息
 */
export function extractPageFromPayload(
  contextType: string | null,
  contextPayload: string | null
): number | null {
  if (!contextPayload || !contextType) return null

  try {
    const payload = JSON.parse(contextPayload)

    switch (contextType) {
      case 'current_page':
        return payload.pageNumber || null
      case 'surrounding_pages':
        return payload.centerPage || null
      case 'page_range':
        return payload.startPage || null
      case 'selected_text':
        return payload.sourcePage || payload.pageNumber || null
      default:
        return null
    }
  } catch (e) {
    return null
  }
}

/**
 * 生成页码前缀
 */
function getPagePrefix(
  contextType: string | null,
  contextPayload: string | null
): string {
  if (!contextPayload || !contextType) return 'No page'

  try {
    const payload = JSON.parse(contextPayload)

    switch (contextType) {
      case 'current_page':
        return payload.pageNumber ? `P${payload.pageNumber}` : 'No page'
      case 'surrounding_pages': {
        const center = payload.centerPage
        const range = payload.range || 1
        if (center) {
          const start = Math.max(1, center - range)
          const end = center + range
          return `P${start}-${end}`
        }
        return 'No page'
      }
      case 'page_range':
        if (payload.startPage && payload.endPage) {
          return `P${payload.startPage}-${payload.endPage}`
        }
        return 'No page'
      case 'selected_text':
        return payload.sourcePage || payload.pageNumber
          ? `Selected P${payload.sourcePage || payload.pageNumber}`
          : 'Selected'
      default:
        return 'No page'
    }
  } catch (e) {
    return 'No page'
  }
}

/**
 * 生成内容摘要
 */
function getContentSummary(content: string): string {
  // 去除换行和多余空格
  const cleaned = content.replace(/\s+/g, ' ').trim()

  // 检测是否主要是中文
  const chineseChars = cleaned.match(/[一-龥]/g)
  const isChinese = chineseChars && chineseChars.length > cleaned.length * 0.3

  if (isChinese) {
    // 中文：截取 12-20 字
    return cleaned.substring(0, 20)
  } else {
    // 英文：截取 4-8 个词
    const words = cleaned.split(/\s+/).slice(0, 8)
    return words.join(' ')
  }
}

/**
 * 获取消息的显示标签
 */
export function getMessageDisplayLabel(message: Message): string {
  // 如果有自定义名称，直接返回
  if (message.displayName) {
    return message.displayName
  }

  // 生成自动名称
  const pagePrefix = getPagePrefix(message.contextType, message.contextPayload)
  const summary = getContentSummary(message.content)

  return `${pagePrefix} ${summary}`
}

/**
 * 排序分支节点
 */
export function sortBranchNodes(
  nodes: BranchTreeNode[],
  sortMode: SortMode
): BranchTreeNode[] {
  return nodes.sort((a, b) => {
    if (sortMode === 'page') {
      // 先按页码排序
      const pageA = a.rootPage ?? Infinity
      const pageB = b.rootPage ?? Infinity

      if (pageA !== pageB) {
        return pageA - pageB
      }

      // 页码相同，按时间排序
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    } else {
      // time 模式：先按时间排序
      const timeA = new Date(a.createdAt).getTime()
      const timeB = new Date(b.createdAt).getTime()

      if (timeA !== timeB) {
        return timeA - timeB
      }

      // 时间相同，按页码排序
      const pageA = a.rootPage ?? Infinity
      const pageB = b.rootPage ?? Infinity
      return pageA - pageB
    }
  })
}

/**
 * 构建分支树
 */
export function buildBranchTree(
  messages: Message[],
  sortMode: SortMode = 'page'
): BranchTreeNode[] {
  // 创建消息映射
  const messageMap = new Map<string, BranchTreeNode>()

  // 第一遍：创建所有节点
  messages.forEach((msg) => {
    messageMap.set(msg.id, {
      id: msg.id,
      message: msg,
      children: [],
      rootPage: extractPageFromPayload(msg.contextType, msg.contextPayload) ?? undefined,
      createdAt: msg.createdAt.toString()
    })
  })

  // 第二遍：建立父子关系
  const roots: BranchTreeNode[] = []
  messages.forEach((msg) => {
    const node = messageMap.get(msg.id)!

    if (msg.parentId) {
      const parent = messageMap.get(msg.parentId)
      if (parent) {
        parent.children.push(node)
      }
    } else {
      roots.push(node)
    }
  })

  // 递归排序所有层级
  function sortChildren(node: BranchTreeNode) {
    if (node.children.length > 0) {
      node.children = sortBranchNodes(node.children, sortMode)
      node.children.forEach(sortChildren)
    }
  }

  // 排序根节点
  const sortedRoots = sortBranchNodes(roots, sortMode)

  // 排序所有子节点
  sortedRoots.forEach(sortChildren)

  return sortedRoots
}

/**
 * 颜色映射到 Tailwind 类
 */
export function getColorClasses(color: string | null): {
  bg: string
  border: string
  text: string
} {
  switch (color) {
    case 'blue':
      return {
        bg: 'bg-blue-100',
        border: 'border-blue-400',
        text: 'text-blue-900'
      }
    case 'green':
      return {
        bg: 'bg-green-100',
        border: 'border-green-400',
        text: 'text-green-900'
      }
    case 'yellow':
      return {
        bg: 'bg-yellow-100',
        border: 'border-yellow-400',
        text: 'text-yellow-900'
      }
    case 'purple':
      return {
        bg: 'bg-purple-100',
        border: 'border-purple-400',
        text: 'text-purple-900'
      }
    case 'red':
      return {
        bg: 'bg-red-100',
        border: 'border-red-400',
        text: 'text-red-900'
      }
    default:
      return {
        bg: 'bg-gray-100',
        border: 'border-gray-300',
        text: 'text-gray-900'
      }
  }
}
