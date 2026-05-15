# Trellis 深度研究报告

**项目地址**: https://github.com/mindfold-ai/Trellis  
**组织**: Mindfold AI  
**许可证**: AGPL-3.0  
**语言构成**: TypeScript 56% / Python 36.5% / JavaScript 6.2%  
**Stars**: 7.9k | **Forks**: 433 | **Commits**: 1,001 | **Releases**: 116  

---

## 一、设计思想 / Design Philosophy

### 核心理念

Trellis 的核心定位是 **"让 AI 编程代理达到生产级水平的工具框架"（The harness that makes coding agents production-ready）**。它不是一个 AI 代理本身，而是一个**跨平台的代理协调层（agent harness）**，解决的核心问题是：

> 当你在 Gemini 中开始一个功能，在 Claude Code 中继续，用 Codex 交付——或者在任何步骤交给队友——上下文、规范和标准如何在每个代理和每个队友之间共享？

### 解决的问题

1. **上下文丢失问题**: AI 对话会被压缩（compacted），但文件不会。Trellis 将所有决策、研究、规范持久化到文件系统。
2. **平台锁定问题**: 不同 AI 编程工具各有各的配置格式，Trellis 提供统一的工作流层。
3. **规范重复问题**: 开发者不得不在每次会话中重复告诉 AI 项目规范。
4. **团队协作问题**: 一个人总结的最佳实践无法自动惠及团队。
5. **工作流无结构问题**: AI 编程容易变成无序的对话。

### 方法论

Trellis 倡导的五条核心原则：

1. **先计划再编码**（Plan before code）
2. **规范注入而非记忆**（Specs injected, not remembered）
3. **一切持久化**（Persist everything）——研究、决策、教训全部写入文件
4. **增量开发**（Incremental development）——一次一个任务
5. **捕获学习**（Capture learnings）——每个任务结束后将新知识回写到规范

核心哲学一句话概括：**"对话会消失，文件不会"**（Conversations get compacted; files don't）。

---

## 二、核心特性 / Core Features

### 2.1 自动注入规范（Auto-injected Specs）

- 在 `.trellis/spec/` 中编写一次编码规范
- Trellis 通过 hook/skill 机制在每次 AI 会话中自动注入相关上下文
- 规范按包（package）和层（layer）组织：`.trellis/spec/<package>/<layer>/index.md`

### 2.2 任务中心工作流（Task-centered Workflow）

- 每个任务有独立目录：`.trellis/tasks/{MM-DD-name}/`
- 包含 PRD（`prd.md`）、实现上下文（`implement.jsonl`）、检查上下文（`check.jsonl`）、任务元数据（`task.json`）、研究资料（`research/`）
- 完整的任务生命周期：create → start → finish → archive

### 2.3 项目记忆（Project Memory）

- `.trellis/workspace/<developer>/` 下的日志（journal）记录每次 AI 会话
- 每个开发者有独立的工作空间，避免冲突
- 日志自动轮转（每文件最多 2000 行）

### 2.4 多平台支持（14+ 个 AI 编程平台）

| 平台 | 配置器文件 |
|------|-----------|
| Claude Code | `configurators/claude.ts` |
| Cursor | `configurators/cursor.ts` |
| OpenAI Codex | `configurators/codex.ts` |
| OpenCode | `configurators/opencode.ts` |
| Gemini | `configurators/gemini.ts` |
| GitHub Copilot | `configurators/copilot.ts` |
| Kiro | `configurators/kiro.ts` |
| Windsurf | `configurators/windsurf.ts` |
| Qoder | `configurators/qoder.ts` |
| CodeBuddy | `configurators/codebuddy.ts` |
| Droid | `configurators/droid.ts` |
| Pi | `configurators/pi.ts` |
| Kilo | `configurators/kilo.ts` |
| Antigravity | `configurators/antigravity.ts` |

### 2.5 四阶段循环工作流

```
Phase 1: Plan    → 明确需求（brainstorm + research → prd.md）
Phase 2: Execute → 编写代码并通过质量检查
Phase 3: Finish  → 提炼经验 + 收尾
```

每个阶段有明确的子步骤、必选/可选标记、以及自动状态面包屑（workflow-state breadcrumb）机制。

### 2.6 子代理系统（Sub-agent System）

| 子代理 | 职责 |
|--------|------|
| `trellis-brainstorm` | 逐问题探索需求，生成 PRD |
| `trellis-research` | 深度研究技术问题，输出到 `research/` |
| `trellis-implement` | 根据 PRD + 注入的规范编写代码 |
| `trellis-check` | 审查 diff、运行 lint/typecheck/test、自动修复 |
| `trellis-update-spec` | 将新学到的知识回写到规范 |
| `trellis-break-loop` | 打破调试死循环 |

