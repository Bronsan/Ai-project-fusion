# ProjectFusion · 项目融合工坊

> An AI-powered open-source project fusion workbench with built-in API key, adaptability scoring, security review, and intelligent code merging.
> 一款内置 AI 与 API Key 的开源项目智能融合工坊，提供适配性评分、安全审查与代码拼接能力。

---

## ✨ Features / 功能特性

### English

- **Built-in AI with API Key** — Ships with a built-in API key (demo mode) and supports custom keys for production use.
- **Multi-Project Fusion** — Select at least 2 open-source projects to fuse into one.
- **Adaptability Scoring** — 5-dimension scoring (architecture, dependencies, license, code style, docs) with a 75-point threshold.
- **AI Thinking Process** — A large language model analyzes project structures and produces a fusion plan.
- **Security Review** — Rule-based scanning plus AI deep inspection for dependency, license, and injection risks.
- **Automatic Code Merging** — When the score exceeds 75, the system automatically generates the fused project file tree and runs a verification pass.
- **Glassmorphism UI** — Apple-inspired design with aurora gradients, glass cards, 3D hover tilt, and fluid animations.
- **Bilingual README & Chinese Code Comments** — Full English/Chinese documentation and concise Chinese comments throughout the codebase.

### 中文

- **内置 AI 与 API Key** — 自带演示用 API Key，同时支持用户自定义 Key 接入生产模型。
- **多项目融合** — 最少选择两个开源项目，融合为一个新项目。
- **适配性评分** — 五维度评分（架构兼容性、依赖冲突、许可证、代码风格、文档完整度），75 分为融合阈值。
- **AI 思考流程** — 大模型分析项目结构，输出融合规划与思考步骤。
- **安全审查** — 规则扫描 + AI 深度审查，识别依赖漏洞、许可证冲突与代码注入风险。
- **自动代码拼接** — 评分高于 75 分时自动生成融合项目文件树，并运行二次校验思考流程。
- **玻璃质感界面** — 苹果风格设计，极光渐变背景、玻璃卡片、3D 悬停倾斜与流光动画。
- **双语 README 与中文注释** — 完整中英文文档，代码内附清晰简洁的中文注释。

---

## 🧠 Fusion Workflow / 融合流程

```
Select ≥2 projects → Preview scoring → Configure strategy & API Key
  → AI thinking process → Security review → Formal adaptability scoring
  → Score > 75? → Code merging → Verification thinking → Output report & artifacts
```

```
选择 ≥2 个项目 → 预评分 → 配置策略与 API Key
  → AI 思考流程 → 安全审查 → 适配性正式评分
  → 评分 > 75？ → 代码拼接 → 二次校验 → 输出报告与产物
```

---

## 🛠 Tech Stack / 技术栈

| Layer / 层 | Technology / 技术 |
|---|---|
| Frontend / 前端 | React 18 + TypeScript + Vite + Tailwind CSS 3 |
| State / 状态管理 | Zustand |
| Animation / 动画 | Framer Motion + CSS Keyframes |
| Icons / 图标 | lucide-react |
| Backend / 后端 | Express 4 + TypeScript (ESM) |
| Storage / 存储 | In-memory + JSON file persistence |
| AI / 大模型 | OpenAI-compatible API (built-in key + custom key) |

---

## 🚀 Quick Start / 快速开始

### Prerequisites / 前置条件

- Node.js >= 18
- npm (or pnpm)

### Install & Run / 安装与运行

```bash
# Install dependencies / 安装依赖
npm install

# Start dev server (frontend + backend) / 启动开发服务器（前端 + 后端）
npm run dev
```

- Frontend / 前端: http://localhost:5173
- Backend / 后端: http://localhost:3001

### Build / 构建

```bash
npm run build      # Type check + production build / 类型检查 + 生产构建
npm run check      # TypeScript type check only / 仅类型检查
```

---

## 🔑 API Key Configuration / API Key 配置

The project ships with a built-in demo API key. For production use, configure via environment variables:

项目自带演示用 API Key。生产环境请通过环境变量配置：

```bash
# .env
AI_API_KEY=sk-your-real-key
AI_MODEL=gpt-4o-mini
AI_BASE_URL=https://api.openai.com/v1
```

Users can also input a custom API key on the **Configure** page, which overrides the built-in key.

用户也可在「融合配置」页输入自定义 API Key，将覆盖内置 Key。

