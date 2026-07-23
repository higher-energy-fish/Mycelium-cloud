'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Document, pdfjs } from 'react-pdf'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import PdfToolbar from './PdfToolbar'
import PdfPageView from './PdfPageView'

// 设置 PDF.js worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

export interface PdfViewerApi {
  jumpToPage: (page: number) => void
}

interface PdfViewerProps {
  fileUrl: string
  currentPage: number
  onCurrentPageChange: (page: number) => void
  onReady?: (api: PdfViewerApi) => void
  onTextSelect?: (text: string, pageNumber: number) => void
}

// 虚拟滚动配置
const PAGE_GAP = 16  // 页面间距（px）
const RENDER_BUFFER = 5  // 当前页前后各渲染 5 页
const DEFAULT_PAGE_WIDTH = 595  // A4 宽度（PDF 单位）
const DEFAULT_PAGE_HEIGHT = 842  // A4 高度（PDF 单位）

export default function PdfViewer({
  fileUrl,
  currentPage,
  onCurrentPageChange,
  onReady,
  onTextSelect
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [scale, setScale] = useState(1.1)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null)
  const [pageHeight, setPageHeight] = useState(DEFAULT_PAGE_HEIGHT)  // 真实页面高度

  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const lastReportedPage = useRef<number>(currentPage)
  const isJumpingRef = useRef(false)
  const scrollHandlerRef = useRef<number | null>(null)

  // 文档加载成功
  const onDocumentLoadSuccess = async (pdf: PDFDocumentProxy) => {
    setNumPages(pdf.numPages)
    setPdfDocument(pdf)
    setError(null)
    setLoading(false)

    // 获取第一页的实际尺寸
    try {
      const firstPage = await pdf.getPage(1)
      const viewport = firstPage.getViewport({ scale: 1 })
      setPageHeight(viewport.height)
      console.log('PDF 页面尺寸:', viewport.width, 'x', viewport.height)
    } catch (err) {
      console.error('获取页面尺寸失败:', err)
      setPageHeight(DEFAULT_PAGE_HEIGHT)
    }
  }

  // 文档加载失败
  const onDocumentLoadError = (error: Error) => {
    console.error('PDF 加载失败:', error)
    setError('PDF 加载失败: ' + error.message)
    setLoading(false)
  }

  // 计算单页高度（包含间距）
  const getPageHeight = () => {
    return pageHeight * scale + PAGE_GAP
  }

  // 计算总滚动高度
  const totalScrollHeight = numPages * getPageHeight()

  // 根据滚动位置计算当前页
  const calculateCurrentPage = (scroll: number): number => {
    const singlePageHeight = getPageHeight()
    const page = Math.floor(scroll / singlePageHeight) + 1
    return Math.max(1, Math.min(page, numPages))
  }

  // 计算需要渲染的页面范围
  const getVisibleRange = (): { start: number; end: number } => {
    if (!containerRef.current) return { start: 1, end: 1 }

    const scroll = containerRef.current.scrollTop
    const containerHeight = containerRef.current.clientHeight
    const singlePageHeight = getPageHeight()

    // 计算可见范围
    const startPage = Math.floor(scroll / singlePageHeight) + 1
    const endPage = Math.ceil((scroll + containerHeight) / singlePageHeight)

    // 添加缓冲区
    const start = Math.max(1, startPage - RENDER_BUFFER)
    const end = Math.min(numPages, endPage + RENDER_BUFFER)

    return { start, end }
  }

  // 跳转到指定页
  const jumpToPage = useCallback((page: number) => {
    if (page < 1 || page > numPages || !containerRef.current) return

    isJumpingRef.current = true
    const singlePageHeight = getPageHeight()
    const targetScroll = (page - 1) * singlePageHeight

    containerRef.current.scrollTop = targetScroll

    // 立即更新当前页
    if (lastReportedPage.current !== page) {
      lastReportedPage.current = page
      onCurrentPageChange(page)
    }

    // 300ms 后解除跳转状态
    setTimeout(() => {
      isJumpingRef.current = false
    }, 300)
  }, [numPages, pageHeight, scale, onCurrentPageChange])

  // 暴露 API
  useEffect(() => {
    if (onReady && numPages > 0) {
      onReady({ jumpToPage })
    }
  }, [onReady, jumpToPage, numPages])

  // 监听滚动事件（使用 requestAnimationFrame 节流）
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      if (scrollHandlerRef.current !== null) {
        cancelAnimationFrame(scrollHandlerRef.current)
      }

      scrollHandlerRef.current = requestAnimationFrame(() => {
        if (!container) return

        // 如果正在跳转，不更新当前页
        if (isJumpingRef.current) return

        const scroll = container.scrollTop
        const page = calculateCurrentPage(scroll)

        if (lastReportedPage.current !== page) {
          lastReportedPage.current = page
          onCurrentPageChange(page)
        }
      })
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollHandlerRef.current !== null) {
        cancelAnimationFrame(scrollHandlerRef.current)
      }
    }
  }, [numPages, pageHeight, scale, onCurrentPageChange])

  // 缩放变化时，调整滚动位置保持当前页不变
  useEffect(() => {
    if (!containerRef.current || numPages === 0) return

    const singlePageHeight = getPageHeight()
    const targetScroll = (lastReportedPage.current - 1) * singlePageHeight
    containerRef.current.scrollTop = targetScroll
  }, [scale, pageHeight, numPages])

  const { start, end } = getVisibleRange()
  const visiblePages = []
  for (let i = start; i <= end; i++) {
    visiblePages.push(i)
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 text-red-600">
        {error}
      </div>
    )
  }

  return (
    <div className="h-full w-full flex flex-col bg-gray-100 overflow-hidden">
      {/* 工具栏 */}
      <PdfToolbar
        currentPage={currentPage}
        numPages={numPages}
        scale={scale}
        onScaleChange={setScale}
        onPageJump={jumpToPage}
      />

      {/* PDF 容器 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        style={{ position: 'relative' }}
      >
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex items-center justify-center h-full text-gray-600">
              加载 PDF 中...
            </div>
          }
        >
          {/* 虚拟滚动容器 - 撑开总高度 */}
          <div
            style={{
              height: totalScrollHeight,
              position: 'relative'
            }}
          >
            {/* 只渲染可见范围的页面 */}
            {visiblePages.map((pageNumber) => {
              const singlePageHeight = getPageHeight()
              const top = (pageNumber - 1) * singlePageHeight

              return (
                <div
                  key={pageNumber}
                  style={{
                    position: 'absolute',
                    top: `${top}px`,
                    left: 0,
                    right: 0,
                    height: `${singlePageHeight}px`,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    paddingTop: `${PAGE_GAP / 2}px`,
                    paddingBottom: `${PAGE_GAP / 2}px`
                  }}
                >
                  <PdfPageView
                    pageNumber={pageNumber}
                    scale={scale}
                    ref={(el) => {
                      if (el) {
                        pageRefs.current.set(pageNumber, el)
                      } else {
                        pageRefs.current.delete(pageNumber)
                      }
                    }}
                  />
                </div>
              )
            })}
          </div>
        </Document>
      </div>

      {/* 调试信息（开发模式） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
          渲染: {start}-{end} / {numPages} | Scale: {scale.toFixed(2)} | 页高: {Math.round(pageHeight * scale)}px
        </div>
      )}
    </div>
  )
}
