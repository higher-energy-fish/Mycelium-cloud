#!/usr/bin/env node

/**
 * 独立的 PDF 解析进程
 * 通过 stdin 接收文件路径，通过 stdout 返回 JSON 结果
 */

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
const fs = require('fs');
const path = require('path');

// 设置 worker 路径
if (pdfjsLib.GlobalWorkerOptions) {
  const workerPath = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
}

async function parsePdf(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const uint8Array = new Uint8Array(dataBuffer);

    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      verbosity: 0,
      useWorkerFetch: false,
      isEvalSupported: false
    });

    const pdfDocument = await loadingTask.promise;
    const pageCount = pdfDocument.numPages;
    const pages = [];

    // 逐页提取文本
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map(item => item.str)
        .join(' ')
        .trim();

      pages.push({
        pageNumber: i,
        text
      });
    }

    return {
      success: true,
      pageCount,
      pages
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

// 从命令行参数读取文件路径
const filePath = process.argv[2];

if (!filePath) {
  console.error(JSON.stringify({ success: false, error: 'No file path provided' }));
  process.exit(1);
}

parsePdf(filePath)
  .then(result => {
    console.log(JSON.stringify(result));
    process.exit(0);
  })
  .catch(error => {
    console.error(JSON.stringify({ success: false, error: error.message }));
    process.exit(1);
  });
