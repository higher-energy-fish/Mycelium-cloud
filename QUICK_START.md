# 快速部署指南

本文档提供多种快速部署方案，根据你的需求选择合适的方式。

---

## 🚀 方案 1：本地开发环境（最快）

适合：本地开发、测试

### 步骤

1. **一键启动**
   ```bash
   ./start.sh
   ```

2. **访问应用**
   - 打开浏览器访问: http://localhost:3000
   - 注册第一个账户
   - 开始使用

### 说明

- 脚本会自动检查并安装依赖
- 自动创建数据库和环境变量
- 使用开发模式运行（支持热重载）

---

## 📦 方案 2：Docker 部署（推荐）

适合：生产环境、无需安装 Node.js

### 前置要求

- 已安装 Docker 和 Docker Compose

### 步骤

1. **生成密钥并创建环境变量**
   ```bash
   # 生成密钥
   openssl rand -base64 32
   
   # 复制并编辑环境变量
   cp .env.docker.example .env.docker
   nano .env.docker
   ```

2. **启动应用**
   ```bash
   # 构建并启动
   docker-compose --env-file .env.docker up -d
   
   # 查看日志
   docker-compose logs -f app
   ```

3. **初始化数据库**
   ```bash
   # 进入容器
   docker exec -it pdfread sh
   
   # 运行迁移
   npx prisma migrate deploy
   
   # 退出容器
   exit
   ```

4. **访问应用**
   - http://localhost:3000

### 常用命令

```bash
# 停止应用
docker-compose down

# 重启应用
docker-compose restart

# 查看日志
docker-compose logs -f app

# 备份数据
docker cp pdfread:/app/data/dev.db ./backup-$(date +%Y%m%d).db
docker cp pdfread:/app/public/uploads ./uploads-backup

# 更新应用
git pull
docker-compose build
docker-compose up -d
```

---

## 🖥️ 方案 3：快速服务器部署

适合：已有 Node.js 环境的服务器

### 前置要求

- Node.js 18+
- Python 3+
- PM2 (可选)

### 步骤

1. **克隆项目**
   ```bash
   git clone <your-repo> /var/www/pdfread
   cd /var/www/pdfread
   ```

2. **运行快速部署脚本**
   ```bash
   ./quick-deploy.sh
   ```

3. **访问应用**
   - http://your-server-ip:3000

### 脚本功能

- ✅ 安装所有依赖（Node.js + Python）
- ✅ 自动生成安全密钥
- ✅ 初始化数据库
- ✅ 构建生产版本
- ✅ 使用 PM2 管理进程
- ✅ 自动开机启动

---

## 🌐 方案 4：完整生产部署

适合：正式生产环境，需要 Nginx、SSL

### 步骤

1. **运行完整部署脚本**
   ```bash
   ./deploy.sh
   ```

2. **按提示配置**
   - 选择部署路径
   - 输入域名
   - 配置管理员账户
   - 选择是否安装 Nginx
   - 选择是否配置 SSL

### 脚本功能

- ✅ 安装所有系统依赖
- ✅ 安装和配置 Nginx
- ✅ 自动配置 SSL 证书（Let's Encrypt）
- ✅ 配置防火墙
- ✅ 设置自动备份
- ✅ 完整的生产环境优化

---

## 📋 部署后检查清单

### 基础功能测试

- [ ] 能够访问登录页面
- [ ] 能够注册新用户
- [ ] 能够登录
- [ ] 能够上传 PDF
- [ ] PDF 文本解析正常
- [ ] AI 对话功能正常
- [ ] 能够退出登录

### 安全检查

- [ ] 已修改默认 AUTH_SECRET
- [ ] 未登录无法访问文档
- [ ] 用户只能看到自己的文档
- [ ] SSL 证书配置正确（生产环境）
- [ ] 防火墙已配置（生产环境）

### 性能检查

- [ ] 页面加载速度正常
- [ ] PDF 上传速度正常
- [ ] AI 响应时间可接受
- [ ] 资源占用在合理范围

---

## 🔧 常见问题

### 1. 端口被占用

