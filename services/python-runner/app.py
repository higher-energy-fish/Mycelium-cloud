"""
Python Code Runner Service

安全的 Python 代码执行服务，用于执行用户提交的代码片段。
捕获 stdout、stderr 和 matplotlib 生成的图像。

安全措施：
- 执行超时（15秒）
- 代码长度限制（10KB）
- 输出长度限制（100KB）
- 使用临时目录隔离执行
- matplotlib 使用 Agg 后端（无 GUI）
"""

import sys
import io
import os
import base64
import tempfile
import traceback
import time
from contextlib import redirect_stdout, redirect_stderr
from typing import Dict, List, Any
import signal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# 强制 matplotlib 使用非交互后端
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# 过滤 Agg 后端下 plt.show() 产生的已知无害 warning（不过滤其他任何警告）
import warnings
warnings.filterwarnings(
    "ignore",
    message="FigureCanvasAgg is non-interactive.*"
)

app = FastAPI(title="Python Code Runner")

# CORS 配置 - 仅允许 Next.js 应用访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["POST"],
    allow_headers=["*"],
)

# 常量配置
MAX_CODE_LENGTH = 10 * 1024  # 10KB
MAX_OUTPUT_LENGTH = 100 * 1024  # 100KB
EXECUTION_TIMEOUT = 15  # 15秒


class CodeRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=MAX_CODE_LENGTH)


class CodeResponse(BaseModel):
    success: bool
    stdout: str = ""
    stderr: str = ""
    images: List[str] = []  # data:image/png;base64,... 格式
    error: str = ""
    executionTimeMs: int = 0


class TimeoutException(Exception):
    pass


def timeout_handler(signum, frame):
    raise TimeoutException("代码执行超时（15秒限制）")


def capture_matplotlib_figures() -> List[str]:
    """捕获所有 matplotlib 图像，返回 data:image/png;base64,... 格式"""
    images = []
    figures = [plt.figure(n) for n in plt.get_fignums()]
    for fig in figures:
        buf = io.BytesIO()
        try:
            fig.savefig(buf, format='png', dpi=100, bbox_inches='tight')
            buf.seek(0)
            img_b64 = base64.b64encode(buf.read()).decode('utf-8')
            images.append(f"data:image/png;base64,{img_b64}")
        except Exception as e:
            print(f"Failed to save figure: {e}", file=sys.stderr)
        finally:
            buf.close()
    plt.close('all')
    return images


def execute_code(code: str) -> Dict[str, Any]:
    """在隔离环境中执行 Python 代码，返回 stdout/stderr/images/executionTimeMs"""
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()
    start_time = time.time()

    with tempfile.TemporaryDirectory() as tmpdir:
        original_cwd = os.getcwd()
        try:
            os.chdir(tmpdir)

            if hasattr(signal, 'SIGALRM'):
                signal.signal(signal.SIGALRM, timeout_handler)
                signal.alarm(EXECUTION_TIMEOUT)

            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                exec_globals: Dict[str, Any] = {
                    '__builtins__': __builtins__,
                    'plt': plt,
                    'matplotlib': matplotlib,
                }
                try:
                    import numpy as np
                    import pandas as pd
                    import scipy
                    import sympy
                    exec_globals.update({'np': np, 'pd': pd, 'scipy': scipy, 'sympy': sympy})
                except ImportError:
                    pass

                exec(code, exec_globals)

            if hasattr(signal, 'SIGALRM'):
                signal.alarm(0)

            images = capture_matplotlib_figures()
            stdout_text = stdout_capture.getvalue()
            stderr_text = stderr_capture.getvalue()

            if len(stdout_text) > MAX_OUTPUT_LENGTH:
                stdout_text = stdout_text[:MAX_OUTPUT_LENGTH] + "\n\n... (输出被截断)"
            if len(stderr_text) > MAX_OUTPUT_LENGTH:
                stderr_text = stderr_text[:MAX_OUTPUT_LENGTH] + "\n\n... (输出被截断)"

            elapsed_ms = int((time.time() - start_time) * 1000)
            return {"success": True, "stdout": stdout_text, "stderr": stderr_text,
                    "images": images, "error": "", "executionTimeMs": elapsed_ms}

        except TimeoutException as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            return {"success": False, "stdout": stdout_capture.getvalue(),
                    "stderr": stderr_capture.getvalue(), "images": [],
                    "error": str(e), "executionTimeMs": elapsed_ms}
        except Exception as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            error_msg = f"{type(e).__name__}: {str(e)}\n\n{traceback.format_exc()}"
            # matplotlib mathtext 解析失败：附加友好提示（不吞掉原始 traceback）
            mathtext_markers = ('ParseFatalException', 'Unknown symbol',
                                'mathtext_parser', 'matplotlib.mathtext', 'mathtext')
            if any(m in error_msg for m in mathtext_markers):
                error_msg = (
                    "提示：图中的 LaTeX/mathtext 表达式无法被 matplotlib 解析，"
                    "请尝试使用更简单的 mathtext，例如将 \\mathcal K 改成 \\mathcal{K}。\n\n"
                    + error_msg
                )
            return {"success": False, "stdout": stdout_capture.getvalue(),
                    "stderr": stderr_capture.getvalue(), "images": [],
                    "error": error_msg, "executionTimeMs": elapsed_ms}
        finally:
            if hasattr(signal, 'SIGALRM'):
                signal.alarm(0)
            os.chdir(original_cwd)
            plt.close('all')


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "service": "python-runner"}


@app.post("/run", response_model=CodeResponse)
async def run_code(request: CodeRequest):
    """
    执行 Python 代码

    请求：
    {
        "code": "print('Hello')"
    }

    响应：
    {
        "success": true,
        "stdout": "Hello\n",
        "stderr": "",
        "images": [],
        "error": ""
    }
    """
    if not request.code.strip():
        raise HTTPException(status_code=400, detail="代码不能为空")

    if len(request.code) > MAX_CODE_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"代码长度超过限制（最大 {MAX_CODE_LENGTH} 字节）"
        )

    result = execute_code(request.code)
    return CodeResponse(**result)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
