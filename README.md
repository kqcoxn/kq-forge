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

## 安装

### 快速开始

```bash
# 在项目根目录初始化（指定平台）
npx github:kqcoxn/kq-forge init --platform opencode

# 多平台同时启用
npx github:kqcoxn/kq-forge init --platform opencode,claude-code

# 指定项目名称
npx github:kqcoxn/kq-forge init --platform opencode --name my-project
```

### 安装内容

`init` 命令执行以下操作：

1. 创建 `.kqforge/` 目录，写入 `config.yaml`
2. 复制核心 Agent 定义到 `.kqforge/agents/`（lead / implementer / reviewer / judge / memory-keeper）
3. 复制核心 Skills 到 `.kqforge/skills/`（design / implement / review / debug / reflect + 5 个约束类）
4. 复制默认 Workflows 到 `.kqforge/workflows/`（feature / bugfix / longmarch）
5. 创建 `.kqforge/memory/` 目录（Agent 运行时读写记忆）
6. 复制入口模板 `AGENTS.template.md` 到 `.kqforge/AGENTS.template.md`（用户可自定义）
7. 自动调用平台适配器，生成平台原生文件（`AGENTS.md`、`.opencode/` 等）

---

## CLI 命令

| 命令 | 说明 |
|------|------|
| `kq-forge init` | 初始化项目，创建 `.kqforge/` 并生成平台文件 |
| `kq-forge add-platform <name>` | 添加平台适配器（opencode / claude-code / codex） |
| `kq-forge add <package>` | 添加场景包（frontend / api） |
| `kq-forge sync` | 将 `.kqforge/` 源文件重新同步到各平台原生格式 |
| `kq-forge status` | 显示当前配置状态 |
| `kq-forge validate` | 校验配置文件合法性（含交叉引用检查） |
| `kq-forge list-packages` | 列出可用的场景包 |

### 添加场景包

```bash
# 前端开发场景包（typescript + frontend-ui）
npx github:kqcoxn/kq-forge add frontend

# API 开发场景包（api + database + security-advanced）
npx github:kqcoxn/kq-forge add api
```

场景包会将对应的 Skills 添加到 `.kqforge/skills/`，并自动同步到已启用的平台目录。

### 手动同步

修改 `.kqforge/` 中的源文件后，运行 sync 重新生成平台文件：

```bash
npx github:kqcoxn/kq-forge sync
```

---

## 自定义

### 自定义入口模板

`.kqforge/AGENTS.template.md` 是生成平台入口文件（`AGENTS.md` / `CLAUDE.md`）的母版。你可以直接编辑它来控制 AI 看到的顶层指令结构。

模板使用 `{{PLACEHOLDER}}` 占位符，sync 时自动替换为动态内容：

| 占位符 | 说明 |
|--------|------|
| `{{ENTRY_FILENAME}}` | 入口文件名（由平台决定） |
| `{{DEFAULT_AUTONOMY}}` | 默认 autonomy 等级（来自 config） |
| `{{ROUND_CAP}}` | 对抗轮次上限（来自 config） |
| `{{CUSTOM_RULES}}` | 自定义规则（来自 config，为空时整段消失） |
| `{{AGENTS_TABLE}}` | Agents 索引表（自动生成） |
| `{{SKILLS_TABLE}}` | Skills 索引表（自动生成） |
| `{{WORKFLOWS_TABLE}}` | Workflows 索引表（自动生成） |

编辑后运行 `kq-forge sync` 即可生效。

> **注意**：不要手动编辑生成的 `AGENTS.md` 或 `CLAUDE.md`——它们会在下次 sync 时被覆盖。始终编辑 `.kqforge/AGENTS.template.md`。

### 自定义规则

编辑 `.kqforge/custom-rules.md` 来添加项目级规则。该文件内容会被原样注入到生成的入口文件中。

默认内容：

```markdown
## 自定义规则

全程使用中文。
```

你可以自由编辑这个文件，添加任何你希望 AI 遵守的规则。如果删除该文件或清空内容，sync 后入口文件中不会出现自定义规则章节。

### 自定义 Agent

在 `.kqforge/agents/` 下创建新文件：

```markdown
---
name: api-designer
description: API 设计专家
scope: src/api/**
autonomy: L1
required_skills:
  - design
  - api
optional_skills:
  - implement
delegates_to:
  - implementer
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
on_complete: reflect
---

这是一个轻量级探索流程...
```

### 自定义 Skill

在 `.kqforge/skills/` 下创建文件夹，入口为 `SKILL.md`：

```
.kqforge/skills/
└── api-conventions/
    └── SKILL.md
```

SKILL.md 格式：

```markdown
---
name: api-conventions
description: 本项目的 API 设计约定
type: constraint
---

## 规则

1. 所有 API 响应使用 envelope 格式：`{ data, error, meta }`
2. 错误码使用 HTTP 标准状态码
3. 分页使用 cursor-based pagination
...
```

### 修改后同步

自定义文件创建/修改后，运行 `kq-forge sync` 将变更同步到平台原生目录。

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
- [x] Package：frontend 场景包
- [x] Package：api 场景包
- [x] CLI：sync / status / validate / list-packages 命令
- [x] Memory：记忆读取指令 + memory-keeper 子智能体 + sync 时 prune
- [x] Paradigm：范式创建流程（Agent 运行时直接创建 paradigm-*.md）
- [ ] 多平台 AGENTS.md 冲突合并策略
- [ ] 更多场景包（data-pipeline / mobile / devops）

---

## 许可证

MIT
