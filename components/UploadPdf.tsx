'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// 与服务端 next.config.ts 中 serverMaxBodySize 保持一致
const MAX_UPLOAD_SIZE = 200 * 1024 * 1024 // 200MB，超过此限制服务端会拒绝
// 超过此阈值时给用户软提示，但不阻止上传
const LARGE_FILE_WARNING_SIZE = 100 * 1024 * 1024 // 100MB

interface UploadPdfProps {
  onUploadSuccess?: () => void
}

export default function UploadPdf({ onUploadSuccess }: UploadPdfProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0]
    setWarning(null)
    if (!file) return
    if (file.size > MAX_UPLOAD_SIZE) {
      setWarning(`文件超过 200MB 限制（当前 ${(file.size / 1024 / 1024).toFixed(1)} MB），上传将被服务端拒绝。`)
    } else if (file.size > LARGE_FILE_WARNING_SIZE) {
      setWarning(`该 PDF 文件较大（${(file.size / 1024 / 1024).toFixed(1)} MB），上传和解析可能需要较长时间，请耐心等待。`)
    }
  }

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const file = formData.get('file') as File

    if (!file) {
      setError('请选择文件')
      return
    }

    setUploading(true)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '上传失败')
      }

      // 通知父组件上传成功
      if (onUploadSuccess) {
        onUploadSuccess()
      }

      // 上传成功，跳转到文档页面
      router.push(`/documents/${data.document.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">上传 PDF</h2>

      <form onSubmit={handleUpload}>
        <div className="mb-4">
          <input
            type="file"
            name="file"
            accept=".pdf"
            className="block w-full text-sm text-black
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              cursor-pointer"
            disabled={uploading}
            onChange={handleFileChange}
          />
        </div>

        {/* 解析耗时提示 */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800 flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <span className="font-semibold">提示：</span>
            PDF 解析需要一定时间，首次上传或大文件可能耗时较长，请耐心等待。
          </div>
        </div>

        {warning && (
          <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded-md text-sm">
            {warning}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={uploading}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md
            hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
            font-medium transition-colors"
        >
          {uploading ? '上传中...' : '上传'}
        </button>
      </form>
    </div>
  )
}
