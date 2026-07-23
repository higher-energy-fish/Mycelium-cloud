'use client'

import { useState, useEffect } from 'react'
import UserHeader from './UserHeader'
import DocumentList from './DocumentList'

interface HomeClientProps {
  initialUserName: string | null
  initialUserEmail: string
  initialBackground: string | null
}

export default function HomeClient({
  initialUserName,
  initialUserEmail,
  initialBackground
}: HomeClientProps) {
  const [backgroundImage, setBackgroundImage] = useState<string | null>(initialBackground)

  return (
    <div className="min-h-screen relative">
      {/* 背景图片 - 轻微模糊（约10%）*/}
      {backgroundImage && (
        <div
          className="fixed inset-0 z-0"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: 'blur(2px)',
            transform: 'scale(1.02)', // 轻微放大避免模糊后边缘露白
          }}
        />
      )}

      {/* 内容区域 */}
      <div className={`relative z-10 py-12 ${!backgroundImage ? 'bg-gray-50' : ''}`}>
        <div className="max-w-6xl mx-auto px-4">
          <UserHeader
            userName={initialUserName}
            userEmail={initialUserEmail}
            backgroundImage={backgroundImage}
            onBackgroundChange={setBackgroundImage}
          />
          <DocumentList />
        </div>
      </div>
    </div>
  )
}
