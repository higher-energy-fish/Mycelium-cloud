import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildContext, buildAIPrompt, type ContextType, type ContextPayload } from '@/lib/contextBuilder'
import { chatCompletionStream, type AIConfig } from '@/lib/aiClient'
import { createMessage } from '@/lib/conversationTree'
import { getBranchMessages, messagesToAIFormat } from '@/lib/branchMessages'
import { requireAuth } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  // 验证用户登录
  const { error, user } = await requireAuth()
  if (error) return error

  try {
    const body = await request.json()
    const {
      conversationId,
      parentId,
      question,
      contextType,
      contextPayload,
      aiConfig
    }: {
      conversationId: string
      parentId: string | null
      question: string
      contextType: ContextType
      contextPayload: ContextPayload
      aiConfig: AIConfig
    } = body

    // 验证参数
    if (!conversationId || !question || !contextType || !aiConfig) {
      return NextResponse.json(
        { error: '缺少必需参数' },
        { status: 400 }
      )
    }

    // 1. 获取对话的所有消息（用于构建分支历史）
    const allMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }
    })

    // 2. 获取当前分支的历史消息（从根到 parentId）
    const branchHistory = parentId
      ? getBranchMessages(allMessages, parentId)
      : []

    // 3. 获取对话关联的文档
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { document: true }
    })

    if (!conversation) {
      return NextResponse.json(
        { error: '对话不存在' },
        { status: 404 }
      )
    }

    // 验证文档所有权
    if (conversation.document.userId !== user!.id) {
      return NextResponse.json(
        { error: '无权访问该对话' },
        { status: 403 }
      )
    }

    // 4. 构建 PDF 上下文
    const context = await buildContext(
      conversation.document.id,
      contextType,
      contextPayload
    )

    // 5. 构建 AI prompt（传入 answerDepth）
    const prompts = buildAIPrompt(
      question,
      conversation.document.originalName,
      context,
      aiConfig.answerDepth
    )

    // 6. 构建完整的消息数组
    const messages: Array<{
      role: 'user' | 'assistant' | 'system'
      content: string
    }> = [
      // System prompt（包含 PDF 上下文）
      {
        role: 'system',
        content: prompts.systemPrompt
      },
      // 历史对话
      ...messagesToAIFormat(branchHistory),
      // 当前用户问题（包含 PDF 上下文信息）
      {
        role: 'user',
        content: prompts.userPrompt
      }
    ]

    console.log('发送给 AI 的消息数量:', messages.length)
    console.log('分支历史消息数量:', branchHistory.length)

    // 7. 先保存用户消息（在流式生成之前，确保即使 AI 失败也不丢失用户提问）
    const userMessage = await createMessage(
      conversationId,
      parentId,
      'user',
      question,
      contextType,
      contextPayload,
      context.contextText
    )
    console.log('保存用户消息:', userMessage.id, '父节点:', parentId)

    // 8. 通过 SSE 流式返回 AI 回复
    const encoder = new TextEncoder()

    // SSE 事件序列化辅助函数
    const sse = (payload: Record<string, unknown>) =>
      encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let accumulated = ''
        let modelName: string | undefined

        // 流结束后统一保存 assistant 消息（只写一次数据库）
        const persistAssistant = async (content: string, model?: string) => {
          if (!content) return null
          const assistantMessage = await createMessage(
            conversationId,
            userMessage.id,
            'assistant',
            content,
            contextType,
            contextPayload,
            context.contextText,
            model
          )
          console.log('保存 AI 消息:', assistantMessage.id, '父节点:', userMessage.id)
          return assistantMessage
        }

        try {
          // 先把 userMessageId 告知前端，用于建立正确的分支关系
          controller.enqueue(sse({ type: 'start', userMessageId: userMessage.id }))

          // 调用流式 AI 接口，逐 token 转发给前端
          const result = await chatCompletionStream(
            aiConfig,
            messages,
            (chunk) => {
              accumulated += chunk
              controller.enqueue(sse({ type: 'token', content: chunk }))
            },
            request.signal // 客户端断开或点击“停止生成”时中断上游请求
          )

          modelName = result.model

          // 流正常结束：保存完整 assistant 消息，返回其 id
          const assistantMessage = await persistAssistant(result.content, result.model)

          controller.enqueue(
            sse({
              type: 'done',
              messageId: assistantMessage?.id ?? null,
              userMessageId: userMessage.id,
              model: modelName
            })
          )
        } catch (err) {
          const isAbort = err instanceof Error && err.name === 'AbortError'

          if (isAbort) {
            // 用户中断：保存已经生成的部分内容
            const partial =
              (err as Error & { partialContent?: string }).partialContent || accumulated
            const partialModel = (err as Error & { model?: string }).model || modelName
            try {
              const assistantMessage = await persistAssistant(partial, partialModel)
              controller.enqueue(
                sse({
                  type: 'done',
                  aborted: true,
                  messageId: assistantMessage?.id ?? null,
                  userMessageId: userMessage.id
                })
              )
            } catch (saveErr) {
              console.error('保存中断内容失败:', saveErr)
            }
          } else {
            console.error('流式聊天失败:', err)
            controller.enqueue(
              sse({
                type: 'error',
                error: err instanceof Error ? err.message : '生成失败',
                userMessageId: userMessage.id
              })
            )
          }
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // 提示 Nginx 等反向代理关闭缓冲，避免流被攒成一次性输出
        'X-Accel-Buffering': 'no'
      }
    })
  } catch (error) {
    console.error('聊天失败:', error)
    return NextResponse.json(
      { error: `聊天失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    )
  }
}
