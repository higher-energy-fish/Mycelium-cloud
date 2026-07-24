# Python Code Runner Service

安全的 Python 代码执行服务，用于执行 AI 生成的代码片段。

## 功能

- 执行 Python 代码并捕获 stdout、stderr
- 自动捕获 matplotlib 生成的图像（PNG base64）
- 支持常用科学计算库：numpy, pandas, scipy, sympy, matplotlib

## 安全限制

- **执行超时**：15 秒
- **代码长度限制**：10KB
- **输出长度限制**：100KB
- **临时目录隔离**：每次执行在独立临时目录
- **非 root 用户**：容器内使用 UID 1000 运行

## 本地开发运行

### 方式 1：直接运行（需要 Python 3.11+）

```bash
cd services/python-runner
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

服务将运行在 `http://localhost:8001`

### 方式 2：Docker 运行（推荐）

```bash
cd services/python-runner

# 构建镜像
docker build -t python-runner .

# 运行容器（带安全限制）
docker run -d \
  --name python-runner \
  -p 8001:8001 \
  --memory="512m" \
  --cpus="1.0" \
  --pids-limit=100 \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=100m \
  --tmpfs /app/tmp:rw,noexec,nosuid,size=50m \
  python-runner
```

**安全参数说明：**
- `--memory="512m"`：限制内存 512MB
- `--cpus="1.0"`：限制 CPU 使用 1 核
- `--pids-limit=100`：限制进程数
- `--read-only`：只读文件系统
- `--tmpfs /tmp`：临时目录（内存文件系统）

### 方式 3：Docker Compose（与主应用一起）

在项目根目录的 `docker-compose.yml` 中已添加 `python-runner` 服务配置。

```bash
# 启动所有服务
docker-compose up -d

# 仅启动 python-runner
docker-compose up -d python-runner
```

## API 接口

### POST /run

执行 Python 代码。

**请求：**
```json
{
  "code": "import numpy as np\nprint(np.array([1,2,3]))"
}
```

**响应：**
```json
{
  "success": true,
  "stdout": "[1 2 3]\n",
  "stderr": "",
  "images": [],
  "error": ""
}
```

**matplotlib 示例：**
```json
{
  "code": "import matplotlib.pyplot as plt\nplt.plot([1,2,3])\nplt.title('Test')"
}
```

响应中 `images` 数组将包含 base64 编码的 PNG 图像。

**seaborn 热图示例：**
```json
{
  "code": "import numpy as np\nimport seaborn as sns\nimport matplotlib.pyplot as plt\n\nA = np.array([[1.0, 0.9, 0.1], [0.9, 1.0, -0.3], [0.1, -0.3, 1.0]])\nfig, ax = plt.subplots(figsize=(4, 3))\nsns.heatmap(A, annot=True, fmt='.2f', cmap='coolwarm', center=0,\n            xticklabels=['a','b','c'], yticklabels=['a','b','c'], ax=ax)\nax.set_title('Correlation Matrix')"
}
```

**PySCF H2 STO-3G Hartree-Fock 示例：**
```json
{
  "code": "from pyscf import gto, scf\n\nmol = gto.Mole()\nmol.atom = 'H 0 0 0; H 0 0 0.74'\nmol.basis = 'sto-3g'\nmol.build()\n\nmf = scf.RHF(mol)\nenergy = mf.kernel()\nprint(f'HF energy: {energy:.6f} Hartree')\nprint(f'Converged: {mf.converged}')"
}
```

### GET /health

健康检查。

**响应：**
```json
{
  "status": "ok",
  "service": "python-runner"
}
```

## 环境变量

无需配置环境变量，服务默认监听 `0.0.0.0:8001`。

## 安全注意事项

⚠️ **此服务执行任意用户代码，存在安全风险。**

建议部署时采取以下措施：

1. **网络隔离**：不要暴露到公网，仅允许 Next.js 应用访问
2. **容器隔离**：使用 Docker 运行，设置资源限制
3. **身份验证**：在 Next.js API 层验证用户身份
4. **代码审计**（可选）：记录执行的代码用于审计
5. **限流**：限制单个用户的执行频率

## 故障排查

### 服务无法启动

检查端口 8001 是否被占用：
```bash
lsof -i :8001
```

### 代码执行超时

默认 15 秒超时，可在 `app.py` 中修改 `EXECUTION_TIMEOUT` 常量。

### matplotlib 图像不显示

确保代码中调用了 `plt.plot()` 等绘图函数。不需要调用 `plt.show()`。

## 开发

运行测试：
```bash
curl -X POST http://localhost:8001/run \
  -H "Content-Type: application/json" \
  -d '{"code":"print(\"Hello from Python Runner\")"}'
```
