import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import fs from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 验证用户登录
  const { error, user } = await requireAuth()
  if (error) return error

  try {
    const { id } = await params

    // 查找文档
    const document = await prisma.pdfDocument.findUnique({
      where: { id }
    })

    if (!document) {
      return NextResponse.json(
        { error: '文档不存在' },
        { status: 404 }
      )
    }

    // 验证文档所有权
    if (document.userId !== user!.id) {
      return NextResponse.json(
        { error: '无权访问该文件' },
        { status: 403 }
      )
    }

    // 读取 PDF 文件
    // filePath 可能是 /uploads/... 或 public/uploads/...
    let filePath = document.filePath

    // 如果是 /uploads/... 格式，转换为 public/uploads/...
    if (filePath.startsWith('/uploads/')) {
      filePath = path.join(process.cwd(), 'public', filePath)
    } else if (!path.isAbsolute(filePath)) {
      // 如果是相对路径，基于项目根目录
      filePath = path.join(process.cwd(), filePath)
    }

    if (!fs.existsSync(filePath)) {
      console.error('PDF 文件不存在:', filePath)
      return NextResponse.json(
        { error: 'PDF 文件不存在' },
        { status: 404 }
      )
    }

    const fileBuffer = fs.readFileSync(filePath)

    // 返回 PDF 文件
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(document.originalName)}"`,
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    })
  } catch (error) {
    console.error('获取 PDF 文件失败:', error)
    return NextResponse.json(
      { error: '获取 PDF 文件失败' },
      { status: 500 }
    )
  }
}
