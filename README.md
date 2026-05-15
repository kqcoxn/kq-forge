# KQ-Forge

**以人为本，因地制宜，实事求是。**

KQ-Forge 是一套模块化的 AI 编码代理 Harness（运行时协作框架）。它不替代任何 AI 工具，而是在你选择的工具之上，为人与 AI 的协作提供结构化的协议层——让每个项目都能拥有量身定制的开发工作流。

---

## 为什么需要 KQ-Forge

AI 编码代理已经足够强大，但在实际项目中仍然频繁失败。我们调研了当前最流行的 Agent Harness 项目后发现，失败的根因不是单一的：

- 有时是 Agent 缺乏纪律，跳过设计直接写代码
- 有时是上下文丢失，跨会话知识无法延续
- 有时是人机不对齐，AI 做的不是人想要的
- 有时是质量失控，没有有效的收敛机制

现有方案各自解决了其中一部分问题，但都带有强烈的哲学预设——要么全自动（"人类介入是失败"），要么全约束（"没有测试不许写代码"）。

**KQ-Forge 的立场是：没有银弹，因地制宜。**

不同的项目、不同的阶段、不同的任务，需要不同程度的人机协作模式。一个探索性原型和一个生产级服务，不应该用同一套规则。

---

## 核心理念

### 可开关的自动驾驶

KQ-Forge 定义了四个自动化等级，可在配置中随时切换：

| 等级 | 模式 | 人类角色 | 适用场景 |
|------|------|---------|---------|
| **L0** | 全手动 | Agent 建议，人执行 | 高风险变更、架构决策 |
| **L1** | 半自动 | Agent 执行，关键节点等人确认 | 常规功能开发 |
| **L2** | 监督自动 | Agent 全自动，人异步 review | 批量任务、重构 |
| **L3** | 全自动 | Agent 自主完成，仅失败时通知 | 机械性任务、格式化 |

等级不是全局固定的——同一个项目中，不同的 Agent 可以运行在不同等级。

### 实事求是的错误观

人会犯错，AI 也不例外。KQ-Forge 不试图预防一切错误，而是建立**即时反思机制**：

1. 犯错后立即定位具体原因（而非笼统归因）
2. 根据原因类型选择对应调整策略
3. 将教训沉淀为记忆或范式，避免重复犯错

### 对抗性质量收敛

质量不靠单方面的自律，靠对抗：

```
Writer（执行者）→ Reviewer（审查者）→ Judge（裁决者）
   ↑                                      │
   └──────── 修改指令 ←────────────────────┘
```

- **Acceptance Criteria**：每个任务开始前定义验收标准
- **Round Cap**：对抗轮次有上限，防止无限循环
- 三角关系确保没有角色能自我欺骗

### 复利知识工程

知识分两层管理：

| 层级 | 名称 | 形态 | 触发方式 | 作用 |
|------|------|------|---------|------|
| **记忆** | Memory | 文件（规则/约束/事实） | 主动沉淀 | 跨会话延续上下文 |
| **范式** | Paradigm | Agent 配置 | 手动提炼 | 生成专家级子 Agent |

记忆是具体的："这个项目用 pnpm"、"auth 模块上次改动导致了 regression"。
范式是抽象的："这个项目的 API 总是先写 schema 再写 handler"——提炼后直接生成一个懂这套模式的专家 Agent。

---

## 架构

### 文件结构

```
your-project/
├── .kqforge/                    # KQ-Forge 工作目录
│   ├── config.yaml              # 核心配置（人机模式、默认工作流等）
│   ├── agents/                  # Agent 定义
│   │   ├── lead.md              # 主编排 Agent
│   │   ├── implementer.md       # 实现者
│   │   ├── reviewer.md          # 审查者
│   │   ├── judge.md             # 裁决者
│   │   └── {custom}.md          # 项目自定义 Agent
│   ├── skills/                  # 技能定义
│   │   ├── design.md
│   │   ├── implement.md
│   │   ├── review.md
│   │   ├── debug.md
│   │   └── {custom}.md
│   ├── workflows/               # 工作流定义（可切换）
│   │   ├── feature.md           # 功能开发流
│   │   ├── bugfix.md            # 缺陷修复流
│   │   ├── refactor.md          # 重构流
│   │   └── {custom}.md
│   ├── memory/                  # 记忆存储
│   │   ├── rules.md             # 项目规则与约束
│   │   ├── facts.md             # 事实记录
│   │   └── lessons.md           # 教训沉淀
│   └── paradigms/               # 范式（提炼后的专家 Agent）
│       └── {name}.md
├── AGENTS.md                    # 入口文件（指向 .kqforge/config.yaml）
└── ...                          # 项目其他文件
```

### Agent 模型

每个 Agent 有明确的管辖范围和绑定的强制 Skills：

```yaml
# .kqforge/agents/implementer.md (frontmatter)
name: implementer
scope: src/**                     # 管辖范围
autonomy: L1                      # 默认自动化等级
required_skills:                  # 强制绑定（垂直领域/约束类）
  - implement
  - test-first
optional_skills:                  # 按需引用
  - debug
  - refactor
```

Agent 的强制 skills 是它的"底线"——无论什么工作流调用它，这些 skills 的约束始终生效。可选 skills 则按任务需要动态加载。

### 工作流编排

工作流定义"谁在什么时候做什么"：

