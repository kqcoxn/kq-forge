# DeerFlow (bytedance/deer-flow) 深度研究报告

## 项目概览

| 属性 | 详情 |
|------|------|
| **全称** | **D**eep **E**xploration and **E**fficient **R**esearch **Flow** |
| **版本** | 2.0（完全重写，与 v1 无共享代码） |
| **开源协议** | MIT |
| **语言** | Python 3.12+ (后端) / Node.js 22+ (前端) |
| **Stars** | ~67.8k |
| **Forks** | ~9k |
| **Commits** | 2,103 |
| **核心作者** | Daniel Walnut (hetaoBackend), Henry Li (magiccube) |
| **官网** | https://deerflow.tech |
| **仓库地址** | https://github.com/bytedance/deer-flow |

---

## 一、设计思想 / Design Philosophy

### 1.1 核心理念：从深度研究到超级智能体运行时

DeerFlow 最初是一个 **Deep Research（深度研究）框架**，但社区将其推向了远超研究的领域——构建数据管道、生成幻灯片、搭建仪表盘、自动化内容工作流。这让团队意识到：DeerFlow 不仅仅是研究工具，而是一个 **Harness（运行时基座）**——一个为智能体提供基础设施以真正完成工作的运行时。

因此 2.0 版本从零重写，定位为：

> **Super Agent Harness（超级智能体运行时基座）**——开箱即用、完全可扩展。基于 LangGraph 和 LangChain 构建，开箱即提供智能体所需的一切：文件系统、记忆、技能、沙箱感知执行，以及为复杂多步骤任务规划和生成子智能体的能力。

### 1.2 "SuperAgent" 概念

DeerFlow 的 "SuperAgent" 不是单一的大模型调用，而是一个 **编排层**（Orchestration Layer）：

- **Lead Agent（主智能体）**：统一入口，负责理解任务、规划、调度
- **Sub-Agents（子智能体）**：按需动态生成，各自拥有独立上下文、工具集和终止条件
- **Skills（技能）**：结构化能力模块，按需渐进加载
- **Sandbox（沙箱）**：每个任务拥有独立的执行环境和文件系统
- **Memory（记忆）**：跨会话持久化用户偏好和知识
- **Message Gateway（消息网关）**：统一的 API 入口和 IM 渠道桥接

### 1.3 解决的核心问题

| 问题 | DeerFlow 的解决方案 |
|------|-------------------|
| 智能体只能"说"不能"做" | 提供完整的沙箱执行环境（文件系统 + Shell + Docker 隔离） |
| 单次对话无法处理复杂任务 | 子智能体并行分解 + 上下文摘要 + 长期记忆 |
| 上下文窗口爆炸 | 激进的上下文工程：摘要、隔离、渐进式技能加载 |
| 工具扩展困难 | MCP 协议 + 自定义 Python 函数 + 技能系统 |
| 会话结束即遗忘 | 本地持久化记忆系统（用户画像 + 事实库） |
| 部署复杂 | Docker Compose 一键部署 + 交互式 setup wizard |
| 模型锁定 | 模型无关设计，支持任何 OpenAI 兼容 API |

### 1.4 设计原则

1. **Batteries Included（开箱即用）**：不再是需要自己组装的框架，而是完整的运行时
2. **Fully Extensible（完全可扩展）**：技能、工具、模型、沙箱提供者均可替换
3. **Context-Aware（上下文感知）**：18 层中间件链精细管理上下文生命周期
4. **Isolation-First（隔离优先）**：per-thread 目录、per-user 记忆、per-subagent 上下文
5. **Progressive Loading（渐进加载）**：技能按需加载，不浪费 token 预算

---

## 二、核心特性 / Core Features

### 2.1 Skills（技能系统）

技能是 DeerFlow 能"做几乎任何事"的关键。

**技能定义**：
- 格式：一个包含 `SKILL.md` 的目录（YAML frontmatter 定义名称、描述、许可证、允许的工具）
- 本质：结构化的能力模块——一个 Markdown 文件定义工作流、最佳实践和支持资源的引用

**内置技能**：
- `research/SKILL.md` — 研究
- `report-generation/SKILL.md` — 报告生成
- `slide-creation/SKILL.md` — 幻灯片创建
- `web-page/SKILL.md` — 网页生成
- `image-generation/SKILL.md` — 图像生成
- `claude-to-deerflow/SKILL.md` — Claude Code 集成

