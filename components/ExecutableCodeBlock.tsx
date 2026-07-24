'use client'

import { useState } from 'react'

interface ExecutableCodeBlockProps {
  code: string
  language: string
  /** Python 计算模式开关：true 时显示 Run 按钮 */
  pythonModeEnabled?: boolean
}

interface ExecutionResult {
  success: boolean
  stdout: string
  stderr: string
  images: string[]       // data:image/png;base64,... 格式
  error: string
  executionTimeMs: number
}

type ImageSize = 'sm' | 'md' | 'lg' | 'full'

const imageSizeClassMap: Record<ImageSize, string> = {
  sm: 'max-w-[320px]',
  md: 'max-w-[520px]',
  lg: 'max-w-[760px]',
  full: 'max-w-full',
}

const imageSizeOptions: { value: ImageSize; label: string }[] = [
  { value: 'sm', label: '小' },
  { value: 'md', label: '中' },
  { value: 'lg', label: '大' },
  { value: 'full', label: '适应' },
]

export default function ExecutableCodeBlock({
  code,
  language,
  pythonModeEnabled = false,
}: ExecutableCodeBlockProps) {
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [showOutput, setShowOutput] = useState(false)
  const [copied, setCopied] = useState(false)
  // 三个独立的 UI 状态（仅前端本地 state，不入库）
  const [codeCollapsed, setCodeCollapsed] = useState(false)
  const [resultCollapsed, setResultCollapsed] = useState(false)
  const [imageSize, setImageSize] = useState<ImageSize>('md')

  const isPython = language === 'python' || language === 'py'
  const canRun = isPython && pythonModeEnabled
  const codeLineCount = code.split('\n').length

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 降级到 execCommand
      const el = document.createElement('textarea')
      el.value = code
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleRun = async () => {
    setExecuting(true)
    setShowOutput(true)
    setResult(null)
    setResultCollapsed(false) // 每次运行都展开新结果

    try {
      const response = await fetch('/api/code/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      const data = await response.json()

      if (!response.ok) {
        setResult({
          success: false,
          stdout: '',
          stderr: '',
          images: [],
          error: data.error || '执行失败',
          executionTimeMs: 0,
        })
      } else {
        setResult(data)
      }
    } catch (err) {
      setResult({
        success: false,
        stdout: '',
        stderr: '',
        images: [],
        error: err instanceof Error ? err.message : '网络错误',
        executionTimeMs: 0,
      })
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className="my-3 border border-gray-300 rounded-lg overflow-hidden">
      {/* 代码区域 */}
      <div className="relative group/code">
        {/* 语言标签 */}
        {language && (
          <div className="absolute top-2 left-3 text-xs text-gray-400 font-mono select-none">
            {language}
          </div>
        )}

        {codeCollapsed ? (
          <div className="bg-gray-900 text-gray-400 text-xs px-3 pt-7 pb-3 rounded-t-lg select-none">
            代码已隐藏 · {codeLineCount} 行
          </div>
        ) : (
          <pre className="bg-gray-900 text-gray-100 p-3 pt-7 pb-3 overflow-x-auto m-0 rounded-t-lg">
            <code className="text-sm font-mono">{code}</code>
          </pre>
        )}

        {/* 操作按钮组 */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover/code:opacity-100 transition-opacity">
          {/* 折叠/展开代码 */}
          <button
            onClick={() => setCodeCollapsed(v => !v)}
            className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded transition-colors"
            title={codeCollapsed ? '显示代码' : '隐藏代码'}
          >
            {codeCollapsed ? '显示代码' : '隐藏代码'}
          </button>

          {/* Copy 按钮 - 所有代码块都有 */}
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded transition-colors flex items-center gap-1"
            title="复制代码"
          >
            {copied ? (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>已复制</span>
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>复制</span>
              </>
            )}
          </button>

          {/* Run 按钮 - 仅 Python + 计算模式开启时 */}
          {canRun && (
            <button
              onClick={handleRun}
              disabled={executing}
              className="px-2.5 py-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white text-xs rounded transition-colors flex items-center gap-1"
              title="运行 Python 代码"
            >
              {executing ? (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>运行中...</span>
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                  <span>运行</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 输出区域 */}
      {showOutput && result && (
        <div className="border-t border-gray-300">
          {/* 结果头部：折叠开关 + 摘要 */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-xs text-gray-500 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={result.success ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {result.success ? '执行成功' : '执行失败'}
              </span>
              {resultCollapsed && (
                <span className="truncate">
                  {result.success
                    ? `· ${result.images.length > 0 ? `${result.images.length} 张图片 · ` : ''}${(result.executionTimeMs / 1000).toFixed(2)}s`
                    : '· 查看详情'}
                </span>
              )}
              {!resultCollapsed && result.executionTimeMs > 0 && (
                <span>· {result.executionTimeMs} ms</span>
              )}
            </div>
            <button
              onClick={() => setResultCollapsed(v => !v)}
              className="px-2 py-0.5 rounded hover:bg-gray-200 text-gray-600 whitespace-nowrap"
              title={resultCollapsed ? '显示结果' : '隐藏结果'}
            >
              {resultCollapsed ? '显示结果' : '隐藏结果'}
            </button>
          </div>

          {!resultCollapsed && (
          <>
          {/* 错误信息 */}
          {!result.success && result.error && (
            <div className="p-3 bg-red-50 border-b border-red-200">
              <div className="text-xs font-semibold text-red-700 mb-1">错误</div>
              <pre className="text-xs text-red-700 whitespace-pre-wrap font-mono">{result.error}</pre>
            </div>
          )}

          {/* stdout */}
          {result.stdout && (
            <div className="p-3 border-b border-gray-200">
              <div className="text-xs font-semibold text-gray-600 mb-1">输出</div>
              <pre className="text-xs text-gray-900 whitespace-pre-wrap font-mono bg-white rounded p-2 border border-gray-200">{result.stdout}</pre>
            </div>
          )}

          {/* stderr */}
          {result.stderr && (
            <div className="p-3 border-b border-gray-200 bg-yellow-50">
              <div className="text-xs font-semibold text-yellow-700 mb-1">警告 / 调试信息</div>
              <pre className="text-xs text-yellow-800 whitespace-pre-wrap font-mono">{result.stderr}</pre>
            </div>
          )}

          {/* matplotlib 图像 */}
          {result.images && result.images.length > 0 && (
            <div className="p-3 bg-white">
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <div className="text-xs font-semibold text-gray-600">生成的图像</div>
                {/* 图片大小控制（作用于本条结果的所有图片） */}
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <span>图片大小</span>
                  {imageSizeOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setImageSize(opt.value)}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        imageSize === opt.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {result.images.map((img, i) => {
                  // 兼容旧格式（纯 base64）和新格式（完整 data URL）
                  const src = img.startsWith('data:image/')
                    ? img
                    : `data:image/png;base64,${img}`
                  return (
                    <img
                      key={i}
                      src={src}
                      alt={`输出图像 ${i + 1}`}
                      style={{ maxWidth: 'min(100%, 100%)' }}
                      className={`${imageSizeClassMap[imageSize]} w-full h-auto rounded border border-gray-200 bg-white shadow-sm`}
                      onError={(e) => {
                        console.error('图片加载失败', i)
                        e.currentTarget.insertAdjacentHTML(
                          'afterend',
                          '<div class="text-xs text-red-500">图片加载失败</div>'
                        )
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* 成功但无输出 */}
          {result.success && !result.stdout && !result.stderr && result.images.length === 0 && (
            <div className="p-3 text-xs text-gray-400 italic">代码执行成功，无输出</div>
          )}
          </>
          )}
        </div>
      )}
    </div>
  )
}
