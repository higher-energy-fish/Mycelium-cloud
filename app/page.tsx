import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import HomeClient from '@/components/HomeClient'

export default async function Home() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  // 获取用户完整信息（包括背景图片）
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      backgroundImage: true,
    }
  })

  return (
    <HomeClient
      initialUserName={user?.name || null}
      initialUserEmail={user?.email || session.user.email || ''}
      initialBackground={user?.backgroundImage || null}
    />
  )
}
