# KQ-Forge 产品需求文档 (PRD)

> 版本：0.1.0 | 日期：2025-05-15 | 状态：草案

---

## 1. 概述

### 1.1 产品定位

KQ-Forge 是一套模块化的 AI 编码代理 Harness（运行时协作框架）。它以 CLI 工具形式存在，通过 `npx` 安装到项目级目录，为人与 AI 的协作提供结构化的协议层。

### 1.2 核心哲学

**以人为本，因地制宜，实事求是。**

- 可开关的自动驾驶（L0-L3 分级）
- 犯错不可怕，即时反思才重要
- 不同项目需要不同协议，必须模块化、可增量

### 1.3 目标用户

使用 AI 编码工具（Claude Code / OpenCode / Codex CLI）的开发者，希望在项目中建立结构化的人机协作流程。

---

## 2. 实施计划

### Phase 1：Config Schema 定义

**目标**：规范化 `.kqforge/config.yaml` 的完整 schema，作为后续所有模块的配置基础。

**交付物**：
- `docs/plan/config-schema.yaml` — 完整的 JSON Schema（YAML 格式）
- 包含所有配置项的类型、默认值、约束、注释

**范围**：
- 项目元信息（name, description）
- 默认值（autonomy, workflow, round_cap）
- 平台列表
- 记忆配置
- Agent 引用方式
- Skill 引用方式
- Workflow 引用方式

---

### Phase 2：核心 Agents 与 Workflows

**目标**：编写 base 包中默认包含的 Agent 定义和 Workflow 定义。

**交付物**：
- `packages/core/templates/agents/lead.md`
- `packages/core/templates/agents/implementer.md`
- `packages/core/templates/agents/reviewer.md`
- `packages/core/templates/agents/judge.md`
- `packages/core/templates/workflows/feature.md`
- `packages/core/templates/workflows/bugfix.md`
- `packages/core/templates/skills/design.md`
- `packages/core/templates/skills/implement.md`
- `packages/core/templates/skills/review.md`
- `packages/core/templates/skills/debug.md`
- `packages/core/templates/skills/reflect.md`

**设计要点**：
- 每个 Agent 有明确的 frontmatter（name, scope, autonomy, required_skills, optional_skills）
- 每个 Agent 的 body 是系统提示词，定义其角色、职责、行为约束
- Workflow 定义步骤序列、每步的 agent 和 action
- Skill 分为 constraint 类型和 capability 类型

---

### Phase 3：Skills 复用与适配

**目标**：从已发布的成熟 skill 库中筛选可直接复用的 skills，做必要修改后纳入 KQ-Forge。

**来源候选**：
- obra/superpowers 的行为约束类 skills
- everything-claude-code 的技能库
- 社区公开的 AGENTS.md / CLAUDE.md 最佳实践
- OpenCode 内置 skills

**交付物**：
- 筛选报告：哪些 skills 可直接用、哪些需改造、哪些不适合
- 改造后的 skill 文件放入 `packages/core/templates/skills/` 或场景包

**适配原则**：
- 保持 KQ-Forge 的 frontmatter 格式统一
- 去除与 KQ-Forge 哲学冲突的硬性约束（如"没有测试不许写代码"改为可配置）
- 保留有价值的具体指导

---

### Phase 4：CLI 骨架落地

**目标**：实现可运行的 CLI 工具，支持核心命令。

**技术选型**：
- 语言：TypeScript
- 运行时：Node.js (>=18)
- CLI 框架：待定（commander / yargs / citty）
- 包管理：pnpm monorepo
- 构建：tsup
- 发布：npm（支持 npx 调用）

**交付物**：
- `packages/core/` — 核心逻辑
- `packages/cli/` — CLI 入口
- `packages/platform-claude-code/` — Claude Code 适配器
- `packages/platform-opencode/` — OpenCode 适配器
- `packages/platform-codex/` — Codex CLI 适配器

**核心命令**：

| 命令 | 功能 |
|------|------|
| `kq-forge init --platform <name>` | 初始化项目，生成 `.kqforge/` 目录和 `AGENTS.md` |
| `kq-forge add-platform <name>` | 添加平台适配 |
| `kq-forge add <package>` | 添加场景包 |
| `kq-forge list-packages` | 列出可用场景包 |
| `kq-forge status` | 显示当前配置状态 |
| `kq-forge validate` | 校验配置文件合法性 |

**平台适配器职责**：
- 将 `.kqforge/` 下的配置转译为目标平台的格式
  - Claude Code → `.claude/` 目录 + `CLAUDE.md`
  - OpenCode → `.opencode/` 目录 + `agents.md`
  - Codex → `codex.md` / `AGENTS.md`
- 监听配置变更，自动同步

---

## 3. 非功能需求

### 3.1 兼容性
- Windows / Linux 双平台
- Node.js >= 18
- 不依赖全局安装，通过 npx 即可运行

### 3.2 性能
- `init` 命令 < 3 秒完成
- 配置同步 < 1 秒

### 3.3 可维护性
- 配置文件人类可读（YAML + Markdown）
- 所有模板文件自身即文档

---

## 4. 约束与边界

### 4.1 做什么
- 提供结构化的协作协议层
- 管理 Agent / Skill / Workflow / Memory 的生命周期
- 在多平台间同步配置

### 4.2 不做什么
- 不自带 MCP server（允许 IDE/Agent 自行调用）
- 不提供 Agent 运行时（依赖目标平台执行）
- 不做社区贡献/插件市场
- 不做全局级安装或 daemon 进程

---

## 5. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 平台格式变更导致适配器失效 | 高 | 适配器独立包，版本锁定，快速迭代 |
| Agent 提示词在不同模型表现不一致 | 中 | 核心 Agent 提示词保持模型无关，平台适配器做微调 |
| 配置复杂度过高劝退用户 | 中 | base 包开箱即用，渐进式暴露复杂度 |
| Workflow 切换时状态不一致 | 低 | Workflow 无状态，状态存在 memory 中 |

---

## 6. 成功指标

- 用户从 `npx kq-forge init` 到首次使用 < 1 分钟
- base 包覆盖 80% 的常见开发场景
- 添加自定义 Agent/Skill 无需修改核心代码
- 配置同步到目标平台零手动操作

---

## 7. 附录

### 7.1 术语表

| 术语 | 定义 |
|------|------|
| **Harness** | 运行时协作框架，为 AI Agent 提供结构化约束和协作协议 |
| **Autonomy Level** | 自动化等级（L0-L3），定义人机协作的介入程度 |
| **Agent** | 具有明确职责和管辖范围的 AI 角色 |
| **Skill** | Agent 可调用的能力或必须遵守的约束 |
| **Workflow** | 编排多个 Agent 协作完成任务的流程定义 |
| **Memory** | 跨会话持久化的项目知识（规则/事实/教训） |
| **Paradigm** | 从记忆中提炼的抽象模式，生成为专家 Agent 配置 |
| **Round Cap** | 对抗性 review 的最大轮次限制 |
| **Platform Adapter** | 将 KQ-Forge 配置转译为目标 AI 工具格式的模块 |

### 7.2 相关文档

- [调研报告](../survey/) — 竞品分析
- [README](../../README.md) — 项目概览
