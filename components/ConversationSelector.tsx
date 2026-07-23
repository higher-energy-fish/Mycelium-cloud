'use client'

import { useState, useEffect, useRef } from 'react'

interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

interface ConversationSelectorProps {
  documentId: string
  currentConversationId: string | null
  onConversationChange: (conversationId: string) => void
}

export default function ConversationSelector({
  documentId,
  currentConversationId,
  onConversationChange
}: ConversationSelectorProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConversations()
  }, [documentId])

  // 点击外部关闭设置菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false)
      }
    }

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSettings])

  const loadConversations = async () => {
    try {
      const response = await fetch(`/api/conversations?documentId=${documentId}`)
      const data = await response.json()

      if (response.ok && data.conversations) {
        setConversations(data.conversations)
      }
    } catch (error) {
      console.error('加载对话列表失败:', error)
    }
  }

  const handleCreateNew = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentId,
          title: `对话 ${conversations.length + 1}`
        })
      })

      const data = await response.json()

      if (response.ok) {
        const newConv = data.conversation
        setConversations([newConv, ...conversations])
        onConversationChange(newConv.id)
        setIsOpen(false)
      } else {
        alert('创建对话失败: ' + data.error)
      }
    } catch (error) {
      console.error('创建对话失败:', error)
      alert('创建对话失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRename = async (convId: string, newTitle: string) => {
    if (!newTitle.trim()) {
      alert('标题不能为空')
      return
    }

    try {
      const response = await fetch(`/api/conversations/${convId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: newTitle.trim() })
      })

      if (response.ok) {
        setConversations(conversations.map(c =>
          c.id === convId ? { ...c, title: newTitle.trim() } : c
        ))
        setEditingId(null)
        setMenuOpenId(null)
      } else {
        const data = await response.json()
        alert('重命名失败: ' + data.error)
      }
    } catch (error) {
      console.error('重命名失败:', error)
      alert('重命名失败')
    }
  }

  const handleDelete = async (convId: string, title: string) => {
    if (!confirm(`确定要删除对话"${title}"吗？此操作不可恢复，将删除所有相关消息。`)) {
      return
    }

    try {
      const response = await fetch(`/api/conversations/${convId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const remainingConvs = conversations.filter(c => c.id !== convId)
        setConversations(remainingConvs)
        setMenuOpenId(null)

        // 如果删除的是当前对话，切换到第一个对话
        if (convId === currentConversationId && remainingConvs.length > 0) {
          onConversationChange(remainingConvs[0].id)
        }
      } else {
        const data = await response.json()
        alert('删除失败: ' + data.error)
      }
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败')
    }
  }

  const startEditing = (convId: string, currentTitle: string) => {
    setEditingId(convId)
    setEditingTitle(currentTitle)
    setMenuOpenId(null)
  }

  const currentConv = conversations.find(c => c.id === currentConversationId)

  return (
    <div className="relative flex items-center gap-2">
      {/* 设置图标按钮 */}
      <div className="relative z-[60]" ref={settingsRef}>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 hover:bg-gray-100 rounded transition-colors"
          title="对话设置"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* 设置下拉菜单 */}
        {showSettings && currentConv && (
          <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-xl z-[70] w-[90px]">
            <button
              onClick={() => {
                startEditing(currentConv.id, currentConv.title)
                setShowSettings(false)
              }}
              className="w-full px-2 py-1.5 text-left text-xs hover:bg-gray-100 flex items-center gap-1 rounded-t-lg"
            >
              <span>✏️</span>
              <span>改名</span>
            </button>
            <button
              onClick={() => {
                handleDelete(currentConv.id, currentConv.title)
                setShowSettings(false)
              }}
              className="w-full px-2 py-1.5 text-left text-xs hover:bg-red-50 text-red-600 flex items-center gap-1 border-t rounded-b-lg"
            >
              <span>🗑️</span>
              <span>删除</span>
            </button>
          </div>
        )}
      </div>

      {/* 对话选择器 */}
      <div className="relative flex-1 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm font-medium text-black">💬</span>
            {editingId === currentConversationId ? (
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRename(currentConversationId!, editingTitle)
                  } else if (e.key === 'Escape') {
                    setEditingId(null)
                  }
                }}
                onBlur={() => {
                  if (editingTitle.trim()) {
                    handleRename(currentConversationId!, editingTitle)
                  } else {
                    setEditingId(null)
                  }
                }}
                className="flex-1 text-sm px-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-sm text-black truncate">
                {currentConv ? currentConv.title : '选择对话'}
              </span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-lg z-[60] max-h-80 overflow-y-auto w-80 max-w-[calc(100vw-2rem)]">
            {/* 新建对话按钮 */}
            <button
              onClick={handleCreateNew}
              disabled={loading}
              className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 font-medium border-b disabled:opacity-50"
            >
              {loading ? '创建中...' : '+ 新建对话树'}
            </button>

            {/* 对话列表 */}
            {conversations.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                暂无对话
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`relative group ${
                    conv.id === currentConversationId ? 'bg-blue-50' : ''
                  }`}
                >
                  {editingId === conv.id ? (
                    <div className="px-3 py-2">
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRename(conv.id, editingTitle)
                          } else if (e.key === 'Escape') {
                            setEditingId(null)
                          }
                        }}
                        onBlur={() => {
                          if (editingTitle.trim()) {
                            handleRename(conv.id, editingTitle)
                          } else {
                            setEditingId(null)
                          }
                        }}
                        className="w-full text-sm px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <button
                        onClick={() => {
                          onConversationChange(conv.id)
                          setIsOpen(false)
                        }}
                        className={`flex-1 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                          conv.id === currentConversationId ? 'text-blue-600' : 'text-black'
                        }`}
                      >
                        <div className="font-medium truncate">{conv.title}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          更新于 {new Date(conv.updatedAt).toLocaleString('zh-CN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </button>

                      {/* 更多按钮（三个点） */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenId(menuOpenId === conv.id ? null : conv.id)
                          }}
                          className="p-2 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                          </svg>
                        </button>

                        {/* 更多菜单 */}
                        {menuOpenId === conv.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setMenuOpenId(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-50 min-w-[140px]">
                              <button
                                onClick={() => startEditing(conv.id, conv.title)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                              >
                                <span>✏️</span>
                                <span>重命名</span>
                              </button>
                              <button
                                onClick={() => handleDelete(conv.id, conv.title)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2 border-t"
                              >
                                <span>🗑️</span>
                                <span>删除</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
