import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // 创建测试用户
  const hashedPassword = await bcrypt.hash('test123456', 10)

  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      password: hashedPassword,
      name: '测试用户',
    },
  })

  console.log('测试用户创建成功:')
  console.log('邮箱:', user.email)
  console.log('密码: test123456')
  console.log('姓名:', user.name)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
