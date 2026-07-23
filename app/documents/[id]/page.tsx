'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Panel, Group, Separator } from 'react-resizable-panels'
import ChatPanel from '@/components/ChatPanel'
import ViewControls, { type ViewMode } from '@/components/ViewControls'
import BranchMapFullscreen from '@/components/BranchMapFullscreen'
import ConversationSelector from '@/components/ConversationSelector'
import type { PdfViewerApi } from '@/components/pdf/PdfViewer'

// 动态导入 PdfViewer，禁用 SSR
const PdfViewer = dynamic(() => import('@/components/pdf/PdfViewer'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full">加载 PDF 查看器...</div>
})

interface Document {
  id: string
  originalName: string
  filePath: string
  pageCount: number
}

export default function DocumentPage() {
  const params = useParams()
  const documentId = params.id as string

  const [document, setDocument] = useState<Document | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedText, setSelectedText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('full')
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null)
  const pdfViewerApiRef = useRef<PdfViewerApi | null>(null)

  useEffect(() => {
    loadDocument()
  }, [documentId])

  const loadDocument = async () => {
    try {
      // 加载文档信息
      const docResponse = await fetch(`/api/documents/${documentId}`)
      const docData = await docResponse.json()

      if (!docResponse.ok) {
        throw new Error(docData.error || '加载文档失败')
      }

      setDocument(docData.document)

      // 先尝试获取已有对话
      const getConvResponse = await fetch(`/api/conversations?documentId=${documentId}`)
      const getConvData = await getConvResponse.json()

      let conversationToUse

      if (getConvResponse.ok && getConvData.conversations && getConvData.conversations.length > 0) {
        // 使用最近的对话
        conversationToUse = getConvData.conversations[0]
      } else {
        // 如果没有对话，创建新对话
        const convResponse = await fetch('/api/conversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            documentId,
            title: `${docData.document.originalName} - 对话 1`
          })
        })

        const convData = await convResponse.json()

        if (!convResponse.ok) {
          throw new Error(convData.error || '创建对话失败')
        }

        conversationToUse = convData.conversation
      }

      setConversationId(conversationToUse.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber)
  }

  const handleTextSelect = (text: string, pageNumber: number) => {
    setSelectedText(text)
  }

  const handleConversationChange = (newConversationId: string) => {
    setConversationId(newConversationId)
    setActiveMessageId(null) // 切换对话时重置活动消息
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-black">加载中...</div>
      </div>
    )
  }

  if (error || !document || !conversationId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">{error || '加载失败'}</div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* 顶部标题栏 */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
        <h1 className="text-xl font-semibold truncate flex-1 min-w-0 text-gray-900">{document.originalName}</h1>
      </div>

      {/* 视图控制按钮 */}
      <ViewControls viewMode={viewMode} onViewModeChange={setViewMode} />

      {/* 全屏分支地图视图 */}
      {viewMode === 'branch-map-fullscreen' && (
        <BranchMapFullscreen
          conversationId={conversationId}
          activeMessageId={activeMessageId}
          onSelectMessage={setActiveMessageId}
          onContinueFrom={setActiveMessageId}
          onSwitchToChatView={() => setViewMode('chat-only')}
        />
      )}

      {/* 其他视图模式 */}
      {viewMode !== 'branch-map-fullscreen' && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <Group orientation="horizontal">
            {/* 左侧：PDF 阅读器 */}
            {viewMode !== 'chat-only' && (
              <>
                <Panel defaultSize={55} minSize={20}>
                  <div className="h-full w-full min-w-0 overflow-hidden">
                    <PdfViewer
                      fileUrl={`/api/documents/${documentId}/file`}
                      currentPage={currentPage}
                      onCurrentPageChange={handlePageChange}
                      onReady={(api) => {
                        pdfViewerApiRef.current = api
                      }}
                      onTextSelect={handleTextSelect}
                    />
                  </div>
                </Panel>
                <Separator className="w-1 bg-gray-300 hover:bg-blue-500 transition-colors cursor-col-resize" />
              </>
            )}

            {/* 右侧：AI 对话面板 */}
            {viewMode !== 'pdf-only' && (
              <Panel defaultSize={viewMode === 'chat-only' ? 100 : 45} minSize={30}>
                <div className="h-full w-full min-w-0 overflow-hidden">
                  <ChatPanel
                    documentId={documentId}
                    conversationId={conversationId}
                    currentPage={currentPage}
                    totalPages={document.pageCount}
                    selectedText={selectedText}
                    activeMessageId={activeMessageId}
                    onActiveMessageIdChange={setActiveMessageId}
                  />
                </div>
              </Panel>
            )}
          </Group>
        </div>
      )}
    </div>
  )
}
