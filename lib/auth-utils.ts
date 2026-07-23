import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

/**
 * 获取当前登录用户
 * 用于 API 路由中验证用户身份
 */
export async function getCurrentUser() {
  const session = await auth()
  return session?.user
}

/**
 * 要求用户必须登录
 * 如果未登录，返回 401 错误
 */
export async function requireAuth() {
  const user = await getCurrentUser()

  if (!user) {
    return {
      error: NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      ),
      user: null,
    }
  }

  return { error: null, user }
}