**技能路径**：
```
/mnt/skills/public
├── research/SKILL.md
├── report-generation/SKILL.md
├── slide-creation/SKILL.md
├── web-page/SKILL.md
└── image-generation/SKILL.md

/mnt/skills/custom
└── your-custom-skill/SKILL.md      ← 用户自定义
```

**关键特性**：
- **渐进加载**：仅在任务需要时加载，保持上下文窗口精简
- **可扩展**：用户可添加自定义技能到 `skills/custom/` 目录
- **安装机制**：通过 `POST /api/skills/install` 安装 `.skill` ZIP 压缩包
- **状态管理**：通过 `extensions_config.json` 管理启用/禁用状态

### 2.2 Tools（工具系统）

| 类别 | 工具 | 说明 |
|------|------|------|
| **沙箱工具** | `bash` | 命令执行（路径翻译 + 错误处理） |
| | `ls` | 目录列表（树格式，最多 2 层） |
| | `read_file` | 读取文件（支持行范围） |
| | `write_file` | 写入/追加文件（自动创建目录） |
| | `str_replace` | 子串替换（单次或全部） |
| **内置工具** | `present_files` | 将输出文件展示给用户 |
| | `ask_clarification` | 请求用户澄清（触发中断） |
| | `view_image` | 读取图像为 base64 |
| | `task` | 委派任务给子智能体 |
| | `setup_agent` | 引导模式：持久化新自定义智能体 |
| | `update_agent` | 自定义智能体自我更新 |
| **社区工具** | Tavily | 网页搜索 + 网页抓取 |
| | Jina AI | 通过 Jina Reader API 抓取网页 |
| | Firecrawl | 通过 Firecrawl API 爬取网页 |
| | DuckDuckGo | 图片搜索 |
| **MCP 工具** | 任意 MCP 服务器 | 支持 stdio/SSE/HTTP 传输 |
| **ACP 智能体** | `invoke_acp_agent` | 调用外部 ACP 兼容智能体 |

### 2.3 Sub-Agents（子智能体系统）

**内置子智能体**：
- `general-purpose`：拥有全工具集（除 `task` 外），通用任务处理
- `bash`：命令行专家，仅在 shell 访问可用时暴露

**执行模型**：
- 双线程池：`_scheduler_pool`（3 workers）+ `_execution_pool`（3 workers）
- 并发限制：`MAX_CONCURRENT_SUBAGENTS = 3`
- 超时：15 分钟
- 流程：`task()` 工具 → `SubagentExecutor` → 后台线程 → 每 5 秒轮询 → SSE 事件 → 结果

**事件流**：
- `task_started` → `task_running` → `task_completed` / `task_failed` / `task_timed_out`

### 2.4 Sandbox & File System（沙箱与文件系统）

**文件系统视图**：
```
/mnt/user-data/
├── uploads/          ← 用户上传的文件
├── workspace/        ← 智能体工作目录
└── outputs/          ← 最终交付物

/mnt/skills/          ← 技能目录
/mnt/acp-workspace/   ← ACP 智能体工作区（只读）
```

**三种沙箱模式**：

| 模式 | 说明 | 安全性 |
|------|------|--------|
| Local Execution | 直接在宿主机执行 | bash 默认禁用，仅文件工具映射到 per-thread 目录 |
| Docker Execution | 在隔离的 Docker 容器中执行 | 完全隔离 |
| Docker + Kubernetes | 通过 Provisioner 服务在 K8s Pod 中执行 | 生产级隔离 |

**虚拟路径系统**：
- 智能体看到：`/mnt/user-data/{workspace,uploads,outputs}`、`/mnt/skills`
- 物理映射：`backend/.deer-flow/users/{user_id}/threads/{thread_id}/user-data/...`
- 翻译函数：`replace_virtual_path()` / `replace_virtual_paths_in_command()`

### 2.5 Long-Term Memory（长期记忆）

**数据结构**（存储在 `{base_dir}/users/{user_id}/memory.json`）：
```json
{
  "userContext": {
    "workContext": "...",
    "personalContext": "...",
    "topOfMind": "..."
  },
  "history": {
    "recentMonths": "...",
    "earlierContext": "...",
    "longTermBackground": "..."
  },
  "facts": [
    {
      "id": "...",
      "content": "用户偏好使用 TypeScript",
      "category": "preference",
      "confidence": 0.9,
      "createdAt": "...",
      "source": "..."
    }
  ]
}
```

