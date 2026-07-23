'use client'

import { useState, useEffect } from 'react'
import type { Message } from '@prisma/client'
import { buildConversationTurnTree, type ConversationTurnNode } from '@/lib/conversationTurns'

interface BranchMapFullscreenProps {
  conversationId: string
  activeMessageId: string | null
  onSelectMessage: (messageId: string) => void
  onContinueFrom: (messageId: string) => void
  onSwitchToChatView: () => void
  refreshTrigger?: number
}

export default function BranchMapFullscreen({
  conversationId,
  activeMessageId,
  onSelectMessage,
  onContinueFrom,
  onSwitchToChatView,
  refreshTrigger
}: BranchMapFullscreenProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [turnTree, setTurnTree] = useState<ConversationTurnNode[]>([])

  // 加载消息
  useEffect(() => {
    loadMessages()
  }, [conversationId, refreshTrigger])

  // 重新构建树
  useEffect(() => {
    if (messages.length > 0) {
      const newTree = buildConversationTurnTree(messages, 'time')
      setTurnTree(newTree)
    }
  }, [messages])

  const loadMessages = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/messages?conversationId=${conversationId}&flat=true`)
      const data = await response.json()

      if (response.ok && data.messages) {
        setMessages(data.messages)
      }
    } catch (error) {
      console.error('加载消息失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNodeClick = (messageId: string) => {
    onSelectMessage(messageId)
    onSwitchToChatView()
  }

  // 计算总节点数
  const countNodes = (nodes: ConversationTurnNode[]): number => {
    return nodes.reduce((sum, node) => {
      return sum + 1 + countNodes(node.children)
    }, 0)
  }

  const totalNodes = countNodes(turnTree)

  // 渲染 Turn 节点
  const renderTurnNode = (turn: ConversationTurnNode, depth: number = 0) => {
    const isActive = turn.userMessage.id === activeMessageId || turn.assistantMessage?.id === activeMessageId

    return (
      <div key={turn.id} className="flex flex-col gap-4">
        {/* Turn 节点框 */}
        <div
          className={`
            border-2 rounded-lg p-4 bg-white shadow-sm
            ${isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
            hover:shadow-md transition-shadow cursor-pointer
          `}
          onClick={() => handleNodeClick(turn.assistantMessage?.id || turn.userMessage.id)}
        >
          {/* User 消息 */}
          <div className="mb-3">
            <div className="text-xs font-semibold text-blue-600 mb-1">用户</div>
            <div className="text-sm text-gray-900 line-clamp-3">
              {turn.userMessage.content}
            </div>
          </div>

          {/* Assistant 消息 */}
          {turn.assistantMessage && (
            <div className="pt-3 border-t border-gray-200">
              <div className="text-xs font-semibold text-green-600 mb-1">AI</div>
              <div className="text-sm text-gray-900 line-clamp-3">
                {turn.assistantMessage.content}
              </div>
            </div>
          )}

          {/* 元数据 */}
          <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
            <div>
              {turn.userMessage.contextType && (
                <span className="mr-3">📄 {turn.userMessage.contextType}</span>
              )}
              {turn.assistantMessage?.model && (
                <span>🤖 {turn.assistantMessage.model}</span>
              )}
            </div>
            <div>
              {new Date(turn.userMessage.createdAt).toLocaleString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        </div>

        {/* 子节点 */}
        {turn.children.length > 0 && (
          <div className="ml-8 pl-4 border-l-2 border-gray-300 space-y-4">
            {turn.children.map(child => renderTurnNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-white">
        <div className="border-b px-4 py-3 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">分支地图（全屏）</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-gray-600">
          加载中...
        </div>
      </div>
    )
  }

  if (turnTree.length === 0) {
    return (
      <div className="h-screen flex flex-col bg-white">
        <div className="border-b px-4 py-3 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">分支地图（全屏）</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-gray-600">
          还没有消息分支
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* 顶部工具栏 */}
      <div className="border-b px-4 py-3 bg-white flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">分支地图（全屏）</h2>
        <div className="text-sm text-gray-600">
          总计 {totalNodes} 个对话轮次
        </div>
      </div>

      <div className="text-xs text-gray-700 px-4 py-2 bg-blue-50 border-b">
        💡 点击节点可以跳转到对话视图并查看该轮次的完整对话
      </div>

      {/* 分支树容器 - 纵向排列 */}
      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        <div className="space-y-4 max-w-4xl mx-auto">
          {turnTree.map(turn => renderTurnNode(turn, 0))}
        </div>
      </div>
    </div>
  )
}
