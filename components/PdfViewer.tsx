'use client'

import { useState, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// 设置 PDF.js worker - 使用本地 worker 文件
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

interface PdfViewerProps {
  filePath: string
  onPageChange?: (pageNumber: number) => void
  onTextSelect?: (text: string, pageNumber: number) => void
}

export default function PdfViewer({ filePath, onPageChange, onTextSelect }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [error, setError] = useState<string | null>(null)

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
    setError(null)
  }

  function onDocumentLoadError(error: Error) {
    console.error('PDF 加载失败:', error)
    setError('PDF 加载失败')
  }

  const goToPrevPage = () => {
    if (pageNumber > 1) {
      const newPage = pageNumber - 1
      setPageNumber(newPage)
      onPageChange?.(newPage)
    }
  }

  const goToNextPage = () => {
    if (numPages && pageNumber < numPages) {
      const newPage = pageNumber + 1
      setPageNumber(newPage)
      onPageChange?.(newPage)
    }
  }

  // 监听页面变化
  useEffect(() => {
    onPageChange?.(pageNumber)
  }, [pageNumber, onPageChange])

  // 监听文本选择
  useEffect(() => {
    const handleTextSelection = () => {
      const selection = window.getSelection()
      const text = selection?.toString().trim()
      if (text && text.length > 0) {
        onTextSelect?.(text, pageNumber)
      }
    }

    document.addEventListener('mouseup', handleTextSelection)
    return () => {
      document.removeEventListener('mouseup', handleTextSelection)
    }
  }, [pageNumber, onTextSelect])

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* 控制栏 */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            上一页
          </button>
          <span className="text-sm text-black font-medium">
            第 {pageNumber} / {numPages || '...'} 页
          </span>
          <button
            onClick={goToNextPage}
            disabled={!numPages || pageNumber >= numPages}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一页
          </button>
        </div>

        <div className="text-sm text-black">
          选中文本后可在右侧对话中使用
        </div>
      </div>

      {/* PDF 显示区域 */}
      <div className="flex-1 overflow-auto p-4">
        {error ? (
          <div className="text-red-600 text-center py-8">{error}</div>
        ) : (
          <div className="flex justify-center">
            <Document
              file={filePath}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="text-center py-8 text-black">加载中...</div>
              }
            >
              <Page
                pageNumber={pageNumber}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="shadow-lg"
              />
            </Document>
          </div>
        )}
      </div>
    </div>
  )
}
