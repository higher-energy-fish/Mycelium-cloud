'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface UploadPdfProps {
  onUploadSuccess?: () => void
}

export default function UploadPdf({ onUploadSuccess }: UploadPdfProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

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
          />
        </div>

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