### 2.7 技能系统（Skills）

`.agents/skills/` 下定义了可复用的技能模块：

- `trellis-brainstorm` — 需求探索
- `trellis-before-dev` — 开发前准备（加载规范）
- `trellis-check` — 质量检查
- `trellis-continue` — 会话续接
- `trellis-finish-work` — 完成工作
- `trellis-start` — 启动任务
- `trellis-update-spec` — 更新规范
- `trellis-break-loop` — 打破循环
- `trellis-meta` — 元操作
- `contribute` — 贡献指南
- `first-principles-thinking` — 第一性原理思考
- `python-design` — Python 设计模式

### 2.8 防跳过机制

Trellis 在 `workflow.md` 中内置了**防跳过表格**：

| AI 的想法 | 为什么是错的 |
|-----------|-------------|
| "这很简单，我直接写代码" | 派发子代理是低成本路径；跳过会丢失规范上下文 |
| "我在计划阶段已经想清楚了" | 计划阶段的输出在内存中，子代理看不到；必须持久化到 prd.md |
| "我已经知道规范了" | 规范可能已更新；子代理获得最新副本 |
| "先写代码，后面再检查" | `trellis-check` 能发现你自己注意不到的问题 |

### 2.9 逃生舱设计

尽管强制结构化流程，但提供了明确的逃生舱：
- **跳过 Trellis**: 用户说 "skip trellis" / "no task" / "just do it" / "跳过 trellis" / "别走流程" / "小修一下" / "直接改"
- **跳过子代理**: 用户说 "do it inline" / "no sub-agent" / "你直接改" / "别派 sub-agent"

---

## 三、实现架构 / Implementation Architecture

### 3.1 仓库顶层结构

```
Trellis/
├── .agents/skills/          # 可复用技能定义（12个技能）
├── .claude/                 # Claude Code 平台配置
├── .codex/                  # OpenAI Codex 平台配置
├── .cursor/                 # Cursor 平台配置
├── .opencode/               # OpenCode 平台配置
├── .pi/                     # Pi 平台配置
├── .husky/                  # Git hooks（pre-commit）
├── .trellis/                # Trellis 自身的工作流配置
│   ├── agents/              # 子代理定义
│   ├── scripts/             # Python 脚本
│   ├── spec/                # 编码规范
│   ├── tasks/               # 活跃和归档的任务
│   ├── workspace/           # 开发者工作空间日志
│   ├── config.yaml          # 项目级配置
│   └── workflow.md          # 工作流定义（核心文件）
├── packages/cli/            # CLI 核心包（npm: @mindfoldhq/trellis）
│   ├── src/
│   │   ├── commands/        # CLI 命令实现
│   │   ├── configurators/   # 平台配置生成器（16个文件）
│   │   ├── templates/       # 模板文件
│   │   └── utils/           # 工具函数
│   └── test/                # 测试
├── docs-site/               # 文档站（git submodule）
├── marketplace/             # 市场（git submodule）
├── AGENTS.md                # AI 代理指令文件
├── CLAUDE.md                # Claude 行为准则
├── package.json             # 根 package.json（pnpm workspace）
└── pnpm-workspace.yaml      # pnpm 工作区配置
```

### 3.2 技术栈

| 层面 | 技术选择 |
|------|---------|
| CLI 核心 | TypeScript + Node.js |
| 包管理 | pnpm workspace（monorepo） |
| 工作流脚本 | Python 3.9+ |
| 测试框架 | Vitest |
| 代码质量 | ESLint + Prettier + Husky |
| Python 类型检查 | basedpyright |
| 发布 | npm（`@mindfoldhq/trellis`） |

### 3.3 工作流状态机

通过 `[workflow-state:STATUS]` 标签块定义每个状态下的 AI 行为：

```
no_task       → 无活跃任务（判断是否需要创建任务）
planning      → Phase 1（brainstorm + jsonl 策展）
in_progress   → Phase 2 + Phase 3（实现 + 检查 + 提交）
completed     → 已完成
```

每个状态有对应的**面包屑注入**（breadcrumb injection），通过 hook 脚本在每次用户提交时注入到 AI 的上下文中。

### 3.4 上下文注入机制

- **implement.jsonl / check.jsonl**: JSONL 格式的上下文清单
- 每行 `{"file": "<path>", "reason": "<why>"}`
- 在 Phase 1.3 由 AI 策展（curate），列出子代理需要的规范和研究文件
- 子代理启动时，平台 hook 自动读取 JSONL 并将引用的文件内容注入到代理 prompt 中

### 3.5 平台适配架构

