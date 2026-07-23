'use client'

import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'

interface MarkdownWithLatexProps {
  content: string
  className?: string
}

export default function MarkdownWithLatex({ content, className = '' }: MarkdownWithLatexProps) {
  // 预处理：处理各种 LaTeX 格式
  const preprocessedContent = content
    // 1. 处理 ```latex 代码块 -> 块级公式
    .replace(/```latex\s*([\s\S]*?)```/g, (_, latex) => `$$${latex.trim()}$$`)
    .replace(/```math\s*([\s\S]*?)```/g, (_, latex) => `$$${latex.trim()}$$`)
    // 2. 处理 LaTeX 标准格式
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, latex) => `$$${latex.trim()}$$`)  // \[...\] -> $$...$$
    .replace(/\\\((.*?)\\\)/g, (_, latex) => `$${latex.trim()}$`)         // \(...\) -> $...$

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // 代码块样式 - 排除 math 类
          code({ className, children, ...props }: any) {
            // 如果是 math 相关的类，让 KaTeX 处理
            if (className?.includes('language-math')) {
              return <code className={className} {...props}>{children}</code>
            }

            const match = /language-(\w+)/.exec(className || '')
            const inline = !match

            return inline ? (
              <code className="px-1 py-0.5 bg-gray-100 rounded text-sm font-mono text-gray-800" {...props}>
                {children}
              </code>
            ) : (
              <pre className="bg-gray-100 rounded p-3 overflow-x-auto my-2">
                <code className={`text-sm font-mono text-gray-800 ${className}`} {...props}>
                  {children}
                </code>
              </pre>
            )
          },
          // 段落间距
          p({ children }) {
            return <p className="mb-2 last:mb-0">{children}</p>
          },
          // 标题样式
          h1({ children }) {
            return <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h1>
          },
          h2({ children }) {
            return <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h2>
          },
          h3({ children }) {
            return <h3 className="text-sm font-bold mb-2 mt-2 first:mt-0">{children}</h3>
          },
          // 列表样式
          ul({ children }) {
            return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
          },
          // 引用样式
          blockquote({ children }) {
            return <blockquote className="border-l-4 border-gray-400 pl-3 py-1 my-2 text-gray-700 italic">{children}</blockquote>
          },
          // 链接样式
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">
                {children}
              </a>
            )
          },
          // 表格样式
          table({ children }) {
            return <table className="border-collapse border border-gray-300 my-2 w-full text-sm">{children}</table>
          },
          th({ children }) {
            return <th className="border border-gray-300 px-2 py-1 bg-gray-100 font-semibold text-left">{children}</th>
          },
          td({ children }) {
            return <td className="border border-gray-300 px-2 py-1">{children}</td>
          },
          // 水平线
          hr() {
            return <hr className="my-3 border-gray-300" />
          },
          // pre 标签 - 排除 math
          pre({ children, ...props }: any) {
            return <pre {...props}>{children}</pre>
          }
        }}
      >
        {preprocessedContent}
      </ReactMarkdown>
    </div>
  )
}
