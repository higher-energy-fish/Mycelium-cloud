import type { ConversationTurnNode } from './conversationTurns'

/**
 * 带位置信息的 Turn 节点
 */
export interface PositionedTurnNode extends ConversationTurnNode {
  x: number
  y: number
  depth: number
  branchIndex: number
}

/**
 * 连线信息
 */
export interface Edge {
  fromId: string
  toId: string
  fromX: number
  fromY: number
  toX: number
  toY: number
  active: boolean
}

/**
 * 布局结果
 */
export interface LayoutResult {
  nodes: PositionedTurnNode[]
  edges: Edge[]
  width: number
  height: number
  activePathIds: Set<string>
}

const NODE_WIDTH = 200
const NODE_HEIGHT = 60
const X_SPACING = 220
const Y_SPACING = 90

/**
 * 为 Turn 树计算布局
 */
export function layoutTurnTree(
  rootTurns: ConversationTurnNode[],
  activeTurnId: string | null
): LayoutResult {
  const nodes: PositionedTurnNode[] = []
  const edges: Edge[] = []
  const activePathIds = new Set<string>()

  // 计算 active path
  if (activeTurnId) {
    findActivePathIds(rootTurns, activeTurnId, activePathIds)
  }

  // 当前 Y 位置追踪器
  let currentY = 0

  // 布局每个根节点
  rootTurns.forEach((root, rootIndex) => {
    const { maxY } = layoutSubtree(
      root,
      0, // depth
      currentY, // startY
      null, // parent
      0, // branchIndex
      nodes,
      edges,
      activePathIds
    )

    // 下一个根节点从新的 Y 开始
    currentY = maxY + Y_SPACING
  })

  // 计算总宽度和高度
  const width = Math.max(...nodes.map(n => n.x + NODE_WIDTH), 600)
  const height = Math.max(...nodes.map(n => n.y + NODE_HEIGHT), 400)

  return {
    nodes,
    edges,
    width,
    height,
    activePathIds
  }
}

/**
 * 递归布局子树
 * 返回子树占用的最大 Y 坐标
 */
function layoutSubtree(
  turn: ConversationTurnNode,
  depth: number,
  startY: number,
  parent: PositionedTurnNode | null,
  branchIndex: number,
  nodes: PositionedTurnNode[],
  edges: Edge[],
  activePathIds: Set<string>
): { maxY: number } {
  // 计算当前节点位置
  const x = depth * X_SPACING
  const y = startY

  const positionedNode: PositionedTurnNode = {
    ...turn,
    x,
    y,
    depth,
    branchIndex
  }

  nodes.push(positionedNode)

  // 如果有父节点，创建连线
  if (parent) {
    edges.push({
      fromId: parent.id,
      toId: turn.id,
      fromX: parent.x + NODE_WIDTH,
      fromY: parent.y + NODE_HEIGHT / 2,
      toX: x,
      toY: y + NODE_HEIGHT / 2,
      active: activePathIds.has(parent.id) && activePathIds.has(turn.id)
    })
  }

  // 如果没有子节点，返回当前 Y
  if (turn.children.length === 0) {
    return { maxY: y }
  }

  // 如果只有一个子节点，保持在同一 Y
  if (turn.children.length === 1) {
    return layoutSubtree(
      turn.children[0],
      depth + 1,
      y, // 保持同一 Y
      positionedNode,
      0,
      nodes,
      edges,
      activePathIds
    )
  }

  // 多个子节点：第一个保持 Y，其余向下展开
  let maxYSoFar = y

  turn.children.forEach((child, index) => {
    const childStartY = index === 0 ? y : maxYSoFar + Y_SPACING

    const { maxY } = layoutSubtree(
      child,
      depth + 1,
      childStartY,
      positionedNode,
      index,
      nodes,
      edges,
      activePathIds
    )

    maxYSoFar = Math.max(maxYSoFar, maxY)
  })

  return { maxY: maxYSoFar }
}

/**
 * 找到活动路径上的所有节点 ID
 */
function findActivePathIds(
  rootTurns: ConversationTurnNode[],
  targetId: string,
  activeIds: Set<string>
): boolean {
  for (const root of rootTurns) {
    if (findPathAndMark(root, targetId, activeIds)) {
      return true
    }
  }
  return false
}

function findPathAndMark(
  turn: ConversationTurnNode,
  targetId: string,
  activeIds: Set<string>
): boolean {
  if (turn.id === targetId) {
    activeIds.add(turn.id)
    return true
  }

  for (const child of turn.children) {
    if (findPathAndMark(child, targetId, activeIds)) {
      activeIds.add(turn.id)
      return true
    }
  }

  return false
}

/**
 * 生成平滑 SVG 曲线路径
 */
export function buildSmoothEdgePath(edge: Edge): string {
  const { fromX, fromY, toX, toY } = edge

  // 计算控制点
  const midX = (fromX + toX) / 2

  // 使用 cubic bezier 曲线
  // M: 起点
  // C: 三次贝塞尔曲线（控制点1, 控制点2, 终点）
  return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`
}

/**
 * 获取节点颜色样式
 */
export function getNodeColorClasses(
  color: string | null,
  isActive: boolean
): {
  bg: string
  border: string
  text: string
} {
  const baseClasses = getColorClasses(color)

  if (isActive) {
    // 高亮时增加背景饱和度
    const activeBg = baseClasses.bg.replace('-50', '-100').replace('-100', '-200')
    return {
      bg: activeBg,
      border: baseClasses.border,
      text: baseClasses.text
    }
  }

  return baseClasses
}

function getColorClasses(color: string | null): {
  bg: string
  border: string
  text: string
} {
  switch (color) {
    case 'blue':
      return {
        bg: 'bg-blue-50',        // 低饱和度背景
        border: 'border-blue-600',  // 彩边
        text: 'text-blue-700'       // 同色系文字
      }
    case 'green':
      return {
        bg: 'bg-green-50',
        border: 'border-green-600',
        text: 'text-green-700'
      }
    case 'yellow':
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-600',
        text: 'text-yellow-700'
      }
    case 'purple':
      return {
        bg: 'bg-purple-50',
        border: 'border-purple-600',
        text: 'text-purple-700'
      }
    case 'red':
      return {
        bg: 'bg-red-50',
        border: 'border-red-600',
        text: 'text-red-700'
      }
    case 'orange':
      return {
        bg: 'bg-orange-50',
        border: 'border-orange-600',
        text: 'text-orange-700'
      }
    case 'cyan':
      return {
        bg: 'bg-cyan-50',
        border: 'border-cyan-600',
        text: 'text-cyan-700'
      }
    case 'pink':
      return {
        bg: 'bg-pink-50',
        border: 'border-pink-600',
        text: 'text-pink-700'
      }
    default:
      // 默认蓝白配色
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-500',
        text: 'text-blue-700'
      }
  }
}
