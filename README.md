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
| **记忆** | Memory | `.kqforge/memory/` 下的 Markdown 文件 | Agent 反思时通过 memory-keeper 写入 | 跨会话延续上下文 |
| **范式** | Paradigm | 平台 agents 目录中的 `paradigm-*.md` | Agent 识别模式后征得用户同意创建 | 生成专家级子 Agent |

记忆是具体的："这个项目用 pnpm"、"auth 模块上次改动导致了 regression"。
范式是抽象的："这个项目的 API 总是先写 schema 再写 handler"——提炼后直接成为一个懂这套模式的专家 Agent。

**记忆读取策略**：Agent 任务开始时，`rules.md` 全文读取（硬约束不可遗漏），`facts.md` 和 `lessons.md` 按当前任务关键词搜索匹配条目。

**记忆清理**：`kq-forge sync` 时自动清理超出 `max_entries_per_file` 的旧条目（FIFO），保持记忆文件精简。

---

## 架构

### 文件结构

安装后，项目目录结构如下：

```
your-project/
├── .kqforge/                        # KQ-Forge 源文件（Single Source of Truth）
│   ├── config.yaml                  # 核心配置
│   ├── AGENTS.template.md           # 入口文件模板（可自定义）
│   ├── custom-rules.md              # 自定义规则（原样注入入口文件）
│   ├── agents/                      # Agent 定义（KQ-Forge 格式）
│   │   ├── lead.md
│   │   ├── implementer.md
│   │   ├── reviewer.md
│   │   ├── judge.md
│   │   └── memory-keeper.md
│   ├── skills/                      # Skill 定义
│   │   ├── design/SKILL.md
│   │   ├── implement/SKILL.md
│   │   ├── review/SKILL.md
│   │   ├── debug/SKILL.md
│   │   ├── reflect/SKILL.md
│   │   └── ...（约束类 + 领域类）
│   ├── workflows/                   # Workflow 定义
│   │   ├── feature.md
│   │   ├── bugfix.md
│   │   └── longmarch.md
│   └── memory/                      # 记忆存储（Agent 运行时读写）
│
├── # ↓↓↓ 以下由平台适配器自动生成 ↓↓↓
│
├── AGENTS.md                        # OpenCode / Codex 入口
├── .opencode/                       # OpenCode 原生格式
│   ├── agents/*.md                  # 含 paradigm-*.md（范式 Agent）
│   ├── skills/<name>/SKILL.md
│   └── workflows/*.md
│
├── CLAUDE.md                        # Claude Code 入口
├── .claude/                         # Claude Code 原生格式
│   ├── settings.json
│   ├── agents/*.md                  # 含 paradigm-*.md（范式 Agent）
│   ├── skills/<name>/SKILL.md
│   └── workflows/*.md
│
└── ...                              # 项目其他文件
```

**核心设计**：`.kqforge/` 是唯一的源文件目录。平台原生文件（`AGENTS.md`、`.opencode/`、`CLAUDE.md`、`.claude/`）由适配器从 `.kqforge/` 转译生成，不应手动编辑。

### Agent 模型

每个 Agent 有明确的管辖范围和绑定的强制 Skills：

```yaml
# .kqforge/agents/implementer.md (frontmatter)
name: implementer
description: 实现者，负责编写代码、修复缺陷、执行技术方案
scope: src/**
autonomy: L1
required_skills:
  - implement
  - test-first
optional_skills:
  - debug
  - refactor
delegates_to: []
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
    action: decompose
  - agent: implementer
    action: implement
    autonomy: L1
  - agent: reviewer
    action: review
  - agent: judge
    action: judge
    round_cap: 3
  - agent: lead
    action: reflect
on_complete: reflect
```

### 平台适配

KQ-Forge 通过适配器将统一的源文件转译为各平台的原生格式：

| 平台 | 入口文件 | 原生目录 | 特点 |
|------|---------|---------|------|
| **OpenCode** | `AGENTS.md` | `.opencode/` | agents + skills + workflows 独立文件 |
| **Claude Code** | `CLAUDE.md` | `.claude/` | subagents + skills + workflows + settings.json |
| **Codex** | `AGENTS.md` | 无 | 全量 inline（Codex 只读 AGENTS.md） |

适配器处理的转译包括：
- Agent frontmatter 字段映射（KQ-Forge 的 `scope`/`autonomy`/`delegates_to` → 平台原生字段）
- Skill frontmatter 裁剪（OpenCode 只认 `name` + `description`）
- Workflow 内容格式化（各平台无原生 workflow 概念，以 markdown 文档形式存放）

