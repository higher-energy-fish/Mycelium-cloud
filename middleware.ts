import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const session = await auth()
  const { pathname } = request.nextUrl

  // 公开路径
  const publicPaths = ['/login', '/api/auth']
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path))

  // 如果访问公开路径，直接放行
  if (isPublicPath) {
    // 如果已登录且访问登录页，重定向到首页
    if (pathname === '/login' && session) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  // 其他路径需要登录
  if (!session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (favicon)
     * - public 文件夹中的文件
     */
    '/((?!_next/static|_next/image|favicon.ico|uploads|backgrounds).*)',
  ],
}
