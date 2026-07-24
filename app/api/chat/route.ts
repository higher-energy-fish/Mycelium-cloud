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
      aiConfig,
      pythonModeEnabled = false,
    }: {
      conversationId: string
      parentId: string | null
      question: string
      contextType: ContextType
      contextPayload: ContextPayload
      aiConfig: AIConfig
      pythonModeEnabled?: boolean
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

    // Python 计算模式：向 system prompt 追加能力说明
    const PYTHON_CAPABILITIES_PROMPT = `
---
【Python 计算环境】
当前对话已启用 Python 计算模式。前端可执行 Python 代码块，你可以在适合时生成代码辅助计算。

可用库（已预导入）：
- numpy (as np)      — 数值计算、线性代数、矩阵运算
- scipy              — 科学计算、优化、积分、信号处理
- sympy              — 符号数学、代数推导、解方程
- pandas (as pd)     — 数据处理、表格运算
- matplotlib.pyplot (as plt) — 绘图、可视化
- seaborn (as sns)   — 统计可视化、矩阵热图
- pyscf              — 量子化学计算（HF、DFT、分子积分）

通用代码规则：
- 代码块必须使用 \`\`\`python 标记
- 代码应自包含、简洁，库已预导入（显式 import 也被支持）
- 不要访问文件系统、网络、环境变量，不要执行 shell 命令
- 避免长时间运行的循环（超时限制为 15 秒）
- matplotlib / seaborn 图像会自动捕获并显示（无需 plt.show()）

seaborn 热图规则：
- 仅当用户明确要求热图、heatmap、可视化矩阵或查看矩阵结构时才使用
- 小型/中型矩阵优先使用 seaborn.heatmap
- 小矩阵且数值重要时使用 annot=True；大矩阵不要用 annot=True
- 同时包含正负值的矩阵：使用 cmap="coolwarm", center=0
- 非负矩阵：使用 cmap="viridis"
- 图像需包含 title、axis labels、colorbar
- 不要默认为所有矩阵自动生成热图

PySCF 使用规则：
- 仅当用户明确要求量子化学计算、Hartree-Fock、DFT、分子轨道、基组、积分矩阵、Fock 矩阵、密度矩阵、重叠矩阵等内容时才使用
- 示例保持轻量：优先用 H2、HeH+、LiH、H2O 等小分子
- 默认使用 sto-3g 基组，除非用户明确要求其他基组
- 不要默认运行昂贵计算，不要生成大体系或长时间运行的代码

matplotlib 数学文本（mathtext）规则：
- matplotlib 默认使用 mathtext，不是完整 LaTeX，很多命令不被支持
- 在 title、legend、xlabel/ylabel、annotate 等文本中使用数学表达式时，必须用 mathtext 兼容写法
- \\mathcal 等命令的参数必须加花括号：写成 \\mathcal{K}，绝不要写成 \\mathcal K
- 所有含数学表达式的字符串必须用 raw string（前缀 r），例如 r"$x_1 \\in x_0 + \\mathcal{K}_1$"
- 优先使用简单稳定的命令：\\alpha \\beta \\gamma \\lambda \\mu、\\in \\subset \\subseteq、\\sum \\prod、\\mathbf{x} \\mathrm{span} \\mathcal{K}
- 避免使用 mathtext 不支持/不稳定的命令：\\operatorname \\mathscr \\bm \\boldsymbol \\text \\dfrac \\tfrac
- 不确定某命令是否受支持时，改用普通文本或更简单的 mathtext
- 不要启用 usetex=True（环境未安装完整 LaTeX）

  错误示例：r"$x_1 \\in x_0+\\mathcal K_1$"   ← \\mathcal 后缺花括号，会报 ParseFatalException
  正确示例：r"$x_1 \\in x_0 + \\mathcal{K}_1$"
`

    const systemPromptWithPython = pythonModeEnabled
      ? prompts.systemPrompt + PYTHON_CAPABILITIES_PROMPT
      : prompts.systemPrompt

    // 6. 构建完整的消息数组
    const messages: Array<{
      role: 'user' | 'assistant' | 'system'
      content: string
    }> = [
      { role: 'system', content: systemPromptWithPython },
      ...messagesToAIFormat(branchHistory),
      { role: 'user', content: prompts.userPrompt }
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
