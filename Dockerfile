# 多阶段构建 Dockerfile
FROM node:20-alpine AS base

# 安装 Python 和依赖
RUN apk add --no-cache python3 py3-pip

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY package*.json ./
COPY prisma ./prisma/

# ========================================
# 依赖安装阶段
# ========================================
FROM base AS deps

# 安装 Node.js 依赖
RUN npm ci

# 创建 Python 虚拟环境并安装 pdfplumber
RUN python3 -m venv venv && \
    ./venv/bin/pip install --no-cache-dir pdfplumber

# ========================================
# 构建阶段
# ========================================
FROM base AS builder

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

# 构建 Next.js 应用
RUN npm run build

# ========================================
# 生产运行阶段
# ========================================
FROM node:20-alpine AS runner

# 安装 Python 运行时
RUN apk add --no-cache python3

WORKDIR /app

# 设置生产环境
ENV NODE_ENV=production
ENV PORT=3000

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=deps /app/venv ./venv
COPY --from=builder /app/lib/pdf_parser.py ./lib/

# 创建上传目录
RUN mkdir -p ./public/uploads && \
    chown -R nextjs:nodejs ./public/uploads

# 创建数据库目录
RUN mkdir -p ./prisma && \
    chown -R nextjs:nodejs ./prisma

USER nextjs

EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/api/auth/signin', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
