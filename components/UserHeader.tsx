'use client'

import { signOut } from 'next-auth/react'
import BackgroundSettings from './BackgroundSettings'

interface UserHeaderProps {
  userName: string | null
  userEmail: string
  backgroundImage: string | null
  onBackgroundChange: (newBackground: string | null) => void
}

export default function UserHeader({ userName, userEmail, backgroundImage, onBackgroundChange }: UserHeaderProps) {
  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <div className="flex items-center justify-between mb-8">
      <h1 className="text-4xl font-bold text-black">
        Mycelium
      </h1>
      <div className="flex items-center gap-4">
        <BackgroundSettings
          currentBackground={backgroundImage}
          onBackgroundChange={onBackgroundChange}
        />
        <div className="text-right">
          <div className="text-sm font-medium text-gray-900">
            {userName || '用户'}
          </div>
          <div className="text-xs text-gray-600">{userEmail}</div>
        </div>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
        >
          退出登录
        </button>
      </div>
    </div>
  )
}
