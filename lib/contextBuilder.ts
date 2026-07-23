import { prisma } from './prisma'
import type { AnswerDepth } from './aiClient'

export type ContextType = 'current_page' | 'surrounding_pages' | 'selected_text' | 'page_range'

export interface ContextPayload {
  // current_page
  pageNumber?: number

  // surrounding_pages
  centerPage?: number
  range?: number // 前后页数，默认 1

  // selected_text
  selectedText?: string
  sourcePage?: number

  // page_range
  startPage?: number
  endPage?: number
}

export interface ContextResult {
  contextType: ContextType
  contextPayload: ContextPayload
  contextText: string // 实际的 PDF 文本内容
  pages: string // 页码范围描述，例如 "第 5 页" 或 "第 3-7 页"
}

/**
 * 根据用户选择的上下文类型，构造传给 AI 的上下文
 *
 * 核心设计原则：
 * - AI 不应该默认读取整个 PDF
 * - 只在用户明确指定范围时才读取局部内容
 * - 所有上下文都保存快照，用于后续复现
 */
export async function buildContext(
  documentId: string,
  contextType: ContextType,
  payload: ContextPayload
): Promise<ContextResult> {
  let contextText = ''
  let pages = ''

  switch (contextType) {
    case 'current_page':
      if (!payload.pageNumber) {
        throw new Error('current_page 需要提供 pageNumber')
      }
      const currentPage = await prisma.pdfPage.findUnique({
        where: {
          documentId_pageNumber: {
            documentId,
            pageNumber: payload.pageNumber
          }
        }
      })
      if (!currentPage) {
        throw new Error(`找不到第 ${payload.pageNumber} 页`)
      }
      contextText = currentPage.text
      pages = `第 ${payload.pageNumber} 页`
      break

    case 'surrounding_pages':
      if (!payload.centerPage) {
        throw new Error('surrounding_pages 需要提供 centerPage')
      }
      const range = payload.range || 1
      const startPage = Math.max(1, payload.centerPage - range)
      const endPage = payload.centerPage + range

      const surroundingPages = await prisma.pdfPage.findMany({
        where: {
          documentId,
          pageNumber: {
            gte: startPage,
            lte: endPage
          }
        },
        orderBy: {
          pageNumber: 'asc'
        }
      })

      contextText = surroundingPages
        .map(p => `[第 ${p.pageNumber} 页]\n${p.text}`)
        .join('\n\n')
      pages = `第 ${startPage}-${endPage} 页`
      break

    case 'selected_text':
      if (!payload.selectedText) {
        throw new Error('selected_text 需要提供 selectedText')
      }
      contextText = payload.selectedText
      pages = payload.sourcePage ? `第 ${payload.sourcePage} 页（用户选中文本）` : '用户选中文本'
      break

    case 'page_range':
      if (!payload.startPage || !payload.endPage) {
        throw new Error('page_range 需要提供 startPage 和 endPage')
      }
      const rangePages = await prisma.pdfPage.findMany({
        where: {
          documentId,
          pageNumber: {
            gte: payload.startPage,
            lte: payload.endPage
          }
        },
        orderBy: {
          pageNumber: 'asc'
        }
      })

      contextText = rangePages
        .map(p => `[第 ${p.pageNumber} 页]\n${p.text}`)
        .join('\n\n')
      pages = `第 ${payload.startPage}-${payload.endPage} 页`
      break

    default:
      throw new Error(`不支持的上下文类型: ${contextType}`)
  }

  return {
    contextType,
    contextPayload: payload,
    contextText,
    pages
  }
}

/**
 * 构造发送给 AI 的完整 prompt
 *
 * Prompt 设计要点：
 * 1. 明确告诉 AI 只能基于提供的上下文回答
 * 2. 如果上下文不足，AI 应该说明
 * 3. 回答应该引用页码
 * 4. 根据 answerDepth 调整回复详细程度
 */
