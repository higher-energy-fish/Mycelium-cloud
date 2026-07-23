'use client'

import { useState } from 'react'

interface BackgroundSettingsProps {
  currentBackground: string | null
  onBackgroundChange: (newBackground: string | null) => void
}

export default function BackgroundSettings({
  currentBackground,
  onBackgroundChange
}: BackgroundSettingsProps) {
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('background', file)

      const response = await fetch('/api/user', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '上传失败')
      }

      const data = await response.json()
      onBackgroundChange(data.user.backgroundImage)
      alert('背景图片上传成功！')
    } catch (error) {
      console.error('上传失败:', error)
      alert(error instanceof Error ? error.message : '上传失败')
    } finally {
      setUploading(false)
      e.target.value = '' // 重置 input
    }
  }

  const handleDelete = async () => {
    if (!confirm('确定要删除背景图片吗？')) return

    setDeleting(true)
    try {
      const response = await fetch('/api/user', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '删除失败')
      }

      onBackgroundChange(null)
      alert('背景图片已删除')
    } catch (error) {
      console.error('删除失败:', error)
      alert(error instanceof Error ? error.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="relative">
      {/* 设置按钮 */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="p-2 bg-white/80 backdrop-blur-sm text-gray-700 rounded-full hover:bg-white transition-all shadow-md"
        title="背景设置"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {/* 设置面板 */}
      {showSettings && (
        <div className="absolute top-12 right-0 bg-white rounded-lg shadow-xl p-4 w-64 z-50">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">背景设置</h3>

          {/* 当前背景预览 */}
          {currentBackground && (
            <div className="mb-3">
              <p className="text-xs text-gray-600 mb-2">当前背景:</p>
              <div className="relative h-24 rounded-md overflow-hidden border border-gray-200">
                <img
                  src={currentBackground}
                  alt="当前背景"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* 上传按钮 */}
          <label className="block w-full mb-2">
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
            <div className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors cursor-pointer text-center">
              {uploading ? '上传中...' : currentBackground ? '更换背景' : '上传背景'}
            </div>
          </label>

          {/* 删除按钮 */}
          {currentBackground && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-full px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {deleting ? '删除中...' : '删除背景'}
            </button>
          )}

          {/* 提示信息 */}
          <p className="text-xs text-gray-500 mt-3">
            支持 JPG、PNG、GIF、WebP 格式，最大 5MB
          </p>
        </div>
      )}

      {/* 点击外部关闭 */}
      {showSettings && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
