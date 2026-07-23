'use client'

import { useState, useEffect } from 'react'
import type { Message } from '@prisma/client'
import type { SortMode } from '@/lib/branchTree'
import type { ConversationTurnNode } from '@/lib/conversationTurns'
import type { PositionedTurnNode, LayoutResult } from '@/lib/branchLayout'
import { buildConversationTurnTree, getTurnDisplayLabel } from '@/lib/conversationTurns'
import { layoutTurnTree, buildSmoothEdgePath, getNodeColorClasses } from '@/lib/branchLayout'
import BranchToolbar from './BranchToolbar'
import BranchNodeMenu from './BranchNodeMenu'

interface BranchMapProps {
  conversationId: string
  activeMessageId: string | null
  onSelectMessage: (messageId: string) => void
  onContinueFrom: (messageId: string) => void
  refreshTrigger?: number
}

export default function BranchMap({
  conversationId,
  activeMessageId,
  onSelectMessage,
  onContinueFrom,
  refreshTrigger
}: BranchMapProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [sortMode, setSortMode] = useState<SortMode>('page')
  const [loading, setLoading] = useState(true)
  const [turnTree, setTurnTree] = useState<ConversationTurnNode[]>([])
  const [layout, setLayout] = useState<LayoutResult | null>(null)
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    node: PositionedTurnNode
    position: { x: number; y: number }
  } | null>(null)

  // 加载消息
  useEffect(() => {
    loadMessages()
  }, [conversationId, refreshTrigger])

  // 构建 Turn 树
  useEffect(() => {
    if (messages.length > 0) {
      const turns = buildConversationTurnTree(messages, sortMode)
      setTurnTree(turns)
    } else {
      setTurnTree([])
    }
  }, [messages, sortMode])

  // 计算布局
  useEffect(() => {
    if (turnTree.length > 0) {
      const layoutResult = layoutTurnTree(turnTree, activeTurnId)
      setLayout(layoutResult)
    } else {
      setLayout(null)
    }
  }, [turnTree, activeTurnId])

  // 当 activeMessageId 变化时，找到对应的 turnId
  useEffect(() => {
    if (activeMessageId && turnTree.length > 0) {
      const turn = findTurnByMessageId(turnTree, activeMessageId)
      if (turn) {
        setActiveTurnId(turn.id)
      }
    }
  }, [activeMessageId, turnTree])

  const loadMessages = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/messages?conversationId=${conversationId}&flat=true`
      )
      const data = await response.json()

      if (response.ok) {
        setMessages(data.messages || [])
      } else {
        console.error('加载消息失败:', data.error)
      }
    } catch (error) {
      console.error('加载消息失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateMeta = async (
    messageId: string,
    meta: { displayName?: string; color?: string }
  ) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(meta)
      })

      if (response.ok) {
        // 更新本地状态
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, ...meta }
              : msg
          )
        )
      } else {
        const data = await response.json()
        alert(`更新失败: ${data.error}`)
      }
    } catch (error) {
      console.error('更新消息元数据失败:', error)
      alert('更新失败')
    }
  }

  const handleTurnClick = (turn: PositionedTurnNode) => {
    setActiveTurnId(turn.id)
    // 通知父组件，使用 assistant message 的 id（如果存在）
    const messageId = turn.assistantMessage?.id || turn.userMessage.id
    onSelectMessage(messageId)
  }

  const handleContinueFromTurn = (turn: PositionedTurnNode) => {
    // 从该 turn 的 assistant message 继续（如果存在）
    const messageId = turn.assistantMessage?.id || turn.userMessage.id
    onContinueFrom(messageId)
  }

  const handleContextMenu = (turn: PositionedTurnNode, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      node: turn,
      position: { x: event.clientX, y: event.clientY }
    })
  }

  const handleRename = (messageId: string, displayName: string) => {
    handleUpdateMeta(messageId, { displayName })
  }

  const handleSetColor = (messageId: string, color: string) => {
    handleUpdateMeta(messageId, { color: color || undefined })
  }

  // 辅助函数：从 turnTree 中查找 turn
  const findTurnByMessageId = (
    turns: ConversationTurnNode[],
    messageId: string
  ): ConversationTurnNode | null => {
    for (const turn of turns) {
      if (turn.userMessage.id === messageId || turn.assistantMessage?.id === messageId) {
        return turn
      }
      const found = findTurnByMessageId(turn.children, messageId)
      if (found) return found
    }
    return null
  }

  // 计算总节点数
  const countNodes = (turns: ConversationTurnNode[]): number => {
    return turns.reduce((sum, turn) => {
      return sum + 1 + countNodes(turn.children)
    }, 0)
  }

  const totalNodes = countNodes(turnTree)

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-sm text-black">加载分支地图...</div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">还没有对话，开始提问吧</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 工具栏 */}
      <BranchToolbar
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        totalNodes={totalNodes}
      />

      {/* 分支地图画布 */}
      <div className="flex-1 overflow-auto relative">
        {layout && (
          <svg
            width={layout.width}
            height={layout.height}
            className="absolute top-0 left-0"
          >
            {/* 绘制连线 */}
            {layout.edges.map((edge, index) => (
              <path
                key={`edge-${index}`}
                d={buildSmoothEdgePath(edge)}
                stroke={edge.active ? '#3b82f6' : '#d1d5db'}
                strokeWidth={edge.active ? 2 : 1.5}
                fill="none"
                opacity={edge.active ? 1 : 0.5}
              />
            ))}

            {/* 绘制节点 */}
            {layout.nodes.map((node) => {
              const isActive = node.id === activeTurnId
              const isOnPath = layout.activePathIds.has(node.id)
              const label = getTurnDisplayLabel(node)
              const colorClasses = getNodeColorClasses(node.color, isActive)

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => handleTurnClick(node)}
                  onDoubleClick={() => handleContinueFromTurn(node)}
                  onContextMenu={(e) => handleContextMenu(node, e as any)}
                  className="cursor-pointer"
                  opacity={isOnPath || isActive ? 1 : 0.6}
                >
                  {/* 节点背景 */}
                  <rect
                    width={200}
                    height={60}
                    rx={8}
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth={2}
                    className={`${colorClasses.bg} ${colorClasses.border} transition-all`}
                  />

                  {/* 节点标题 */}
                  <foreignObject width={190} height={50} x={5} y={5}>
                    <div className="h-full flex flex-col justify-center px-2">
                      <div className={`text-xs font-medium truncate ${colorClasses.text}`}>
                        {label}
                      </div>
                      {!node.assistantMessage && (
                        <div className="text-xs text-gray-500 mt-1">等待回复...</div>
                      )}
                    </div>
                  </foreignObject>
                </g>
              )
            })}
          </svg>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <BranchNodeMenu
          nodeId={contextMenu.node.id}
          userMessageId={contextMenu.node.userMessage.id}
          currentDisplayName={contextMenu.node.displayName || ''}
          currentColor={contextMenu.node.color || ''}
          onRename={handleRename}
          onSetColor={handleSetColor}
          onClose={() => setContextMenu(null)}
          position={contextMenu.position}
        />
      )}
    </div>
  )
}