> When the AI API is unreachable, the system automatically falls back to a local simulation mode so the demo flow never breaks.
> 当 AI 接口不可达时，系统会自动降级为本地模拟模式，保证演示流程不中断。

---

## 📁 Project Structure / 项目结构

```
.
├── api/                    # Backend / 后端
│   ├── data/               # JSON data store / JSON 数据存储
│   │   ├── projects.json   # Project library / 项目库
│   │   └── tasks.json      # Fusion task records / 融合任务记录
│   ├── lib/                # Core engines / 核心引擎
│   │   ├── aiClient.ts     # AI client / AI 客户端
│   │   ├── thinkEngine.ts  # Thinking process / 思考流程引擎
│   │   ├── securityEngine.ts # Security review / 安全审查引擎
│   │   ├── scoreEngine.ts  # Scoring / 评分引擎
│   │   ├── mergeEngine.ts  # Code merging / 拼接引擎
│   │   ├── fusionService.ts # Orchestration / 流程编排
│   │   └── taskRepo.ts     # Task repository / 任务仓库
│   ├── routes/             # API routes / API 路由
│   │   ├── projects.ts
│   │   ├── score.ts
│   │   ├── fusion.ts
│   │   └── ai.ts
│   ├── types.ts            # Shared types / 共享类型
│   ├── app.ts              # Express app / Express 应用
│   └── server.ts           # Server entry / 服务器入口
├── src/                    # Frontend / 前端
│   ├── components/         # Reusable components / 通用组件
│   │   ├── AuroraBackground.tsx
│   │   ├── GlassCard.tsx
│   │   ├── Navbar.tsx
│   │   ├── CountUp.tsx
│   │   ├── RadarChart.tsx
│   │   └── FileTree.tsx
│   ├── pages/              # Pages / 页面
│   │   ├── Home.tsx        # Workspace / 工作台
│   │   ├── Select.tsx      # Project selection / 项目选择
│   │   ├── Configure.tsx   # Fusion config / 融合配置
│   │   ├── Execute.tsx     # Execution / 融合执行
│   │   └── Report.tsx      # Report / 融合报告
│   ├── lib/                # Utils / 工具
│   │   ├── api.ts          # API wrapper / API 封装
│   │   └── types.ts        # Frontend types / 前端类型
│   ├── store/              # State / 状态
│   │   └── useFusionStore.ts
│   ├── App.tsx             # Root component / 根组件
│   ├── main.tsx            # Entry / 入口
│   └── index.css           # Global styles / 全局样式
└── package.json
```

---

## 📡 API Reference / API 参考

| Method | Endpoint | Description / 说明 |
|---|---|---|
| GET | `/api/projects` | List project library / 获取项目库 |
| GET | `/api/projects/:id` | Get project detail / 获取项目详情 |
| POST | `/api/score/preview` | Preview adaptability score / 预评分 |
| POST | `/api/fusion` | Create fusion task / 创建融合任务 |
| GET | `/api/fusion` | List tasks / 任务列表 |
| GET | `/api/fusion/:taskId` | Get task status & logs / 获取任务状态与日志 |
| GET | `/api/fusion/:taskId/artifacts` | Get artifact file tree / 获取产物文件树 |
| GET | `/api/fusion/:taskId/download` | Download all artifacts / 下载整包 |
| POST | `/api/ai/test` | Test API key / 测试 API Key |
| GET | `/api/health` | Health check / 健康检查 |

---

## 🎨 Design Highlights / 设计亮点

- **Aurora background** — Three floating gradient blobs with 18s loop animation.
- **Glassmorphism** — `backdrop-filter: blur(20px) saturate(180%)` with 1px inner-highlight border.
- **3D card tilt** — Cards rotate based on mouse position with `perspective(1000px)`.
- **CountUp numbers** — Score numbers animate with ease-out-cubic easing.
- **Flowing timeline** — Step nodes light up sequentially with pulsing active state.
- **Streaming logs** — Real-time log entries with color-coded levels.

- **极光背景** — 三个流动渐变光斑，18 秒循环动画。
- **玻璃质感** — `backdrop-filter: blur(20px) saturate(180%)`，1px 内发光边框。
- **3D 卡片倾斜** — 根据鼠标位置旋转，`perspective(1000px)`。
- **数字滚动** — 评分数字以 ease-out-cubic 缓动动画呈现。
- **流光时间线** — 步骤节点依次点亮，当前节点呼吸放大。
- **流式日志** — 实时日志条目，按级别着色。

---

## 📄 License / 许可证

MIT