**工作流程**：
1. `MemoryMiddleware` 过滤消息，捕获 `user_id`
2. 队列去抖（默认 30 秒），批量处理
3. 后台线程调用 LLM 提取上下文更新和事实
4. 原子写入（临时文件 + 重命名）+ 缓存失效
5. 下次交互将前 15 条事实 + 上下文注入系统提示的 `<memory>` 标签

**配置项**：
- `debounce_seconds` — 处理前等待时间（默认 30）
- `max_facts` / `fact_confidence_threshold` — 事实存储限制（100 / 0.7）
- `max_injection_tokens` — 提示注入 token 限制（2000）

### 2.6 Context Engineering（上下文工程）

- **隔离子智能体上下文**：每个子智能体在独立上下文中运行
- **摘要机制**：激进管理上下文——摘要已完成子任务、卸载中间结果到文件系统
- **严格 Tool-Call 恢复**：为悬挂调用注入占位符工具结果
- **循环检测**：`LoopDetectionMiddleware` 检测重复工具调用循环并强制终止

### 2.7 IM Channels（即时通讯渠道）

所有渠道自动启动——无需公网 IP：

| 渠道 | 传输方式 |
|------|---------|
| Telegram | Bot API (长轮询) |
| Slack | Socket Mode |
| 飞书 / Lark | WebSocket |
| 微信 | 腾讯 iLink (长轮询) |
| 企业微信 | WebSocket |
| 钉钉 | Stream Push (WebSocket) |

### 2.8 其他特性

- **文件上传**：多文件上传，自动转换 PDF/PPT/Excel/Word（通过 `markitdown`）
- **Plan Mode（计划模式）**：TodoList 中间件用于复杂多步骤任务跟踪
- **Vision Support（视觉支持）**：支持视觉模型的图像理解
- **LangSmith / Langfuse 双可观测性**：所有 LLM 调用均可追踪
- **Guardrail（护栏）**：可插拔的 `GuardrailProvider` 协议
- **Claude Code 集成**：通过 `claude-to-deerflow` 技能直接从 Claude Code 终端交互

---

## 三、实现架构 / Implementation Architecture

### 3.1 整体架构图

```
┌──────────────────────────────────────────────────────────────┐
│                    Nginx (Port 2026)                          │
│                 统一反向代理入口                                │
└───────┬────────────────────┬─────────────────┬───────────────┘
        │                    │                 │
  /api/langgraph/*     /api/* (其他)          / (非API)
        ▼                    ▼                 ▼
┌────────────────────────────────────┐   ┌──────────────┐
│      Gateway API (Port 8001)       │   │   Frontend   │
│      FastAPI REST + Agent Runtime  │   │   Next.js    │
│                                    │   │   Port 3000  │
│  ┌──────────────────────────────┐  │   └──────────────┘
│  │         Lead Agent           │  │
│  │  ┌────────────────────────┐  │  │
│  │  │   18-Layer Middleware  │  │  │
│  │  │        Chain           │  │  │
│  │  └────────────────────────┘  │  │
│  │  ┌─────┐ ┌─────┐ ┌──────┐  │  │
│  │  │Tools│ │ MCP │ │Skills│  │  │
│  │  └─────┘ └─────┘ └──────┘  │  │
│  │  ┌────────────────────────┐  │  │
│  │  │     Sub-Agents         │  │  │
│  │  │  (max 3 concurrent)   │  │  │
│  │  └────────────────────────┘  │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────┐  ┌────────┐         │
│  │  Memory  │  │Sandbox │         │
│  │  System  │  │Provider│         │
│  └──────────┘  └────────┘         │
│                                    │
│  ┌──────────────────────────────┐  │
│  │      IM Channels Bridge      │  │
│  │ Telegram|Slack|飞书|微信|钉钉 │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
         │
         ▼ (可选)
┌────────────────────┐
│ Provisioner (8002) │
│ K8s Sandbox Pods   │
└────────────────────┘
```

### 3.2 Harness / App 分层架构

后端严格分为两层，单向依赖：

