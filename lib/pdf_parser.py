#!/usr/bin/env python3
"""
PDF 解析服务 - 使用 PyPDF2 或 pdfplumber
"""

import sys
import json
from pathlib import Path

try:
    import pdfplumber
    USE_PDFPLUMBER = True
except ImportError:
    USE_PDFPLUMBER = False
    try:
        from PyPDF2 import PdfReader
    except ImportError:
        print(json.dumps({
            "success": False,
            "error": "请安装 pdfplumber 或 PyPDF2: pip install pdfplumber"
        }))
        sys.exit(1)


def parse_pdf_with_pdfplumber(file_path):
    """使用 pdfplumber 解析 PDF（推荐，文本提取质量更好）"""
    pages = []

    with pdfplumber.open(file_path) as pdf:
        page_count = len(pdf.pages)

        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            pages.append({
                "pageNumber": i,
                "text": text.strip()
            })

    return page_count, pages


def parse_pdf_with_pypdf2(file_path):
    """使用 PyPDF2 解析 PDF（备用方案）"""
    pages = []

    reader = PdfReader(file_path)
    page_count = len(reader.pages)

    for i, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        pages.append({
            "pageNumber": i,
            "text": text.strip()
        })

    return page_count, pages


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python3 pdf_parser.py <pdf_file_path>"
        }))
        sys.exit(1)

    file_path = sys.argv[1]

    if not Path(file_path).exists():
        print(json.dumps({
            "success": False,
            "error": f"File not found: {file_path}"
        }))
        sys.exit(1)

    try:
        if USE_PDFPLUMBER:
            page_count, pages = parse_pdf_with_pdfplumber(file_path)
        else:
            page_count, pages = parse_pdf_with_pypdf2(file_path)

        result = {
            "success": True,
            "pageCount": page_count,
            "pages": pages
        }

        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