```bash
# 查看占用端口的进程
sudo lsof -i :3000

# 杀死进程
sudo kill -9 <PID>

# 或修改端口
# 编辑 .env 文件，修改 PORT=3001
```

### 2. PDF 上传失败

```bash
# 检查 Python 环境
./venv/bin/python3 -c "import pdfplumber; print('OK')"

# 重新安装
./venv/bin/pip install --upgrade pdfplumber

# 检查上传目录权限
sudo chown -R $USER:$USER public/uploads
chmod 755 public/uploads
```

### 3. 数据库连接失败

```bash
# 检查数据库文件
ls -la prisma/dev.db

# 重新生成 Prisma Client
npx prisma generate

# 重新运行迁移
npx prisma migrate deploy
```

### 4. Nginx 502 错误

```bash
# 检查应用是否运行
pm2 status
# 或
docker ps

# 检查端口
curl http://localhost:3000

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/error.log
```

### 5. 内存不足

```bash
# 查看内存使用
free -h

# 重启应用
pm2 restart pdfread
# 或
docker-compose restart

# 增加 swap（如果需要）
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## 📊 性能优化建议

### 开发环境

```bash
# 使用开发模式（已启用热重载）
npm run dev
```

### 生产环境

```bash
# 使用 PM2 集群模式
# 编辑 ecosystem.config.js
instances: 'max',  # 使用所有 CPU 核心
exec_mode: 'cluster'

# 重启
pm2 reload ecosystem.config.js
```

### 数据库优化

```bash
# 迁移到 PostgreSQL（生产推荐）
# 1. 安装 PostgreSQL
sudo apt-get install postgresql

# 2. 创建数据库
sudo -u postgres createdb pdfread

# 3. 更新 .env
DATABASE_URL="postgresql://user:pass@localhost:5432/pdfread"

# 4. 迁移
npx prisma migrate deploy
```

---

## 🔄 更新应用

### 使用脚本部署

```bash
cd /var/www/pdfread
git pull
./quick-deploy.sh
```

### 使用 Docker

```bash
docker-compose down
git pull
docker-compose build
docker-compose up -d
```

### 手动更新

```bash
# 停止应用
pm2 stop pdfread

# 拉取代码
git pull

# 安装依赖
npm install
./venv/bin/pip install --upgrade pdfplumber

# 运行迁移
npx prisma migrate deploy

# 构建
npm run build

# 重启
pm2 restart pdfread
```

---

## 💾 备份和恢复

### 自动备份

```bash
# 已通过 deploy.sh 设置
# 每天凌晨2点自动备份
# 备份位置: ~/backups/pdfread/
```

### 手动备份

```bash
# 运行备份脚本
./backup.sh

# 或手动备份
cp prisma/dev.db ~/backup-$(date +%Y%m%d).db
tar -czf ~/uploads-$(date +%Y%m%d).tar.gz public/uploads/
```

### 恢复数据

```bash
# 恢复数据库
cp ~/backups/pdfread/dev.db.20240123_020000 prisma/dev.db

# 恢复上传文件
tar -xzf ~/backups/pdfread/uploads.20240123_020000.tar.gz -C public/

# 重启应用
pm2 restart pdfread
```

---

## 📚 更多文档

- [完整部署文档](./DEPLOYMENT.md) - 详细的部署说明和配置
- [认证系统说明](./AUTH_IMPLEMENTATION.md) - 用户认证和数据隔离
- [PDF 解析器](./PDF_PARSER_FIX.md) - PDF 文本提取

---

## 🆘 获取帮助

遇到问题？

1. 检查日志文件
2. 查看 [常见问题](#-常见问题)
3. 阅读完整部署文档
4. 提交 GitHub Issue

---

## 🎯 快速参考

| 操作 | 命令 |
|------|------|
| 本地启动 | `./start.sh` |
| 快速部署 | `./quick-deploy.sh` |
| 完整部署 | `./deploy.sh` |
| Docker 启动 | `docker-compose up -d` |
| 查看日志 | `pm2 logs` 或 `docker-compose logs -f` |
| 重启应用 | `pm2 restart pdfread` 或 `docker-compose restart` |
| 备份数据 | `./backup.sh` |

---

**祝部署顺利！** 🎉