### 配置中心

```yaml
# .kqforge/config.yaml
version: 1
project:
  name: my-project
  description: 项目简述

defaults:
  autonomy: L1
  workflow: feature
  round_cap: 3
  reflect_on_error: true
  language: zh-CN

platforms:
  - opencode
  - claude-code

memory:
  auto_capture: true
  max_entries_per_file: 50
  categories: [rules, facts, lessons]

quality:
  model: triangle
  acceptance_criteria: true

disabled:
  agents: []
  skills: []
  workflows: []
```

---

## 快速开始

```bash
# 在项目根目录初始化（指定平台）
npx github:kqcoxn/kq-forge init --platform opencode

# 多平台同时启用
npx github:kqcoxn/kq-forge init --platform opencode,claude-code
```

> 完整的安装说明、CLI 命令用法和自定义配置方法，请参阅 **[使用教程](./docs/tutorial.md)**。

### 可用场景包

通过 `kq-forge add <package>` 按需添加场景包：

| 包名 | 说明 | 包含 Skills |
|------|------|-------------|
| `frontend` | 前端开发（TypeScript、React、CSS、无障碍） | typescript, frontend-ui |
| `api` | API 开发（API 设计、数据库、安全） | api, database, security-advanced |
| `python` | Python 全栈（编码规范、测试策略、Web 框架） | python |
| `golang` | Go 语言（惯用模式、项目布局、并发与测试） | golang |
| `rust` | Rust（所有权、错误处理、trait 设计、并发与测试） | rust |
| `java` | Java/Kotlin 全栈（编码规范、Spring Boot、JPA、测试） | java |
| `cpp` | 现代 C++（17/20）（编码规范、RAII、智能指针与测试） | cpp |
| `dotnet` | .NET/C#/F#（框架模式与测试策略） | dotnet |
| `mobile` | 移动端（Android、iOS、跨平台框架） | mobile |
| `devops` | DevOps（CI/CD、容器化、部署策略与生产审计） | devops |
| `ai-ml` | AI/ML（LLM 管道、ML 工作流、Prompt 优化、PyTorch） | ai-ml |
| `documentation` | 文档工程（代码导览与新人上手指南） | documentation |
| `performance` | 性能工程（基准测试、性能剖析与优化清单） | performance |
| `workflow-advanced` | 高级工作流（架构决策记录与搜索优先策略） | workflow-advanced |

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
| **源文件唯一** | `.kqforge/` 是 single source of truth，平台文件由适配器生成 |

---

## 与现有方案的对比

| 维度 | KQ-Forge | Superpowers | ECC | DeerFlow | OpenSpec |
|------|----------|-------------|-----|----------|---------|
| **哲学** | 因地制宜 | 纪律至上 | 全覆盖 | 运行时基座 | 规格对齐 |
| **人机模式** | L0-L3 可切换 | 固定约束 | 固定约束 | 固定 | 固定 |
| **形态** | Scaffolding + 项目级配置 | 纯文档插件 | 配置集 | 独立服务 | CLI 工具 |
| **质量机制** | 对抗三角 | TDD 铁律 | Hook 门控 | 中间件链 | 三维验证 |
| **知识管理** | 记忆 + 范式 | 无 | 本能进化 | 持久化记忆 | Delta Specs |
| **扩展性** | 必须扩展 | 插件市场 | 技能库 | 技能 + MCP | Schema 定制 |
| **平台** | 多平台适配 | 8+ 插件 | Claude 为主 | 独立部署 | 30+ 工具 |

---

## Roadmap

- [x] Core：agents / skills / workflows 模板定义
- [x] Config Schema：`.kqforge/config.yaml` 完整 schema
- [x] Scaffolding：`npx github:kqcoxn/kq-forge init` CLI 实现
- [x] Platform：OpenCode 适配器（AGENTS.md + .opencode/）
- [x] Platform：Claude Code 适配器（CLAUDE.md + .claude/）
- [x] Platform：Codex CLI 适配器（AGENTS.md inline）
- [x] Package：14 个场景包（frontend / api / python / golang / rust / java / cpp / dotnet / mobile / devops / ai-ml / documentation / performance / workflow-advanced）
- [x] CLI：sync / status / validate / list-packages 命令
- [x] Memory：记忆读取指令 + memory-keeper 子智能体 + sync 时 prune
- [x] Paradigm：范式创建流程（Agent 运行时直接创建 paradigm-*.md）
- [ ] 多平台 AGENTS.md 冲突合并策略

---

## 许可证

MIT
