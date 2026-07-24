'use client'

import { useState } from 'react'

interface BranchNodeMenuProps {
  nodeId: string
  userMessageId: string
  currentDisplayName: string
  currentColor: string
  onRename: (messageId: string, displayName: string) => void
  onSetColor: (messageId: string, color: string) => void
  onDelete: (messageId: string, mode: 'node' | 'subtree') => void
  onClose: () => void
  position: { x: number; y: number }
}

const COLORS = [
  { name: '蓝色', value: 'blue', bg: 'bg-blue-100', border: 'border-blue-400' },
  { name: '绿色', value: 'green', bg: 'bg-green-100', border: 'border-green-400' },
  { name: '黄色', value: 'yellow', bg: 'bg-yellow-100', border: 'border-yellow-400' },
  { name: '紫色', value: 'purple', bg: 'bg-purple-100', border: 'border-purple-400' },
  { name: '红色', value: 'red', bg: 'bg-red-100', border: 'border-red-400' },
  { name: '橙色', value: 'orange', bg: 'bg-orange-100', border: 'border-orange-400' },
  { name: '青色', value: 'cyan', bg: 'bg-cyan-100', border: 'border-cyan-400' },
  { name: '粉色', value: 'pink', bg: 'bg-pink-100', border: 'border-pink-400' },
]

export default function BranchNodeMenu({
  nodeId,
  userMessageId,
  currentDisplayName,
  currentColor,
  onRename,
  onSetColor,
  onDelete,
  onClose,
  position
}: BranchNodeMenuProps) {
  const [showRename, setShowRename] = useState(false)
  const [newName, setNewName] = useState(currentDisplayName || '')

  const handleRename = () => {
    if (newName.trim()) {
      onRename(userMessageId, newName.trim())
      onClose()
    }
  }

  const handleColorSelect = (color: string) => {
    onSetColor(userMessageId, color)
    onClose()
  }

  const handleDelete = (mode: 'node' | 'subtree') => {
    const confirmMsg = mode === 'node'
      ? '确定删除此节点？子节点将挂到父节点下。'
      : '确定删除此节点及其所有子分支？此操作不可恢复。'

    if (confirm(confirmMsg)) {
      onDelete(userMessageId, mode)
      onClose()
    }
  }

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* 菜单 */}
      <div
        className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[200px]"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      >
        {showRename ? (
          <div className="p-3">
            <div className="text-xs font-medium text-gray-700 mb-2">重命名节点</div>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRename()
                } else if (e.key === 'Escape') {
                  setShowRename(false)
                }
              }}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入新名称"
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleRename}
                className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                确定
              </button>
              <button
                onClick={() => setShowRename(false)}
                className="flex-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 重命名 */}
            <button
              onClick={() => setShowRename(true)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <span>✏️</span>
              <span>重命名</span>
            </button>

            {/* 颜色选择 */}
            <div className="border-t border-gray-200">
              <div className="px-4 py-2 text-xs font-medium text-gray-500">选择颜色</div>
              <div className="grid grid-cols-4 gap-2 px-3 pb-3">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => handleColorSelect(color.value)}
                    className={`w-8 h-8 rounded border-2 ${color.bg} ${color.border} hover:scale-110 transition-transform ${
                      currentColor === color.value ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                    }`}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* 清除颜色 */}
            {currentColor && (
              <button
                onClick={() => handleColorSelect('')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 border-t border-gray-200 text-gray-600"
              >
                清除颜色
              </button>
            )}

            {/* 删除选项 */}
            <div className="border-t border-gray-200">
              <button
                onClick={() => handleDelete('node')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-orange-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>删除节点</span>
              </button>
              <button
                onClick={() => handleDelete('subtree')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>删除分支</span>
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