export function buildAIPrompt(
  userQuestion: string,
  documentTitle: string,
  context: ContextResult,
  answerDepth: AnswerDepth = 'standard'
): { systemPrompt: string; userPrompt: string } {
  // 根据回复深度调整 system prompt
  const depthInstructions = {
    concise: `回复风格：**简短精炼**
- 直接回答核心问题，1-3 段为宜
- 跳过背景铺垫，直奔主题
- 只列关键公式，不展开推导
- 适合快速查询和确认事实`,

    standard: `回复风格：**结构化标准**
- 使用清晰的段落结构
- 提供必要的背景和核心内容
- 适当的公式和解释
- 长度适中，重点突出`,

    deep: `回复风格：**深度详尽解析**
- 提供完整的背景、定义、推导、直觉理解
- 详细展开数学公式和推导步骤
- 关联上下文和相关概念
- 不要担心回复过长，深度优先`
  }

  const systemPrompt = `你是一个专业的学术 PDF 深度解析助手。你的专长是帮助研究者深入理解复杂的学术文献。

你有两种信息来源：
1. **聊天历史**：你可以看到之前的对话内容，可以回答关于对话历史的问题
2. **PDF 内容**：用户提供的 PDF 文档的特定页面或段落

回答策略：
- 如果用户问的是**对话历史相关问题**（例如"刚才聊了什么"、"上一个问题是什么"），请基于聊天历史回答
- 如果用户问的是**PDF 内容相关问题**（例如"论文讲了什么"、"这个概念是什么"），请提供深度解析

${depthInstructions[answerDepth]}

深度解析输出格式（适用于学术概念/方法/理论解析）：

## 背景与动机
- 为什么提出这个概念/方法？
- 要解决什么问题？

## 核心定义
- 准确的数学定义或文字定义
- 关键术语解释

## 数学推导与公式（如适用）
- 列出核心公式
- 解释公式中每个符号的含义
- 推导关键步骤

## 直觉理解
- 用通俗语言解释核心思想
- 类比和可视化描述
- 为什么这样设计是合理的

## 与上下文的联系
- 与论文其他部分的关系
- 与已有方法/理论的区别和联系
- 在整体框架中的作用

## 常见误区
- 容易混淆的概念
- 常见的理解偏差

## 总结
- 核心要点提炼
- 记忆要点

LaTeX 公式输出规范：

1. **块级公式格式**：
   - 使用 \$\$...\$\$ 包裹
   - 前后必须空行
   - 单独成段，不与正文挤在一起

   示例：
   有效哈密顿量定义为：

   \$\$
   \\mathbf{H}_{\\mathrm{eff}} = \\sum_{i,j=1}^{3} H_{ij}^{\\mathrm{eff}} |i\\rangle\\langle j|
   \$\$

   其中 \$H_{ij}^{\\mathrm{eff}}\$ 是矩阵元素。

2. **行内公式格式**：
   - 使用 \$...\$ 包裹
   - 仅用于简单符号和短表达式
   - 复杂矩阵、求和、积分等优先使用块级公式

3. **矩阵和向量记号**：
   - 矩阵用粗体：\$\\mathbf{H}\$、\$\\mathbf{A}\$
   - 向量用粗体或箭头：\$\\mathbf{v}\$ 或 \$\\vec{v}\$
   - 单位矩阵：\$\\mathbf{I}\$
   - 零矩阵：\$\\mathbf{0}\$

4. **下标和上标规范**：
   - 文字下标用 \\mathrm{}：\$H_{\\mathrm{eff}}\$、\$E_{\\mathrm{total}}\$
   - 数字下标直接写：\$H_1\$、\$E_0\$
   - 复杂上下标用 {}：\$H_{ij}^{(n)}\$
   - 避免过密：\$H_{\\mathrm{eff}}^{(1)}\$ 优于 \$H_{eff}^{(1)}\$

5. **矩阵展开规范**：
   - 小矩阵（≤3×3）可以展开：

   \$\$
   \\mathbf{H} = \\begin{pmatrix}
   H_{11} & H_{12} & H_{13} \\\\
   H_{21} & H_{22} & H_{23} \\\\
   H_{31} & H_{32} & H_{33}
   \\end{pmatrix}
   \$\$

   - 大矩阵用紧凑记号：\$\\mathbf{H} = (H_{ij})_{i,j=1}^{n}\$
   - 必要时只展开关键部分

6. **公式前后说明**：
   - 公式前：简短说明含义
   - 公式后：解释符号和物理意义
   - 不要突然插入公式

7. **常用符号规范**：
   - 求和：\$\\sum_{i=1}^{n}\$
   - 积分：\$\\int_{a}^{b}\$
   - 偏导：\$\\frac{\\partial f}{\\partial x}\$
   - 矢量点积：\$\\mathbf{a} \\cdot \\mathbf{b}\$
   - 矢量叉积：\$\\mathbf{a} \\times \\mathbf{b}\$
   - 内积：\$\\langle \\psi | \\phi \\rangle\$
   - 期望值：\$\\langle \\hat{O} \\rangle\$

8. **避免的情况**：
   - ❌ 在正文中插入过大的公式
   - ❌ 连续多个行内公式不换行
   - ❌ 残缺的公式（缺少括号、符号）
   - ❌ 过度复杂的嵌套下标
   - ❌ 公式前后没有解释

重要规则：
- **提供深度、完整的解析**（${answerDepth === 'deep' ? '特别详尽' : answerDepth === 'concise' ? '简明扼要' : '适度详细'}）
- 对于复杂概念，详细展开解释${answerDepth === 'concise' ? '，但保持简洁' : ''}
- 使用 LaTeX 公式表达数学内容，遵循上述规范
- 不要声称阅读了整本 PDF，你只能看到用户提供的特定页面
- 不要编造 PDF 内容中没有的信息
- 如果 PDF 上下文不足以深入解析，请明确指出需要什么额外信息
- 在引用 PDF 内容时，注明具体页码
- 保持客观、准确和学术性`

  const userPrompt = `
【当前 PDF 上下文】
文档：${documentTitle}
上下文类型：${context.contextType}
页码范围：${context.pages}

--- PDF 内容开始 ---
${context.contextText}
--- PDF 内容结束 ---

【用户问题】
${userQuestion}

请根据 PDF 内容提供深入、详尽的解析。如果是概念/方法解释，请按照上述结构化格式输出。`

  return { systemPrompt, userPrompt }
}
