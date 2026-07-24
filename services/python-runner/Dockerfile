FROM python:3.11-slim

# 安装编译依赖（scipy / pyscf 需要 Fortran 编译器和 BLAS/LAPACK）
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gfortran \
    libopenblas-dev \
    liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

# 创建非 root 用户
RUN useradd -m -u 1000 runner && \
    mkdir -p /app && \
    chown -R runner:runner /app

WORKDIR /app

# 安装 Python 依赖（先以 root 安装，再切换用户）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY app.py .

# 切换到非 root 用户
USER runner

EXPOSE 8001

CMD ["python", "app.py"]
