import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { parsePdfFileSimple, generateUniqueFilename } from '@/lib/pdfParser'
import { requireAuth } from '@/lib/auth-utils'

// 最大允许上传文件大小（与 next.config.ts 中 serverMaxBodySize 保持一致）
const MAX_UPLOAD_SIZE = 200 * 1024 * 1024 // 200MB

export async function POST(request: NextRequest) {
  // 验证用户登录
  const { error, user } = await requireAuth()
  if (error) return error

  // 单独捕获 FormData 解析错误：请求体过大或上传中断时，
  // Next.js 会在 request.formData() 阶段抛出异常
  let formData: FormData
  try {
    formData = await request.formData()
  } catch (parseError) {
    console.error('FormData 解析失败:', parseError)
    return NextResponse.json(
      { error: '文件上传失败，可能是文件过大、上传中断或请求体不完整。' },
      { status: 413 }
    )
  }

  try {
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: '请上传文件' },
        { status: 400 }
      )
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: '只支持 PDF 文件' },
        { status: 400 }
      )
    }

    // 确保上传目录存在
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadDir, { recursive: true })

    // 生成唯一文件名
    const filename = generateUniqueFilename(file.name)
    const filePath = path.join(uploadDir, filename)

    // 保存文件
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // 解析 PDF
    console.log('开始解析 PDF...')
    const parseResult = await parsePdfFileSimple(filePath)
    console.log(`PDF 解析完成，共 ${parseResult.pageCount} 页`)

    // 保存到数据库，关联到当前用户
    const document = await prisma.pdfDocument.create({
      data: {
        userId: user!.id,
        filename,
        originalName: file.name,
        filePath: `/uploads/${filename}`,
        pageCount: parseResult.pageCount,
        pages: {
          create: parseResult.pages.map(page => ({
            pageNumber: page.pageNumber,
            text: page.text
          }))
        }
      },
      include: {
        pages: true
      }
    })

    console.log(`文档保存成功，ID: ${document.id}`)

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        originalName: document.originalName,
        pageCount: document.pageCount,
        createdAt: document.createdAt
      }
    })
  } catch (error) {
    console.error('上传失败:', error)
    return NextResponse.json(
      { error: `上传失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    )
  }
}