每个平台有一个独立的 configurator，负责：
1. 读取 `.trellis/` 中的通用工作流定义
2. 转换为该平台原生的配置格式
3. 生成到对应的平台配置目录

### 3.6 子代理调度模式

通过 `config.yaml` 中的 `codex.dispatch_mode` 配置：

| 模式 | 行为 |
|------|------|
| `sub-agent`（默认） | 主会话派发子代理，主会话不直接写代码 |
| `inline` | 主会话直接编写代码，加载规范上下文 |

### 3.7 任务系统命令

```bash
# 任务生命周期
task.py create "<title>" [--slug <name>]
task.py start <name>
task.py current --source
task.py finish
task.py archive <name>
task.py list [--mine] [--status <s>]

# 上下文管理
task.py add-context <name> <action> <file> <reason>
task.py list-context <name> [action]
task.py validate <name>

# PR 创建
task.py create-pr [name] [--dry-run]
```

---

## 四、内容概况 / Content Overview

### 4.1 核心交付物

| 类别 | 内容 |
|------|------|
| **CLI 工具** | `trellis init` / `trellis update` / `trellis uninstall` |
| **工作流定义** | `.trellis/workflow.md`（约 500 行的完整工作流规范） |
| **Python 脚本** | `task.py`、`get_context.py`、`add_session.py`、`init_developer.py`、`inject-workflow-state.py` |
| **技能模块** | 12 个可复用技能 |
| **子代理定义** | 3 个核心子代理（implement、check、research） |
| **平台配置器** | 14+ 个平台的配置生成逻辑 |
| **规范模板** | 按包/层组织的编码规范模板 |
| **配置文件** | `config.yaml`（项目级配置） |

### 4.2 配置系统

`config.yaml` 支持：
- 会话记录配置
- 任务生命周期钩子（after_create / after_start / after_finish / after_archive）
- Monorepo 包声明
- Codex 调度模式

---

## 五、独特差异化 / Unique Differentiators

### 5.1 与传统方式的对比

| 维度 | 传统方式 | Trellis |
|------|---------|---------|
| 规范组织 | 单一巨型文件 | 按包/层分层的 spec 目录 |
| 上下文管理 | 手动复制粘贴 | 自动注入（JSONL + hook） |
| 任务追踪 | 无 | 完整的任务生命周期 |
| 跨会话记忆 | 无 | workspace journal 系统 |
| 多平台 | 每个平台单独配置 | 统一工作流 + 平台适配器 |
| 知识积累 | 无 | `trellis-update-spec` 自动回写 |
| 工作流控制 | 无 | 状态机 + 面包屑注入 |

### 5.2 平台无关性

Trellis 是目前市面上**支持平台最多的 agent harness**（14+），通过 configurator 模式为每个平台生成原生配置文件。同一套规范和工作流在所有平台上保持一致。

### 5.3 工作流状态面包屑

每次用户提交消息时，hook 脚本解析 `workflow.md` 中的 `[workflow-state:STATUS]` 块，将当前阶段的行为指令注入到 AI 上下文中。这是一个**运行时行为控制机制**。

### 5.4 知识闭环

Phase 3.3（`trellis-update-spec`）实现了**知识闭环**：
- 每次任务完成后，AI 审查是否产生了新的模式、约定或教训
- 如果有，自动更新 `.trellis/spec/` 中的规范文件
- 下一次会话自动获得更新后的规范
- 项目的编码规范会随着开发**自动进化**

### 5.5 团队协作设计

- 规范（spec）是共享的，提交到仓库，可以 code review
- 工作空间日志（workspace）是个人的，按开发者隔离
- 任务（tasks）是可见的，支持 `--mine` 过滤
- 一个人的最佳实践通过 spec 更新自动惠及全团队

### 5.6 子代理调度协议

- 主会话不直接写代码（默认模式），而是派发子代理
- 子代理通过 JSONL 获得精确的上下文注入
- 子代理有自我豁免规则
- 支持 inline 模式作为逃生舱

---

## 六、总结

Trellis 本质上是一个**AI 编程代理的操作系统层**。它不替代任何 AI 工具，而是在所有 AI 工具之上提供：

1. **结构化工作流**（不让 AI 乱来）
2. **持久化上下文**（不让知识丢失）
3. **自动规范注入**（不让 AI 忘记规则）
4. **跨平台一致性**（不被工具锁定）
5. **知识自动积累**（越用越聪明）

从工程角度看，Trellis 的核心创新在于将"AI 代理应该如何工作"这个问题从各平台的配置文件中抽象出来，变成一个**可版本化、可共享、可进化的项目层基础设施**。它既是给 AI 的操作手册，也是给团队的协作协议。
