'use client'

export type ViewMode = 'full' | 'pdf-only' | 'chat-only' | 'branch-map-fullscreen'

interface ViewControlsProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export default function ViewControls({ viewMode, onViewModeChange }: ViewControlsProps) {
  return (
    <div className="flex items-center gap-2 bg-white border-b px-3 py-2">
      <span className="text-xs font-semibold text-black mr-2">视图:</span>

      <button
        onClick={() => onViewModeChange('full')}
        className={`px-3 py-1 text-xs rounded transition-colors ${
          viewMode === 'full'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-black hover:bg-gray-200'
        }`}
        title="完整视图（PDF + 对话）"
      >
        📄💬 完整
      </button>

      <button
        onClick={() => onViewModeChange('pdf-only')}
        className={`px-3 py-1 text-xs rounded transition-colors ${
          viewMode === 'pdf-only'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-black hover:bg-gray-200'
        }`}
        title="只看 PDF"
      >
        📄 PDF
      </button>

      <button
        onClick={() => onViewModeChange('chat-only')}
        className={`px-3 py-1 text-xs rounded transition-colors ${
          viewMode === 'chat-only'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-black hover:bg-gray-200'
        }`}
        title="只看对话"
      >
        💬 对话
      </button>

      <button
        onClick={() => onViewModeChange('branch-map-fullscreen')}
        className={`px-3 py-1 text-xs rounded transition-colors ${
          viewMode === 'branch-map-fullscreen'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-black hover:bg-gray-200'
        }`}
        title="全屏分支地图"
      >
        🗺️ 地图
      </button>
    </div>
  )
}
