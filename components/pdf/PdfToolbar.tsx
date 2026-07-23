'use client'

import { useState, useEffect } from 'react'

interface PdfToolbarProps {
  currentPage: number
  numPages: number
  scale: number
  onScaleChange: (scale: number) => void
  onPageJump: (page: number) => void
}

export default function PdfToolbar({
  currentPage,
  numPages,
  scale,
  onScaleChange,
  onPageJump
}: PdfToolbarProps) {
  const [pageInput, setPageInput] = useState(currentPage.toString())

  // 当前页变化时同步输入框
  useEffect(() => {
    setPageInput(currentPage.toString())
  }, [currentPage])

  const handleZoomIn = () => {
    if (scale < 3) {
      onScaleChange(Math.min(3, scale + 0.15))
    }
  }

  const handleZoomOut = () => {
    if (scale > 0.5) {
      onScaleChange(Math.max(0.5, scale - 0.15))
    }
  }

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value)
  }

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const page = parseInt(pageInput)
    if (!isNaN(page) && page >= 1 && page <= numPages) {
      onPageJump(page)
    } else {
      // 输入无效，恢复当前页
      setPageInput(currentPage.toString())
    }
  }

  const handlePageInputBlur = () => {
    // 失焦时也触发跳转
    const page = parseInt(pageInput)
    if (!isNaN(page) && page >= 1 && page <= numPages) {
      onPageJump(page)
    } else {
      setPageInput(currentPage.toString())
    }
  }

  const scalePercentage = Math.round(scale * 100)

  return (
    <div className="bg-white border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
      {/* 左侧：页码控制 */}
      <div className="flex items-center gap-3">
        <form onSubmit={handlePageInputSubmit} className="flex items-center gap-2">
          <label className="text-sm text-gray-900 font-medium">页码:</label>
          <input
            type="number"
            min={1}
            max={numPages}
            value={pageInput}
            onChange={handlePageInputChange}
            onBlur={handlePageInputBlur}
            className="w-16 px-2 py-1 text-sm text-gray-900 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-900 font-medium">/ {numPages}</span>
        </form>
      </div>

      {/* 右侧：缩放控制 */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleZoomOut}
          disabled={scale <= 0.5}
          className="px-3 py-1 bg-gray-200 text-gray-900 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          title="缩小"
        >
          −
        </button>
        <span className="text-sm text-gray-900 font-medium w-12 text-center">
          {scalePercentage}%
        </span>
        <button
          onClick={handleZoomIn}
          disabled={scale >= 3}
          className="px-3 py-1 bg-gray-200 text-gray-900 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          title="放大"
        >
          +
        </button>
      </div>
    </div>
  )
}
