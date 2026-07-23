import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

// 获取文档列表
export async function GET(request: NextRequest) {
  // 验证用户登录
  const { error, user } = await requireAuth()
  if (error) return error

  try {
    // 只返回当前用户的文档
    const documents = await prisma.pdfDocument.findMany({
      where: {
        userId: user!.id
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('获取文档列表失败:', error)
    return NextResponse.json(
      { error: '获取文档列表失败' },
      { status: 500 }
    )
  }
}