```
┌─────────────────────────────────────────────┐
│  App Layer (app/*)                           │
│  - FastAPI Gateway API                       │
│  - IM Channel Integrations                   │
│  - 不可发布，应用特定代码                      │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │  Harness Layer (deerflow.*)             │ │
│  │  - Agent Orchestration                  │ │
│  │  - Tools, Sandbox, Models               │ │
│  │  - MCP, Skills, Config                  │ │
│  │  - 可独立发布为 deerflow-harness 包      │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘

依赖方向：App → Harness（允许）
          Harness → App（禁止，CI 强制执行）
```

### 3.3 中间件链（18 层，严格顺序）

| # | 中间件 | 职责 |
|---|--------|------|
| 1 | `ThreadDataMiddleware` | 创建 per-thread 隔离目录 |
| 2 | `UploadsMiddleware` | 注入新上传文件到对话 |
| 3 | `SandboxMiddleware` | 获取沙箱，存储 `sandbox_id` |
| 4 | `DanglingToolCallMiddleware` | 为缺少响应的工具调用注入占位符 |
| 5 | `LLMErrorHandlingMiddleware` | 规范化 LLM 调用失败 |
| 6 | `GuardrailMiddleware` | 工具调用前授权检查 |
| 7 | `SandboxAuditMiddleware` | 沙箱操作安全审计日志 |
| 8 | `ToolErrorHandlingMiddleware` | 工具异常转为错误 ToolMessage |
| 9 | `SummarizationMiddleware` | 接近 token 限制时上下文压缩 |
| 10 | `TodoListMiddleware` | 计划模式任务跟踪 |
| 11 | `TokenUsageMiddleware` | Token 使用量记录 |
| 12 | `TitleMiddleware` | 自动生成对话标题 |
| 13 | `MemoryMiddleware` | 异步记忆更新队列 |
| 14 | `ViewImageMiddleware` | LLM 调用前注入 base64 图像数据 |
| 15 | `DeferredToolFilterMiddleware` | 隐藏延迟工具模式 |
| 16 | `SubagentLimitMiddleware` | 截断超额 task 工具调用 |
| 17 | `LoopDetectionMiddleware` | 检测重复工具调用循环 |
| 18 | `ClarificationMiddleware` | 拦截澄清请求，中断流程 |

### 3.4 核心技术栈

| 技术 | 版本要求 | 用途 |
|------|---------|------|
| **LangGraph** | 1.0.6+ | 智能体框架与多智能体编排 |
| **LangChain** | 1.2.3+ | LLM 抽象与工具系统 |
| **FastAPI** | 0.115.0+ | Gateway REST API |
| **langchain-mcp-adapters** | - | Model Context Protocol 支持 |
| **agent-sandbox** | - | 沙箱代码执行 |
| **markitdown** | - | 多格式文档转换 |
| **tavily-python** | - | 网页搜索 |
| **firecrawl-py** | - | 网页爬取 |
| **Next.js** | - | 前端 Web 界面 |
| **Nginx** | - | 统一反向代理 |
| **Docker / Docker Compose** | - | 容器化部署与沙箱隔离 |
| **uv** | - | Python 包管理器 |
| **pnpm** | - | Node.js 包管理器 |

### 3.5 模型工厂（Model Factory）

- `create_chat_model(name, thinking_enabled)` 通过反射从配置实例化 LLM
- 支持 `thinking_enabled` 标志 + per-model 覆盖
- 支持 `supports_vision` 标志用于图像理解模型
- 配置值以 `$` 开头自动解析为环境变量

**支持的模型提供者**：
- `langchain_openai:ChatOpenAI` — OpenAI、OpenRouter、任何 OpenAI 兼容 API
- `deerflow.models.vllm_provider:VllmChatModel` — vLLM 本地部署
- `deerflow.models.openai_codex_provider:CodexChatModel` — Codex CLI
- `deerflow.models.claude_provider:ClaudeChatModel` — Claude Code OAuth

### 3.6 配置系统

**双配置文件架构**：

| 文件 | 内容 | 热重载 |
|------|------|--------|
| `config.yaml` | 模型、工具、沙箱、技能、记忆、摘要、子智能体、IM 渠道 | 是（mtime 检测） |
| `extensions_config.json` | MCP 服务器配置、技能启用状态 | 是（mtime 检测） |

---

## 四、内容概况 / Content Overview

### 4.1 仓库顶层结构

