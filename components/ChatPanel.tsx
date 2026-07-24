'use client'

import { useState, useRef, useEffect } from 'react'
import { Panel, Group, Separator } from 'react-resizable-panels'
import ApiSettings, { type AIConfig, type AnswerDepth } from './ApiSettings'
import ContextSelector from './ContextSelector'
import MessageTree from './MessageTree'
import BranchMap from './BranchMap'
import type { ContextType, ContextPayload } from '@/lib/contextBuilder'
import type { ViewMode } from './ViewControls'

interface ChatPanelProps {
  documentId: string
  conversationId: string
  currentPage: number
  totalPages: number
  selectedText: string | null
  activeMessageId?: string | null
  onActiveMessageIdChange?: (id: string | null) => void
  /** 当前视图模式，用于决定是否发送 PDF 切片 */
  viewMode?: ViewMode
}

export default function ChatPanel({
  documentId,
  conversationId,
  currentPage,
  totalPages,
  selectedText,
  activeMessageId: externalActiveMessageId,
  onActiveMessageIdChange,
  viewMode = 'full'
}: ChatPanelProps) {
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null)
  const [answerDepth, setAnswerDepth] = useState<AnswerDepth>('standard')
  const [contextType, setContextType] = useState<ContextType>('current_page')
  const [contextPayload, setContextPayload] = useState<ContextPayload>({ pageNumber: currentPage })
  const [question, setQuestion] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [internalActiveMessageId, setInternalActiveMessageId] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  // PDF 切片传输开关（仅 full 视图有效；chat-only 自动禁用）
  const [pdfContextEnabled, setPdfContextEnabled] = useState(true)
  // Python 计算模式开关
  const [pythonModeEnabled, setPythonModeEnabled] = useState(false)

  // 流式输出相关状态
  const [streaming, setStreaming] = useState(false)          // 是否正在流式生成
  const [streamedContent, setStreamedContent] = useState('') // 已生成的 assistant 文本
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null) // 乐观显示的用户提问
  const abortControllerRef = useRef<AbortController | null>(null)

  const messageEndRef = useRef<HTMLDivElement>(null)

  // 使用外部传入的 activeMessageId 或内部状态
  const activeMessageId = externalActiveMessageId ?? internalActiveMessageId
  const setActiveMessageId = (id: string | null) => {
    setInternalActiveMessageId(id)
    onActiveMessageIdChange?.(id)
  }

  // chat-only 视图自动禁用 PDF 切片；full 视图由 pdfContextEnabled 开关决定
  const isChatOnly = viewMode === 'chat-only'
  const usePdfContext = !isChatOnly && pdfContextEnabled
  const effectiveContextType: ContextType = usePdfContext ? contextType : 'none'

  // 从 localStorage 加载 answerDepth
  useEffect(() => {
    const saved = localStorage.getItem('ai_config')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.answerDepth) {
          setAnswerDepth(parsed.answerDepth)
        }
      } catch (e) {
        console.error('加载 answerDepth 失败:', e)
      }
    }
  }, [])

  // 当 aiConfig 变化时，同步 answerDepth
  useEffect(() => {
    if (aiConfig?.answerDepth) {
      setAnswerDepth(aiConfig.answerDepth)
    }
  }, [aiConfig])

  // 处理 answerDepth 变化
  const handleAnswerDepthChange = (depth: AnswerDepth) => {
    setAnswerDepth(depth)
    // 更新 aiConfig
    if (aiConfig) {
      const newConfig = { ...aiConfig, answerDepth: depth }
      setAiConfig(newConfig)
      // 保存到 localStorage
      localStorage.setItem('ai_config', JSON.stringify(newConfig))
    }
  }

  // 当前页变化时，更新上下文
  useEffect(() => {
    if (contextType === 'current_page') {
      setContextPayload({ pageNumber: currentPage })
    } else if (contextType === 'surrounding_pages') {
      setContextPayload({ centerPage: currentPage, range: 1 })
    }
  }, [currentPage, contextType])

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSend = async () => {
    if (streaming) return

    if (!question.trim()) {
      setError('请输入问题')
      return
    }

    if (!aiConfig || !aiConfig.apiKey) {
      setError('请先配置 AI API')
      return
    }

    // 验证上下文
    if (contextType === 'selected_text' && !selectedText) {
      setError('请先在 PDF 中选择文本')
      return
    }

    // 如果是选中文本，更新 payload
    let finalPayload = contextPayload
    if (contextType === 'selected_text' && selectedText) {
      finalPayload = { selectedText, sourcePage: currentPage }
    }

    const questionText = question

    setError(null)
    setSending(true)
    setStreaming(true)
    setStreamedContent('')
    setPendingQuestion(questionText) // 立即乐观显示用户提问
    setQuestion('')                  // 立即清空输入框
    setTimeout(scrollToBottom, 50)

    // 创建 AbortController 以支持“停止生成”
    const controller = new AbortController()
    abortControllerRef.current = controller

    let doneMessageId: string | null = null
    let streamErrored = false

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          parentId: activeMessageId,
          question: questionText,
          contextType: effectiveContextType,
          contextPayload: usePdfContext ? finalPayload : {},
          aiConfig,
          pythonModeEnabled,
        }),
        signal: controller.signal
      })

      if (!response.ok || !response.body) {
        // 非流式错误（如 401/403/500）
        let message = '发送失败'
        try {
          const data = await response.json()
          message = data.error || message
        } catch {
          // 忽略解析错误
        }
        throw new Error(message)
      }

      // 读取 SSE 流
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE 事件以空行分隔，逐个解析（保留最后一段不完整的）
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.split('\n').find(l => l.startsWith('data:'))
          if (!line) continue

          const jsonStr = line.slice(5).trim()
          if (!jsonStr) continue

          let event: any
          try {
            event = JSON.parse(jsonStr)
          } catch {
            continue
          }

          if (event.type === 'token') {
            setStreamedContent(prev => prev + event.content)
            setTimeout(scrollToBottom, 0)
          } else if (event.type === 'done') {
            doneMessageId = event.messageId ?? null
          } else if (event.type === 'error') {
            streamErrored = true
            setError(event.error || '生成失败')
          }
        }
      }
    } catch (err) {
      // AbortError 表示用户主动停止，不算错误
      if (err instanceof Error && err.name === 'AbortError') {
        // 停止后等待服务端保存部分内容，再刷新
        await new Promise(resolve => setTimeout(resolve, 400))
      } else {
        streamErrored = true
        setError(err instanceof Error ? err.message : '发送失败')
      }
    } finally {
      abortControllerRef.current = null
      setSending(false)
      setStreaming(false)

      // 若成功拿到 assistant 消息 id，切换活动节点
      if (doneMessageId) {
        setActiveMessageId(doneMessageId)
      }

      // 从数据库刷新完整消息列表，然后清除乐观显示的临时气泡
      setRefreshTrigger(prev => prev + 1)
      setPendingQuestion(null)
      setStreamedContent('')

      // 出错时把问题填回输入框，方便用户重试
      if (streamErrored) {
        setQuestion(questionText)
      }

      setTimeout(scrollToBottom, 150)
    }
  }

  // 停止生成：中断请求，服务端会保存已生成的部分
  const handleStop = () => {
    abortControllerRef.current?.abort()
  }

  const handleContinueFrom = (messageId: string) => {
    setActiveMessageId(messageId)
    alert(`已切换到该消息节点，下次发送消息将从这里继续`)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!streaming) {
        handleSend()
      }
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 设置区域 - 水平布局 */}
      <div className="border-b p-4 flex-shrink-0">
        <div className="grid grid-cols-2 gap-4">
          <ApiSettings
            onConfigChange={setAiConfig}
            externalAnswerDepth={answerDepth}
            onAnswerDepthChange={handleAnswerDepthChange}
          />
          {/* chat-only：自动禁用 PDF 切片；full：显示开关 + 条件渲染 ContextSelector */}
          {isChatOnly ? (
            <div className="flex items-start gap-1.5 pt-1 text-xs text-gray-400">
              <span>💬</span>
              <span>仅对话历史模式<br />不传入 PDF 切片</span>
            </div>
          ) : (
            <div>
              <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={pdfContextEnabled}
                  onChange={(e) => setPdfContextEnabled(e.target.checked)}
                  className="cursor-pointer accent-blue-600"
                />
                <span className={`text-xs font-semibold ${pdfContextEnabled ? 'text-black' : 'text-gray-400'}`}>
                  传入 PDF 切片
                </span>
              </label>
              {pdfContextEnabled ? (
                <ContextSelector
                  currentPage={currentPage}
                  totalPages={totalPages}
                  selectedText={selectedText}
                  onContextChange={(type, payload) => {
                    setContextType(type)
                    setContextPayload(payload)
                  }}
                />
              ) : (
                <div className="text-xs text-gray-400">
                  仅依赖对话历史（含历史中的 PDF 内容）
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 可调节的垂直分隔区域 */}
      <div className="flex-1 overflow-hidden">
        <Group orientation="vertical">
          {/* 分支地图 */}
          <Panel defaultSize={35} minSize={10}>
            <BranchMap
              conversationId={conversationId}
              activeMessageId={activeMessageId}
              onSelectMessage={setActiveMessageId}
              onContinueFrom={handleContinueFrom}
              refreshTrigger={refreshTrigger}
            />
          </Panel>

          <Separator className="h-1 bg-gray-300 hover:bg-blue-500 transition-colors cursor-row-resize" />

          {/* 消息列表 */}
          <Panel defaultSize={40} minSize={10}>
            <div className="h-full overflow-y-auto p-4">
              <MessageTree
                conversationId={conversationId}
                activeMessageId={activeMessageId}
                onContinueFrom={handleContinueFrom}
                refreshTrigger={refreshTrigger}
                pythonModeEnabled={pythonModeEnabled}
              />

              {/* 乐观显示：用户提问气泡（流式期间，DB 消息刷新前） */}
              {pendingQuestion && (
                <div className="mb-4 mt-4">
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-blue-600 text-white rounded-lg px-4 py-3">
                      <div className="text-xs font-semibold mb-1 opacity-70">你</div>
                      <div className="text-sm whitespace-pre-wrap break-words">
                        {pendingQuestion}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 流式显示：AI 回复气泡 */}
              {streaming && (
                <div className="mb-4">
                  <div className="flex justify-start">
                    <div className="max-w-full bg-gray-200 text-black rounded-lg px-4 py-3">
                      <div className="text-xs font-semibold mb-1 opacity-70 flex items-center gap-2">
                        AI
                        <span className="inline-flex gap-1">
                          <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      </div>
                      {streamedContent ? (
                        <div className="text-sm whitespace-pre-wrap break-words">
                          {streamedContent}
                          <span className="inline-block w-1.5 h-4 bg-gray-600 ml-0.5 align-middle animate-pulse" />
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">正在思考...</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messageEndRef} />
            </div>
          </Panel>

          <Separator className="h-1 bg-gray-300 hover:bg-blue-500 transition-colors cursor-row-resize" />

          {/* 输入区域 */}
          <Panel defaultSize={25} minSize={10}>
            <div className="h-full flex flex-col p-4 border-t">
              {error && (
                <div className="mb-3 p-2 bg-red-50 text-red-700 text-sm rounded">
                  {error}
                </div>
              )}

              {activeMessageId && (
                <div className="mb-2 text-xs text-blue-600">
                  💡 将从选中的消息节点继续对话
                </div>
              )}

              {/* 回复深度快捷切换 + Python 计算模式 */}
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="text-xs text-slate-600 font-medium">回复深度</span>
                <div className="flex gap-1">
                  {[
                    { value: 'concise' as AnswerDepth, label: '简短' },
                    { value: 'standard' as AnswerDepth, label: '标准' },
                    { value: 'deep' as AnswerDepth, label: '深度' }
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => handleAnswerDepthChange(value)}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        answerDepth === value
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* 分隔线 */}
                <span className="text-gray-300">|</span>

                {/* Python 计算模式开关 */}
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={pythonModeEnabled}
                    onChange={(e) => setPythonModeEnabled(e.target.checked)}
                    className="cursor-pointer accent-green-600"
                  />
                  <span className={`text-xs font-medium ${pythonModeEnabled ? 'text-green-700' : 'text-slate-500'}`}>
                    🐍 Python
                  </span>
                </label>
              </div>

              <div className="flex gap-2 flex-1">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="输入你的问题... (Enter 发送, Shift+Enter 换行)"
                  disabled={streaming}
                  className="flex-1 px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 text-black"
                  rows={3}
                />
                {streaming ? (
                  <button
                    onClick={handleStop}
                    className="px-6 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors self-end flex items-center gap-2"
                  >
                    <span className="w-3 h-3 bg-white rounded-sm" />
                    停止生成
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!question.trim()}
                    className="px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors self-end"
                  >
                    发送
                  </button>
                )}
              </div>

              <div className="mt-2 text-xs text-gray-500">
                {isChatOnly
                  ? '模式：仅对话历史'
                  : usePdfContext
                    ? `上下文：${contextType}`
                    : '模式：仅对话历史（PDF 切片已关闭）'
                }
              </div>
            </div>
          </Panel>
        </Group>
      </div>
    </div>
  )
}
