'use client'

import { useState } from 'react'
import type { Message } from '@prisma/client'
import MarkdownWithLatex from './MarkdownWithLatex'

interface MessageBubbleProps {
  message: Message
  onContinueFrom: (messageId: string) => void
  onDelete?: (messageId: string) => void
  pythonModeEnabled?: boolean
}

export default function MessageBubble({
  message,
  onContinueFrom,
  onDelete,
  pythonModeEnabled = false,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)

  // 解析 contextPayload
  let contextInfo = null
  if (message.contextPayload) {
    try {
      contextInfo = JSON.parse(message.contextPayload)
    } catch (e) {
      // 忽略解析错误
    }
  }

  // 复制消息内容
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  // 删除消息
  const handleDelete = () => {
    if (confirm('确定删除此消息？子节点将挂到父节点下。')) {
      onDelete?.(message.id)
    }
  }

  return (
    <div id={`message-${message.id}`} className="mb-4">
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`
            ${isUser ? 'max-w-[80%] bg-blue-600 text-white' : 'max-w-full bg-gray-200 text-black'}
            rounded-lg px-4 py-3 relative group
          `}
        >
          {/* 复制按钮 */}
          <button
            onClick={handleCopy}
            className={`
              absolute top-2 right-2 p-1.5 rounded
              ${isUser ? 'bg-blue-700 hover:bg-blue-800' : 'bg-gray-300 hover:bg-gray-400'}
              opacity-0 group-hover:opacity-100 transition-opacity
            `}
            title="复制内容"
          >
            {copied ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>

          {/* 角色标识 */}
          <div className="text-xs font-semibold mb-1 opacity-70">
            {isUser ? '你' : 'AI'}
          </div>

          {/* 消息内容 - 使用 LaTeX 渲染 */}
          <MarkdownWithLatex
            content={message.content}
            className="text-sm whitespace-pre-wrap break-words"
            pythonModeEnabled={pythonModeEnabled}
          />

          {/* 上下文信息（仅用户消息） */}
          {isUser && message.contextType && (
            <div className="mt-2 pt-2 border-t border-blue-500 text-xs opacity-75">
              📄 {message.contextType}
              {contextInfo && (
                <>
                  {contextInfo.pageNumber && ` - P${contextInfo.pageNumber}`}
                  {contextInfo.centerPage && ` - P${Math.max(1, contextInfo.centerPage - 1)}-${contextInfo.centerPage + 1}`}
                  {contextInfo.startPage && contextInfo.endPage && ` - P${contextInfo.startPage}-${contextInfo.endPage}`}
                </>
              )}
            </div>
          )}

          {/* AI 模型信息 */}
          {!isUser && message.model && (
            <div className="mt-2 text-xs opacity-60">
              🤖 {message.model}
            </div>
          )}

          {/* 时间戳 */}
          <div className="text-xs opacity-60 mt-2">
            {new Date(message.createdAt).toLocaleString('zh-CN', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
      </div>

      {/* 操作按钮（仅 assistant 消息） */}
      {!isUser && (
        <div className="flex justify-start gap-2 mt-2">
          <button
            onClick={() => onContinueFrom(message.id)}
            className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
          >
            从这里继续对话
          </button>
          {onDelete && (
            <button
              onClick={handleDelete}
              className="text-xs px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors"
            >
              删除
            </button>
          )}
        </div>
      )}

      {/* 用户消息的删除按钮 */}
      {isUser && onDelete && (
        <div className="flex justify-end mt-2">
          <button
            onClick={handleDelete}
            className="text-xs px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors"
          >
            删除
          </button>
        </div>
      )}
    </div>
  )
}
