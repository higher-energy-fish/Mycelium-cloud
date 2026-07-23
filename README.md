# Mycelium

> AI-powered PDF reading and conversation platform

Mycelium 是一个现代化的 PDF 阅读与 AI 对话工具，让你能够上传 PDF 文档并与 AI 进行深度对话，快速提取信息和洞察。

## ✨ 主要功能

### 📚 PDF 文档管理
- 上传和管理 PDF 文档
- 自动解析文档内容（使用 pdfplumber）
- 分页文本提取
- 文档预览和浏览

### 🤖 AI 对话功能
- 基于 PDF 内容的智能问答
- 支持全文、特定页码、上下文模式
- 可调节的回答深度（简短/标准/深度）
- 多轮对话上下文保持
- 对话历史管理

### 🌲 分支对话树
- 树形对话结构
- 支持多分支探索
- 可视化对话地图
- 自由切换对话分支

### 👤 用户系统
- 邮箱注册/登录
- 用户数据隔离
- 安全的密码存储（bcrypt）
- JWT 会话管理

### 🎨 个性化定制
- **自定义背景图片**（新功能！）
- 上传个人背景壁纸
- 支持 JPG、PNG、GIF、WebP 格式
- 实时预览效果

## 🚀 快速开始

### 方式 1：本地开发（最简单）

```bash
# 克隆项目
git clone <your-repo-url>
cd mycelium

# 一键启动
./start.sh
```

访问 http://localhost:3000，注册账户即可开始使用！

### 方式 2：快速部署到服务器

```bash
# 上传项目到服务器
git clone <your-repo-url> /var/www/mycelium
cd /var/www/mycelium

# 运行快速部署脚本
./quick-deploy.sh
```

### 方式 3：完整生产部署

```bash
# 运行完整部署脚本（包含 Nginx、SSL、防火墙等）
./deploy.sh
```

### 方式 4：Docker 部署

```bash
# 配置环境变量
cp .env.docker.example .env.docker
nano .env.docker

# 启动容器
docker-compose --env-file .env.docker up -d
```

详细部署文档请查看 [QUICK_START.md](./QUICK_START.md) 和 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📖 文档

- [快速开始指南](./QUICK_START.md) - 多种部署方案详解
- [完整部署文档](./DEPLOYMENT.md) - 生产环境部署指南
- [认证系统说明](./AUTH_IMPLEMENTATION.md) - 用户认证和数据隔离
- [PDF 解析器说明](./PDF_PARSER_FIX.md) - PDF 文本提取
- [背景功能文档](./BACKGROUND_FEATURE.md) - 自定义背景功能

## 🛠️ 技术栈

### 前端
- **Next.js 16** - React 框架（Turbopack）
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式框架
- **React Markdown** - Markdown 渲染
- **PDF.js** - PDF 渲染

### 后端
- **Next.js API Routes** - 后端 API
- **NextAuth.js v5** - 认证系统
- **Prisma** - ORM
- **SQLite** - 数据库（可切换到 PostgreSQL）

### AI 集成
- OpenAI API / DeepSeek API
- 可配置的模型和参数
- 流式响应支持

### Python 依赖
- **pdfplumber** - 高质量 PDF 文本提取

## 📁 项目结构

```
mycelium/
├── app/                    # Next.js 应用目录
│   ├── api/               # API 路由
│   │   ├── auth/         # 认证相关
│   │   ├── documents/    # 文档管理
│   │   ├── conversations/# 对话管理
│   │   ├── messages/     # 消息管理
│   │   ├── chat/         # AI 对话
│   │   ├── upload/       # 文件上传
│   │   └── user/         # 用户管理
│   ├── documents/         # 文档页面
│   ├── login/             # 登录页面
│   └── page.tsx           # 主页
├── components/            # React 组件
│   ├── BackgroundSettings.tsx  # 背景设置
│   ├── UserHeader.tsx          # 用户头部
│   ├── DocumentList.tsx        # 文档列表
│   ├── PdfViewer.tsx           # PDF 查看器
│   ├── ChatPanel.tsx           # 对话面板
│   └── ...
├── lib/                   # 工具库
│   ├── auth.ts           # NextAuth 配置
│   ├── auth-utils.ts     # 认证工具
│   ├── prisma.ts         # Prisma 客户端
│   ├── pdfParser.ts      # PDF 解析
│   ├── contextBuilder.ts # 上下文构建
│   ├── aiClient.ts       # AI 客户端
│   └── ...
├── prisma/               # 数据库
│   ├── schema.prisma     # 数据模型
│   └── migrations/       # 迁移文件
├── public/               # 静态文件
│   ├── uploads/          # 上传的 PDF
│   └── backgrounds/      # 背景图片
├── scripts/              # 工具脚本
├── venv/                 # Python 虚拟环境
├── deploy.sh             # 完整部署脚本
├── quick-deploy.sh       # 快速部署脚本
├── start.sh              # 本地启动脚本
├── backup.sh             # 备份脚本
└── docker-compose.yml    # Docker 配置
```