```yaml
# .kqforge/workflows/feature.md (frontmatter)
name: feature
description: 标准功能开发流程
steps:
  - agent: lead
    action: decompose          # 任务分解
  - agent: implementer
    action: implement          # 实现
    autonomy: L1               # 可覆盖 Agent 默认等级
  - agent: reviewer
    action: review             # 审查
  - agent: judge
    action: judge              # 裁决
    round_cap: 3               # 最多 3 轮对抗
  - agent: lead
    action: reflect            # 反思沉淀
```

工作流可通过 `/workflow feature` 或 `/workflow bugfix` 随时切换。

### 配置中心

```yaml
# .kqforge/config.yaml
version: 1
project:
  name: my-project
  description: 项目简述

defaults:
  autonomy: L1                   # 默认自动化等级
  workflow: feature              # 默认工作流
  round_cap: 3                   # 默认对抗轮次上限

platforms:                       # 已启用的平台
  - claude-code
  - opencode

memory:
  auto_capture: true             # 自动捕获记忆
  reflect_on_error: true         # 错误后强制反思
```

---

## 安装

### 快速开始

```bash
# 在项目根目录初始化（指定平台）
npx kq-forge init --platform claude-code

# 多平台
npx kq-forge init --platform claude-code --platform opencode

# 后续添加平台
npx kq-forge add-platform codex
```

### 安装内容

`init` 命令只安装核心 base 包，包含：

- 基础配置文件（`config.yaml`）
- 入口文件（`AGENTS.md`）
- 核心 Agent 定义（lead / implementer / reviewer / judge）
- 核心 Skills（design / implement / review / debug / reflect）
- 默认工作流（feature / bugfix）

### 添加场景包

```bash
# 添加前端开发场景包
npx kq-forge add frontend

# 添加 API 开发场景包
npx kq-forge add api

# 添加数据管道场景包
npx kq-forge add data-pipeline

# 查看可用场景包
npx kq-forge list-packages
```

场景包会添加对应的 Agent、Skills 和 Workflows，但不会覆盖已有配置。

---

## 使用方式

### 日常操作

```bash
# 切换工作流
/workflow feature
/workflow bugfix
/workflow refactor

# 切换自动化等级（全局）
/autonomy L2

# 切换单个 Agent 的等级
/autonomy implementer L3

# 触发记忆沉淀
/remember "这个项目的 API 响应统一用 envelope 格式"

# 提炼范式（从记忆中生成专家 Agent）
/evolve api-expert

# 查看当前状态
/status
```

### 自定义 Agent

在 `.kqforge/agents/` 下创建新文件即可：

```markdown
---
name: api-designer
scope: src/api/**
autonomy: L1
required_skills:
  - design
  - api-conventions
optional_skills:
  - implement
---

你是 API 设计专家。你的职责是...
```

### 自定义工作流

在 `.kqforge/workflows/` 下创建新文件：

```markdown
---
name: spike
description: 技术探针，快速验证可行性
steps:
  - agent: lead
    action: scope
    autonomy: L2
  - agent: implementer
    action: prototype
    autonomy: L3
  - agent: lead
    action: summarize
---

这是一个轻量级探索流程...
```

### 自定义 Skill

在 `.kqforge/skills/` 下创建新文件：

```markdown
---
name: api-conventions
description: 本项目的 API 设计约定
type: constraint                  # constraint | capability | workflow
---

## 规则

1. 所有 API 响应使用 envelope 格式：`{ data, error, meta }`
2. 错误码使用 HTTP 标准状态码
3. 分页使用 cursor-based pagination
...
```

---

## 设计原则

| 原则 | 含义 |
|------|------|
| **项目级** | 只在项目工作目录运行，无全局污染 |
| **模块化** | 核心精简，按需扩展，场景包增量添加 |
| **强自定义** | 一切皆可配置，配置即文档，文档即配置 |
| **平台无关** | 支持多 AI 工具，不绑定单一平台 |
| **轻量化** | 不自带 MCP，不引入重依赖，允许 IDE/Agent 自行调用外部工具 |
| **必须扩展** | 框架是脚手架，项目必须根据自身情况添加 Agent/Skill/Workflow |

---

## 与现有方案的对比

| 维度 | KQ-Forge | Superpowers | ECC | DeerFlow | OpenSpec |
|------|----------|-------------|-----|----------|---------|
| **哲学** | 因地制宜 | 纪律至上 | 全覆盖 | 运行时基座 | 规格对齐 |
| **人机模式** | L0-L3 可切换 | 固定约束 | 固定约束 | 固定 | 固定 |
| **形态** | CLI + 项目级配置 | 纯文档插件 | 配置集 | 独立服务 | CLI 工具 |
| **质量机制** | 对抗三角 | TDD 铁律 | Hook 门控 | 中间件链 | 三维验证 |
| **知识管理** | 记忆 + 范式 | 无 | 本能进化 | 持久化记忆 | Delta Specs |
| **扩展性** | 必须扩展 | 插件市场 | 技能库 | 技能 + MCP | Schema 定制 |
| **平台** | 多平台 CLI | 8+ 插件 | Claude 为主 | 独立部署 | 30+ 工具 |

---

## Roadmap

- [ ] Core：base 包实现（config / agents / skills / workflows 骨架）
- [ ] CLI：`init` / `add-platform` / `add` 命令
- [ ] Platform：Claude Code 适配器
- [ ] Platform：OpenCode 适配器
- [ ] Platform：Codex CLI 适配器
- [ ] Package：frontend 场景包
- [ ] Package：api 场景包
- [ ] Memory：记忆捕获与注入机制
- [ ] Paradigm：范式提炼命令
- [ ] Workflow：对抗三角执行引擎

---

## 许可证

MIT
