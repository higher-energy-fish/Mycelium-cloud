import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-utils'

const MAX_CODE_LENGTH = 20000
const REQUEST_TIMEOUT = 20000 // 20s — 比 runner 的 15s 多余量

interface RunnerResponse {
  success: boolean
  stdout: string
  stderr: string
  images: string[]   // data:image/png;base64,... 格式
  error: string
  executionTimeMs: number
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  // 检查 runner 配置
  const runnerUrl = process.env.PYTHON_RUNNER_URL
  if (!runnerUrl) {
    return NextResponse.json(
      { error: 'Python runner is not configured. Set PYTHON_RUNNER_URL in your .env file.' },
      { status: 503 }
    )
  }

  try {
    const body = await request.json()
    const { code } = body

    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json({ error: '代码不能为空' }, { status: 400 })
    }

    if (code.length > MAX_CODE_LENGTH) {
      return NextResponse.json(
        { error: `代码长度超过限制（最大 ${MAX_CODE_LENGTH} 字符）` },
        { status: 400 }
      )
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    try {
      const runnerRes = await fetch(`${runnerUrl}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!runnerRes.ok) {
        const err = await runnerRes.json().catch(() => ({}))
        return NextResponse.json(
          { error: (err as any).detail || 'Python 执行服务错误' },
          { status: runnerRes.status }
        )
      }

      const result: RunnerResponse = await runnerRes.json()
      return NextResponse.json(result)

    } catch (fetchErr: any) {
      clearTimeout(timeoutId)
      if (fetchErr.name === 'AbortError') {
        return NextResponse.json({ error: '请求超时（20秒）' }, { status: 504 })
      }
      console.error('Python runner 请求失败:', fetchErr)
      return NextResponse.json(
        { error: 'Python 执行服务不可用，请确保服务已启动（services/python-runner）' },
        { status: 503 }
      )
    }

  } catch (err) {
    console.error('代码执行 API 错误:', err)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
