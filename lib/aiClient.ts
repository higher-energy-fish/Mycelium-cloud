/**
 * AI 客户端
 * 支持 OpenAI-compatible API
 */

export type AnswerDepth = 'concise' | 'standard' | 'deep'

export interface AIConfig {
  apiKey: string
  baseURL: string
  model: string
  answerDepth: AnswerDepth
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionResponse {
  content: string
  model: string
}

/**
 * 调用 OpenAI-compatible API
 *
 * 注意：当前实现为非流式，未来可以扩展为流式
 */
export async function chatCompletion(
  config: AIConfig,
  messages: ChatMessage[]
): Promise<ChatCompletionResponse> {
  try {
    console.log('AI API 调用信息:', {
      baseURL: config.baseURL,
      model: config.model,
      messagesCount: messages.length
    });

    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 4096  // 提高到 4096，支持长文深度解析
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('AI API 错误响应:', response.status, errorText)
      throw new Error(`AI API 调用失败 (${response.status}): ${errorText}`)
    }

    const data = await response.json()

    if (!data.choices || data.choices.length === 0) {
      throw new Error('AI API 返回数据格式错误')
    }

    return {
      content: data.choices[0].message.content,
      model: data.model || config.model
    }
  } catch (error: any) {
    console.error('AI 调用详细错误:', {
      message: error.message,
      code: error.code,
      cause: error.cause,
      baseURL: config.baseURL
    });

    // 提供更友好的错误信息
    if (error.cause?.code === 'ENOTFOUND') {
      throw new Error(`无法连接到 AI 服务器 (${config.baseURL})。请检查：1. Base URL 是否正确 2. 网络是否通畅 3. 是否需要使用代理`)
    } else if (error.cause?.code === 'ECONNREFUSED') {
      throw new Error(`AI 服务器拒绝连接 (${config.baseURL})。请检查服务是否正在运行`)
    } else if (error.cause?.code === 'ETIMEDOUT') {
      throw new Error(`连接 AI 服务器超时 (${config.baseURL})。请检查网络连接`)
    }

    throw new Error(`AI 调用失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 流式调用 AI API
 *
 * 使用 OpenAI 兼容的 stream: true 接口，逐个读取 SSE chunk。
 * 每收到一个增量 token，通过 onChunk 回调返回给调用方。
 *
 * @param config AI 配置
 * @param messages 消息数组
 * @param onChunk 每个增量 token 的回调
 * @param signal 可选的 AbortSignal，用于中断请求
 * @returns 完整的回复内容和模型名称
 */
export async function chatCompletionStream(
  config: AIConfig,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<ChatCompletionResponse> {
  let response: Response
  try {
    response = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 4096,  // 提高到 4096，支持长文深度解析
        stream: true
      }),
      signal
    })
  } catch (error) {
    // 保留 AbortError，让调用方可以区分“主动中断”和“真实失败”
    if (error instanceof Error && error.name === 'AbortError') {
      throw error
    }
    console.error('AI 流式调用失败:', error)
    throw new Error(`AI 流式调用失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AI API 调用失败: ${response.status} ${errorText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('无法读取响应流')
  }

  const decoder = new TextDecoder()
  let fullContent = ''
  let modelName = config.model
  let buffer = '' // 缓冲区：处理跨 chunk 边界的不完整 SSE 行

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // 按行切分，保留最后一段（可能不完整）留待下次拼接
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line || !line.startsWith('data:')) continue

        const data = line.slice(5).trim()
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            fullContent += content
            onChunk(content)
          }
          if (parsed.model) {
            modelName = parsed.model
          }
        } catch (e) {
          // 忽略无法解析的行（如注释、心跳）
        }
      }
    }

    return {
      content: fullContent,
      model: modelName
    }
  } catch (error) {
    // 中断时把已经生成的部分内容一并返回，方便调用方保存
    if (error instanceof Error && error.name === 'AbortError') {
      const abortError = new Error('AbortError') as Error & { partialContent?: string; model?: string }
      abortError.name = 'AbortError'
      abortError.partialContent = fullContent
      abortError.model = modelName
      throw abortError
    }
    console.error('AI 流式读取失败:', error)
    throw new Error(`AI 流式调用失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}
