'use client'

import { Page } from 'react-pdf'
import { forwardRef } from 'react'

interface PdfPageViewProps {
  pageNumber: number
  scale: number
  width?: number
}

const PdfPageView = forwardRef<HTMLDivElement, PdfPageViewProps>(
  ({ pageNumber, scale, width }, ref) => {
    return (
      <div
        ref={ref}
        id={`pdf-page-${pageNumber}`}
        className="relative mb-4"
        data-page-number={pageNumber}
      >
        <div className="bg-white shadow-lg">
          <Page
            pageNumber={pageNumber}
            scale={scale}
            width={width}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            loading={
              <div className="flex items-center justify-center h-96 bg-gray-100">
                <span className="text-sm text-gray-500">加载第 {pageNumber} 页...</span>
              </div>
            }
          />
        </div>

        {/* 预留标注层插槽 */}
        {/* <AnnotationLayer pageNumber={pageNumber} /> */}
      </div>
    )
  }
)

PdfPageView.displayName = 'PdfPageView'

export default PdfPageView
