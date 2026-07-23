'use client'

import { useEffect, useState, useRef } from 'react'
import MessageBubble from './MessageBubble'
import type { Message } from '@prisma/client'
import { buildConversationTurnTree, getMessagesForActiveTurnPath, findTurnByMessageId } from '@/lib/conversationTurns'

interface MessageTreeProps {
  conversationId: string
  activeMessageId: string | null
  onContinueFrom: (messageId: string) => void
  refreshTrigger?: number
}

export default function MessageTree({
  conversationId,
  activeMessageId,
  onContinueFrom,
  refreshTrigger
}: MessageTreeProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    loadMessages()
  }, [conversationId, refreshTrigger, activeMessageId])

  // 滚动到激活的消息
  useEffect(() => {
    if (activeMessageId && messageRefs.current.has(activeMessageId)) {
      const element = messageRefs.current.get(activeMessageId)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // 添加高亮效果
        element.classList.add('highlight-flash')
        setTimeout(() => {
          element.classList.remove('highlight-flash')
        }, 1500)
      }
    }
  }, [activeMessageId, messages])

  const loadMessages = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/messages?conversationId=${conversationId}&flat=true`
      )
      const data = await response.json()

      if (response.ok) {
        const allMessages = data.messages || []

        if (allMessages.length > 0) {
          // 构建 turn 树
          const turnTree = buildConversationTurnTree(allMessages, 'time')

          // 找到 activeTurnId
          let activeTurnId: string | null = null
          if (activeMessageId) {
            const turn = findTurnByMessageId(turnTree, activeMessageId)
            if (turn) {
              activeTurnId = turn.id
            }
          }

          // 获取当前路径的线性消息列表
          const pathMessages = getMessagesForActiveTurnPath(turnTree, activeTurnId)
          setMessages(pathMessages)
        } else {
          setMessages([])
        }
      } else {
        console.error('加载消息失败:', data.error)
        setMessages([])
      }
    } catch (error) {
      console.error('加载消息失败:', error)
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  const setMessageRef = (messageId: string) => {
    return (element: HTMLDivElement | null) => {
      if (element) {
        messageRefs.current.set(messageId, element)
      } else {
        messageRefs.current.delete(messageId)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-black">
        加载中...
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-black">
        还没有消息，开始对话吧
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 线性显示当前路径的所有消息 */}
      {messages.map((message) => (
        <div key={message.id} ref={setMessageRef(message.id)}>
          <MessageBubble
            message={message}
            onContinueFrom={onContinueFrom}
          />
        </div>
      ))}
    </div>
  )
}
