'use client'

import { useState, useEffect } from 'react'
import UploadPdf from '@/components/UploadPdf'
import Link from 'next/link'

interface Document {
  id: string
  originalName: string
  pageCount: number
  createdAt: string
}

export default function DocumentList() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      const response = await fetch('/api/documents')
      const data = await response.json()
      if (response.ok && data.documents) {
        setDocuments(data.documents)
      }
    } catch (error) {
      console.error('加载文档失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除文档"${name}"吗？此操作不可恢复。`)) {
      return
    }

    setDeleting(id)
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setDocuments(documents.filter(doc => doc.id !== id))
      } else {
        const data = await response.json()
        alert('删除失败: ' + data.error)
      }
    } catch (error) {
      console.error('删除文档失败:', error)
      alert('删除失败')
    } finally {
      setDeleting(null)
    }
  }

  const handleUploadSuccess = () => {
    loadDocuments()
  }

  return (
    <>
      <div className="mb-12">
        <UploadPdf onUploadSuccess={handleUploadSuccess} />
      </div>

      {loading ? (
        <div className="text-center py-8 text-black">加载中...</div>
      ) : documents.length > 0 ? (
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-black">我的文档</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="relative group p-4 bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
              >
                <Link
                  href={`/documents/${doc.id}`}
                  className="block"
                >
                  <h3 className="font-semibold text-lg mb-2 truncate text-black">
                    {doc.originalName}
                  </h3>
                  <div className="text-sm text-black space-y-1">
                    <div>页数：{doc.pageCount}</div>
                    <div>
                      上传时间：{new Date(doc.createdAt).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                </Link>

                {/* 删除按钮 */}
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    handleDelete(doc.id, doc.originalName)
                  }}
                  disabled={deleting === doc.id}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="删除文档"
                >
                  {deleting === doc.id ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-black">
          还没有上传文档，点击上方上传按钮开始
        </div>
      )}
    </>
  )
}
