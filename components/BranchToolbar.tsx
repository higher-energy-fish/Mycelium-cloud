'use client'

import type { SortMode } from '@/lib/branchTree'

interface BranchToolbarProps {
  sortMode: SortMode
  onSortModeChange: (mode: SortMode) => void
  totalNodes: number
}

export default function BranchToolbar({
  sortMode,
  onSortModeChange,
  totalNodes
}: BranchToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-black">🗺️ 分支地图</h3>
        <span className="text-xs text-black">({totalNodes} 个节点)</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-black">排序:</span>
        <div className="flex gap-1 bg-white border border-gray-300 rounded-md p-0.5">
          <button
            onClick={() => onSortModeChange('page')}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              sortMode === 'page'
                ? 'bg-blue-600 text-white'
                : 'text-black hover:bg-gray-100'
            }`}
          >
            按页码
          </button>
          <button
            onClick={() => onSortModeChange('time')}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              sortMode === 'time'
                ? 'bg-blue-600 text-white'
                : 'text-black hover:bg-gray-100'
            }`}
          >
            按时间
          </button>
        </div>
      </div>
    </div>
  )
}