```
deer-flow/
├── .agent/skills/smoke-test/       # Agent 技能冒烟测试
├── .github/                        # GitHub Actions CI/CD 工作流
├── backend/                        # 后端应用（Python 3.12+）
│   ├── packages/harness/           # deerflow-harness 核心包
│   │   └── deerflow/
│   │       ├── agents/             # 智能体定义
│   │       ├── middleware/         # 18 层中间件
│   │       ├── models/             # 模型工厂 + 提供者
│   │       ├── tools/              # 工具实现
│   │       ├── sandbox/            # 沙箱抽象
│   │       ├── skills/             # 技能加载器
│   │       ├── memory/             # 记忆系统
│   │       ├── mcp/                # MCP 集成
│   │       └── config/             # 配置管理
│   ├── app/                        # 应用层
│   │   ├── api/                    # FastAPI 路由
│   │   ├── channels/              # IM 渠道桥接
│   │   └── auth/                  # 认证
│   ├── skills/                     # 内置技能
│   │   ├── public/                # 公共技能
│   │   └── custom/                # 自定义技能
│   └── tests/                      # 测试
├── web/                            # 前端（Next.js）
├── provisioner/                    # K8s 沙箱 Provisioner
├── docker/                         # Docker 配置
├── nginx/                          # Nginx 配置
├── config.yaml.example             # 配置示例
├── extensions_config.json.example  # 扩展配置示例
├── docker-compose.yaml             # 一键部署
├── Makefile                        # 开发命令
├── CLAUDE.md                       # 架构指南
└── README.md                       # 项目说明
```

### 4.2 规模统计

| 组件 | 数量/规模 |
|------|-----------|
| 中间件层 | 18 |
| 内置技能 | 6 |
| 内置工具 | 11+ |
| IM 渠道 | 6 |
| 沙箱模式 | 3 |
| 模型提供者 | 4 |
| 子智能体并发 | 3 |
| 配置热重载 | 是 |

---

## 五、独特差异化 / Unique Differentiators

### 5.1 与其他 Harness 的对比

| 维度 | DeerFlow | Superpowers | ECC |
|------|----------|-------------|-----|
| **本质** | 完整运行时 + Web 应用 | 纯文档/方法论 | 配置集 + Hook 脚本 |
| **部署形态** | 独立服务（Docker） | 插件注入 | 插件注入 |
| **沙箱** | 有（Docker/K8s） | 无 | 无 |
| **记忆** | 有（持久化） | 无 | 有（Hook 驱动） |
| **IM 集成** | 6 个渠道 | 无 | 无 |
| **前端** | Next.js Web UI | 无 | Tkinter 仪表板 |
| **模型无关** | 是 | 是（跨平台） | 部分（主要 Claude） |
| **目标用户** | 团队/企业 | 个人开发者 | 个人开发者 |

### 5.2 核心差异化

1. **真正的运行时，不是配置集** — DeerFlow 是一个可独立部署的服务，有自己的 API、前端、数据库和沙箱，而不是注入到其他工具中的配置文件

2. **沙箱隔离** — 三级沙箱（本地/Docker/K8s）提供从开发到生产的完整安全隔离，这是其他 Harness 完全没有的能力

3. **18 层中间件架构** — 精细的横切关注点管理，每一层都有明确职责，严格顺序执行

4. **Harness/App 分层** — 核心编排逻辑（Harness）与应用逻辑（App）严格分离，Harness 可独立发布为 pip 包

5. **IM 渠道桥接** — 原生支持 6 个即时通讯平台，无需公网 IP，这使得 DeerFlow 可以作为团队的"AI 同事"存在于日常沟通工具中

6. **字节跳动背景** — 来自大厂的工程实践，架构设计考虑了生产环境的可扩展性、可观测性和安全性

7. **虚拟文件系统** — 智能体看到的是虚拟路径（`/mnt/...`），物理路径完全隔离，这种抽象使得沙箱切换对智能体透明

---

## 六、总结

DeerFlow 代表了 Agent Harness 的"平台化"路线——它不是一个插件或配置集，而是一个完整的、可独立部署的智能体运行时平台。它的核心贡献在于：

1. 证明了"智能体需要自己的计算机"这一理念——沙箱不是可选的，而是必需的
2. 18 层中间件架构为上下文工程提供了精细的控制粒度
3. Harness/App 分层使核心编排逻辑可复用
4. IM 渠道桥接将智能体从"开发工具"提升为"团队成员"

对于想要构建面向团队/企业的 Agent Harness 的开发者，DeerFlow 的架构设计是最值得参考的范本。
