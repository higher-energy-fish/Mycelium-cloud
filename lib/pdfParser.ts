import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

export interface PdfPageText {
  pageNumber: number
  text: string
}

export interface PdfParseResult {
  pageCount: number
  pages: PdfPageText[]
}

/**
 * 解析 PDF 文件，提取每一页的文本
 * 使用 Python pdfplumber 库，文本提取质量更好
 */
export async function parsePdfFile(filePath: string): Promise<PdfParseResult> {
  try {
    const pythonPath = path.join(process.cwd(), 'venv', 'bin', 'python3')
    const scriptPath = path.join(process.cwd(), 'lib', 'pdf_parser.py')

    // 使用 Python 脚本解析 PDF
    const { stdout, stderr } = await execAsync(`"${pythonPath}" "${scriptPath}" "${filePath}"`, {
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large PDFs
    })

    if (stderr) {
      console.warn('Python PDF 解析警告:', stderr)
    }

    const result = JSON.parse(stdout)

    if (!result.success) {
      throw new Error(result.error || 'PDF 解析失败')
    }

    return {
      pageCount: result.pageCount,
      pages: result.pages
    }
  } catch (error) {
    console.error('PDF 解析失败:', error)
    throw new Error(`PDF 解析失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 简化版本：使用相同的 Python 解析器
 */
export async function parsePdfFileSimple(filePath: string): Promise<PdfParseResult> {
  return parsePdfFile(filePath)
}

/**
 * 生成唯一的文件名
 */
export function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const ext = path.extname(originalName)
  const nameWithoutExt = path.basename(originalName, ext)
  return `${nameWithoutExt}-${timestamp}-${random}${ext}`
}
