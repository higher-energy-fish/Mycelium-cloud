'use client'

import { useState } from 'react'
import type { ContextType, ContextPayload } from '@/lib/contextBuilder'

interface ContextSelectorProps {
  currentPage: number
  totalPages: number
  selectedText: string | null
  onContextChange: (type: ContextType, payload: ContextPayload) => void
}

export default function ContextSelector({
  currentPage,
  totalPages,
  selectedText,
  onContextChange
}: ContextSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [contextType, setContextType] = useState<ContextType>('current_page')
  const [startPage, setStartPage] = useState(1)
  const [endPage, setEndPage] = useState(1)

  const handleTypeChange = (type: ContextType) => {
    setContextType(type)

    // 自动更新 payload
    switch (type) {
      case 'current_page':
        onContextChange(type, { pageNumber: currentPage })
        break
      case 'surrounding_pages':
        onContextChange(type, { centerPage: currentPage, range: 1 })
        break
      case 'selected_text':
        if (selectedText) {
          onContextChange(type, { selectedText, sourcePage: currentPage })
        }
        break
      case 'page_range':
        onContextChange(type, { startPage, endPage })
        break
    }
  }

  const handlePageRangeChange = () => {
    if (startPage > 0 && endPage > 0 && startPage <= endPage) {
      onContextChange('page_range', { startPage, endPage })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm text-black">上下文范围</h3>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {isOpen ? '收起' : `当前: ${contextType} ▼`}
        </button>
      </div>

      {isOpen && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="contextType"
              value="current_page"
              checked={contextType === 'current_page'}
              onChange={() => handleTypeChange('current_page')}
              className="cursor-pointer"
            />
            <span className="text-black font-medium">当前页（第 {currentPage} 页）</span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="contextType"
              value="surrounding_pages"
              checked={contextType === 'surrounding_pages'}
              onChange={() => handleTypeChange('surrounding_pages')}
              className="cursor-pointer"
            />
            <span className="text-black">当前页 + 前后 1 页（第 {Math.max(1, currentPage - 1)}-{Math.min(totalPages, currentPage + 1)} 页）</span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="contextType"
              value="selected_text"
              checked={contextType === 'selected_text'}
              onChange={() => handleTypeChange('selected_text')}
              disabled={!selectedText}
              className="cursor-pointer disabled:cursor-not-allowed"
            />
            <span className={!selectedText ? 'text-gray-400' : 'text-black'}>
              选中文本 {selectedText && `(${selectedText.length} 字符)`}
            </span>
          </label>

          <div className="flex items-start gap-2">
            <input
              type="radio"
              name="contextType"
              value="page_range"
              checked={contextType === 'page_range'}
              onChange={() => handleTypeChange('page_range')}
              className="mt-1 cursor-pointer"
            />
            <div className="flex-1">
              <div className="text-sm text-black mb-1">指定页码范围</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={startPage}
                  onChange={(e) => setStartPage(parseInt(e.target.value) || 1)}
                  onBlur={handlePageRangeChange}
                  disabled={contextType !== 'page_range'}
                  className="w-16 px-2 py-1 text-sm text-black border rounded disabled:bg-gray-100 disabled:text-gray-400"
                />
                <span className="text-sm text-black">-</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={endPage}
                  onChange={(e) => setEndPage(parseInt(e.target.value) || 1)}
                  onBlur={handlePageRangeChange}
                  disabled={contextType !== 'page_range'}
                  className="w-16 px-2 py-1 text-sm text-black border rounded disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>
            </div>
          </div>

          <div className="mt-2 text-xs text-black">
            💡 AI 只能看到你选择的范围，不会读取整个 PDF
          </div>
        </div>
      )}
    </div>
  )
}
