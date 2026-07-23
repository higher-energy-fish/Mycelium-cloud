'use client'

import { useState, useEffect } from 'react'
import type { AIConfig, AnswerDepth } from '@/lib/aiClient'

export type { AIConfig, AnswerDepth }

interface ApiSettingsProps {
  onConfigChange: (config: AIConfig) => void
  externalAnswerDepth?: AnswerDepth  // 外部传入的 answerDepth
  onAnswerDepthChange?: (depth: AnswerDepth) => void  // answerDepth 变化回调
}

// 注意：这里使用 localStorage 存储 API Key
// 生产环境应该考虑加密存储或走后端密钥管理
const STORAGE_KEY = 'ai_config'

export default function ApiSettings({ onConfigChange, externalAnswerDepth, onAnswerDepthChange }: ApiSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [config, setConfig] = useState<AIConfig>({
    apiKey: '',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4',
    answerDepth: 'standard'  // 默认标准模式
  })

  // 加载保存的配置
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // 兼容旧配置，没有 answerDepth 时使用默认值
        const configWithDepth = {
          ...parsed,
          answerDepth: parsed.answerDepth || 'standard'
        }
        setConfig(configWithDepth)
        onConfigChange(configWithDepth)
      } catch (e) {
        console.error('加载配置失败:', e)
      }
    }
  }, [onConfigChange])

  // 同步外部 answerDepth 到内部配置
  useEffect(() => {
    if (externalAnswerDepth && config.answerDepth !== externalAnswerDepth) {
      const newConfig = { ...config, answerDepth: externalAnswerDepth }
      setConfig(newConfig)
      // 保存到 localStorage
      if (config.apiKey && config.baseURL && config.model) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig))
      }
    }
  }, [externalAnswerDepth])

  const handleSave = () => {
    // 验证配置
    if (!config.apiKey || !config.baseURL || !config.model) {
      alert('请填写完整的配置')
      return
    }

    // 保存到 localStorage
    // 警告：生产环境中不应该明文存储 API Key
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    onConfigChange(config)
    setIsOpen(false)
    alert('配置已保存')
  }

  const isConfigured = config.apiKey && config.baseURL && config.model

  const depthLabels = {
    concise: '简短',
    standard: '标准',
    deep: '深度'
  }

  const depthDescriptions = {
    concise: '快速简短回答，适合快速查询',
    standard: '结构化标准回答，适合一般问题',
    deep: '深度长文解析，适合复杂学术内容'
  }

  return (
    <div className="border-b pb-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm text-black">AI 设置</h3>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {isOpen ? '收起' : isConfigured ? '已配置 ▼' : '配置 ▼'}
        </button>
      </div>

      {/* 当前深度显示 */}
      {isConfigured && !isOpen && (
        <div className="text-xs text-black">
          回复深度: {depthLabels[config.answerDepth]}
        </div>
      )}

      {!isConfigured && !isOpen && (
        <div className="text-xs text-red-600">
          请先配置 AI API
        </div>
      )}

      {isOpen && (
        <div className="space-y-3 mt-3">
          <div>
            <label className="block text-xs font-medium mb-1 text-black">
              API Key
              <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full px-2 py-1 text-sm text-black placeholder:text-gray-500 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="text-xs text-black mt-1">
              ⚠️ 开发环境：保存在 localStorage，生产环境应加密
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-black">
              Base URL
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={config.baseURL}
              onChange={(e) => setConfig({ ...config, baseURL: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="w-full px-2 py-1 text-sm text-black placeholder:text-gray-500 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="text-xs text-black mt-1">
              <span className="font-medium">💡 常用配置：</span><br/>
              <span>• OpenAI 官方: https://api.openai.com/v1</span><br/>
              <span>• 本地 Ollama: http://localhost:11434/v1</span><br/>
              <span>• 其他代理: 联系服务提供商获取</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-black">
              Model Name
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              placeholder="gpt-4"
              className="w-full px-2 py-1 text-sm text-black placeholder:text-gray-500 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* 回复深度选择 */}
          <div>
            <label className="block text-xs font-medium mb-2 text-black">
              回复深度
            </label>
            <div className="space-y-2">
              {(['concise', 'standard', 'deep'] as const).map((depth) => (
                <label
                  key={depth}
                  className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-gray-50"
                >
                  <input
                    type="radio"
                    name="answerDepth"
                    value={depth}
                    checked={config.answerDepth === depth}
                    onChange={(e) => {
                      const newDepth = e.target.value as AnswerDepth
                      setConfig({ ...config, answerDepth: newDepth })
                      onAnswerDepthChange?.(newDepth)
                    }}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-black">{depthLabels[depth]}</div>
                    <div className="text-xs text-black">{depthDescriptions[depth]}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
          >
            保存配置
          </button>
        </div>
      )}
    </div>
  )
}
