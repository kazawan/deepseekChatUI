# DeepseekAI 项目 🚀

基于 DeepSeek API 构建的智能对话系统，包含前端界面和后端服务 🤖

## 项目结构 📁

```
deepseekAI/
├── aichat/              # React 前端项目 💻
│   ├── src/             # 源代码
│   ├── public/          # 静态资源
│   └── Dockerfile       # 前端构建文件
│
├── backend/             # Node.js 后端服务 🛠️
│   ├── data/           # 数据存储
│   ├── index.js        # 主服务入口
│   └── Dockerfile      # 后端构建文件
│
├── static_server/       # 静态资源服务器 📦
│   ├── index.js        # 服务器入口
│   └── Dockerfile      # 构建文件
│
└── docker-compose.yml   # Docker 编排配置
```

## 功能特性 ✨

- 🔐 基于 Token 的用户认证系统
- 💬 实时对话功能
- 🎨 美观的用户界面
- 🔄 历史记录保存
- 🛡️ 安全的 API 访问控制

## 环境要求 📋

- Node.js 18+
- Docker & Docker Compose
- DeepSeek API Key

## 快速开始 🚀

1. **克隆项目** 📥
```bash
git clone <repository-url>
cd deepseekAI
```

2. **配置环境变量** ⚙️
```bash
cp .env.example .env
```
编辑 `.env` 文件，填入必要的配置信息：
- DeepSeek API Key
- 端口设置
- 认证信息

3. **启动服务** 🎯
```bash
docker-compose up --build
```

## 访问服务 🌐

- 前端界面: `http://localhost:${FRONTEND_PORT}`
- 后端API: `http://localhost:${BACKEND_PORT}`

## 部署说明 📝

### Docker 部署 🐳

项目使用 Docker 多容器部署，包含三个主要服务：

1. **前端服务** 💻
   - 基于 React + Vite
   - 构建后由静态服务器提供服务
   - 支持环境变量配置

2. **后端服务** 🛠️
   - Node.js Express 服务
   - 处理 DeepSeek API 调用
   - 管理用户 Token

3. **静态服务器** 📦
   - 提供前端静态资源服务
   - 基本认证保护
   - 支持环境变量配置

### 环境变量说明 🔧

```env
# 后端配置
BACKEND_PORT=3000              # 后端服务端口
DEEPSEEK_API_KEY=your-key     # DeepSeek API密钥
INITIAL_TOKEN_BALANCE=1000000  # 初始Token余额

# 前端配置
FRONTEND_PORT=3030            # 前端服务端口
VITE_API_URL=http://localhost:3000  # API地址

# 认证配置
AUTH_USER=your-username       # 静态服务器用户名
AUTH_PASS=your-password       # 静态服务器密码
```

## 开发指南 👨‍💻

### 本地开发

1. **前端开发**
```bash
cd aichat
npm install
npm run dev
```

2. **后端开发**
```bash
cd backend
npm install
npm run dev
```

### 构建部署

使用 Docker Compose 进行构建和部署：
```bash
# 构建所有服务
docker-compose build

# 启动所有服务
docker-compose up

# 后台运行
docker-compose up -d
```

## 注意事项 ⚠️

- 确保 `.env` 文件中的配置正确
- 不要将 API Key 提交到版本控制
- 定期备份 `data` 目录下的数据
- 生产环境部署时建议使用 HTTPS

## 问题反馈 💬

如有问题或建议，请提交 Issue 或 Pull Request 