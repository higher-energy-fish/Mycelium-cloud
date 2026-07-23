'use client'

import { useState } from 'react'
import type { BranchTreeNode } from '@/lib/branchTree'
import { getMessageDisplayLabel, getColorClasses } from '@/lib/branchTree'
import BranchNodeMenu from './BranchNodeMenu'

interface BranchNodeProps {
  node: BranchTreeNode
  isActive: boolean
  depth: number
  onSelectMessage: (messageId: string) => void
  onContinueFrom: (messageId: string) => void
  onUpdateMessageMeta: (messageId: string, meta: { displayName?: string; color?: string }) => void
}

export default function BranchNode({
  node,
  isActive,
  depth,
  onSelectMessage,
  onContinueFrom,
  onUpdateMessageMeta
}: BranchNodeProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })

  const label = getMessageDisplayLabel(node.message)
  const colorClasses = getColorClasses(node.message.color)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenuPosition({ x: e.clientX, y: e.clientY })
    setShowMenu(true)
  }

  const handleClick = () => {
    onSelectMessage(node.id)
  }

  const handleRename = (messageId: string, displayName: string) => {
    onUpdateMessageMeta(messageId, { displayName })
  }

  const handleSetColor = (messageId: string, color: string) => {
    onUpdateMessageMeta(messageId, { color })
  }

  const handleJumpTo = (messageId: string) => {
    onSelectMessage(messageId)
    // 滚动到消息
    const element = document.getElementById(`message-${messageId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // 添加短暂高亮效果
      element.classList.add('highlight-flash')
      setTimeout(() => {
        element.classList.remove('highlight-flash')
      }, 1500)
    }
  }

  return (
    <div className="flex items-start gap-2">
      {/* 节点本身 */}
      <div
        className={`
          relative px-3 py-2 rounded-lg border-2 cursor-pointer
          transition-all duration-200 hover:shadow-md
          ${colorClasses.bg} ${colorClasses.border} ${colorClasses.text}
          ${isActive ? 'ring-4 ring-blue-500 ring-opacity-50' : ''}
          max-w-[200px]
        `}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        title={`${label}\n创建于: ${new Date(node.message.createdAt).toLocaleString('zh-CN')}\nID: ${node.id}`}
      >
        {/* 角色图标 */}
        <div className="text-xs opacity-70 mb-1">
          {node.message.role === 'user' ? '👤' : '🤖'}
        </div>

        {/* 节点标签 */}
        <div className="text-xs font-medium truncate">
          {label}
        </div>

        {/* 子节点数量指示 */}
        {node.children.length > 0 && (
          <div className="text-xs opacity-60 mt-1">
            {node.children.length} 分支
          </div>
        )}

        {/* Active 指示器 */}
        {isActive && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
        )}

        {/* 菜单按钮 */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setMenuPosition({ x: e.clientX, y: e.clientY })
            setShowMenu(true)
          }}
          className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded hover:bg-black hover:bg-opacity-10"
        >
          <span className="text-xs">⋮</span>
        </button>
      </div>

      {/* 子节点 */}
      {node.children.length > 0 && (
        <div className="flex flex-col gap-2 pl-4 border-l-2 border-gray-300">
          {node.children.map((child) => (
            <BranchNode
              key={child.id}
              node={child}
              isActive={isActive}
              depth={depth + 1}
              onSelectMessage={onSelectMessage}
              onContinueFrom={onContinueFrom}
              onUpdateMessageMeta={onUpdateMessageMeta}
            />
          ))}
        </div>
      )}

      {/* 上下文菜单 */}
      {showMenu && (
        <BranchNodeMenu
          nodeId={node.id}
          userMessageId={node.message.id}
          currentDisplayName={node.message.displayName || ''}
          currentColor={node.message.color || ''}
          onClose={() => setShowMenu(false)}
          onRename={handleRename}
          onSetColor={handleSetColor}
          position={menuPosition}
        />
      )}
    </div>
  )
}
