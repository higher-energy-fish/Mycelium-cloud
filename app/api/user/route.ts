import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import fs from 'fs'

// 获取用户信息
export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth()
  if (error) return error

  try {
    const userData = await prisma.user.findUnique({
      where: { id: user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        backgroundImage: true,
        createdAt: true,
      }
    })

    return NextResponse.json({ user: userData })
  } catch (err) {
    console.error('获取用户信息失败:', err)
    return NextResponse.json(
      { error: '获取用户信息失败' },
      { status: 500 }
    )
  }
}

// 更新用户信息
export async function PATCH(request: NextRequest) {
  const { error, user } = await requireAuth()
  if (error) return error

  try {
    const body = await request.json()
    const { name, backgroundImage } = body

    const updatedUser = await prisma.user.update({
      where: { id: user!.id },
      data: {
        ...(name !== undefined && { name }),
        ...(backgroundImage !== undefined && { backgroundImage }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        backgroundImage: true,
      }
    })

    return NextResponse.json({ user: updatedUser })
  } catch (err) {
    console.error('更新用户信息失败:', err)
    return NextResponse.json(
      { error: '更新用户信息失败' },
      { status: 500 }
    )
  }
}

// 上传背景图片
export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth()
  if (error) return error

  try {
    const formData = await request.formData()
    const file = formData.get('background') as File

    if (!file) {
      return NextResponse.json(
        { error: '请上传图片文件' },
        { status: 400 }
      )
    }

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '只支持 JPG、PNG、GIF、WebP 格式的图片' },
        { status: 400 }
      )
    }

    // 验证文件大小（最大 5MB）
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: '图片大小不能超过 5MB' },
        { status: 400 }
      )
    }

    // 确保背景图片目录存在
    const backgroundDir = path.join(process.cwd(), 'public', 'backgrounds')
    await mkdir(backgroundDir, { recursive: true })

    // 删除用户之前的背景图片
    const currentUser = await prisma.user.findUnique({
      where: { id: user!.id },
      select: { backgroundImage: true }
    })

    if (currentUser?.backgroundImage) {
      const oldImagePath = path.join(process.cwd(), 'public', currentUser.backgroundImage)
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath)
      }
    }

    // 生成唯一文件名
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const ext = path.extname(file.name)
    const filename = `bg-${user!.id}-${timestamp}-${random}${ext}`
    const filePath = path.join(backgroundDir, filename)

    // 保存文件
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // 更新数据库
    const backgroundUrl = `/backgrounds/${filename}`
    const updatedUser = await prisma.user.update({
      where: { id: user!.id },
      data: { backgroundImage: backgroundUrl },
      select: {
        id: true,
        email: true,
        name: true,
        backgroundImage: true,
      }
    })

    return NextResponse.json({
      success: true,
      user: updatedUser
    })
  } catch (err) {
    console.error('上传背景图片失败:', err)
    return NextResponse.json(
      { error: '上传背景图片失败' },
      { status: 500 }
    )
  }
}

// 删除背景图片
export async function DELETE(request: NextRequest) {
  const { error, user } = await requireAuth()
  if (error) return error

  try {
    // 获取当前用户的背景图片
    const currentUser = await prisma.user.findUnique({
      where: { id: user!.id },
      select: { backgroundImage: true }
    })

    // 删除文件
    if (currentUser?.backgroundImage) {
      const imagePath = path.join(process.cwd(), 'public', currentUser.backgroundImage)
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath)
      }
    }

    // 更新数据库
    const updatedUser = await prisma.user.update({
      where: { id: user!.id },
      data: { backgroundImage: null },
      select: {
        id: true,
        email: true,
        name: true,
        backgroundImage: true,
      }
    })

    return NextResponse.json({
      success: true,
      user: updatedUser
    })
  } catch (err) {
    console.error('删除背景图片失败:', err)
    return NextResponse.json(
      { error: '删除背景图片失败' },
      { status: 500 }
    )
  }
}
