# OpenSpec 深度研究报告

**项目地址:** https://github.com/Fission-AI/OpenSpec  
**当前版本:** v1.3.1  
**Stars:** 48.2k | **Forks:** 3.4k  
**许可证:** MIT  
**NPM 包名:** `@fission-ai/openspec`  
**语言:** TypeScript (99.1%)

---

## 一、设计思想 / Design Philosophy

### 1.1 核心理念

OpenSpec 提出了 **Spec-Driven Development (SDD，规格驱动开发)** 的方法论，其核心思想是：

> AI 编码助手虽然强大，但当需求仅存在于聊天历史中时，结果不可预测。OpenSpec 添加了一个轻量级的规格层，让人类和 AI 在编写代码之前先就"要构建什么"达成一致。

### 1.2 五大哲学原则

```text
→ fluid not rigid         — 流动而非僵化：没有阶段门禁，随时做有意义的事
→ iterative not waterfall — 迭代而非瀑布：边构建边学习，边进行边优化
→ easy not complex        — 简单而非复杂：轻量设置，最少仪式感
→ built for brownfield    — 棕地优先：适用于现有代码库，而非仅限绿地项目
→ scalable                — 可扩展：从个人项目到企业级均适用
```

### 1.3 解决的核心问题

1. **AI 编码的不可预测性** — 没有规格约束时，AI 生成的代码方向不可控
2. **需求散落在聊天历史中** — 无法追溯、无法复用、无法审计
3. **人机对齐困难** — 人类和 AI 对"要做什么"缺乏共识
4. **现有方案过重** — 传统 PRD 流程太慢，其他工具锁定 IDE

### 1.4 方法论核心："行动而非阶段"

传统工作流是线性阶段锁定的：`规划 → 实现 → 完成`，不能回退。

OpenSpec 的 OPSX 工作流采用 **行动模型**：
- `propose`、`apply`、`archive` 等是"行动"而非"阶段"
- 依赖关系是"启用器"（enablers）而非"门禁"（gates）
- 随时可以更新任何制品（artifact）

```
传统工作流（阶段锁定）:
  PLANNING ────────► IMPLEMENTING ────────► DONE
      │                    │
      │   "不能回退"        │
      └────────────────────┘

OPSX 工作流（流动行动）:
  proposal ──► specs ──► design ──► tasks ──► implement
      ↑           ↑          ↑          ↑
      └───────────┴──────────┴──────────┘
              随时可以回退更新
```

### 1.5 "先达成共识，再写代码"

OpenSpec 的核心工作流循环：

1. **Specs 描述当前行为** — 系统行为的真相来源
2. **Changes 提出修改** — 以 Delta 形式描述变更
3. **Implementation 实现变更** — 按任务清单编码
4. **Archive 合并增量** — Delta 合并回主规格
5. **Specs 描述新行为** — 规格演进为新的真相来源

---

## 二、核心特性 / Core Features

### 2.1 OPSX 工作流系统

#### 核心命令集（`core` profile，默认）

| 命令 | 功能 | 使用场景 |
|------|------|---------|
| `/opsx:propose` | 创建变更并一步生成所有规划制品 | 快速启动，明确需求时 |
| `/opsx:explore` | 探索想法、调研问题、澄清需求 | 需求不明确时 |
| `/opsx:apply` | 按任务清单实现代码 | 准备好写代码时 |
| `/opsx:sync` | 将增量规格合并到主规格 | 长期变更需要提前同步时 |
| `/opsx:archive` | 归档已完成的变更 | 工作完成时 |

#### 扩展命令集

| 命令 | 功能 |
|------|------|
| `/opsx:new` | 创建变更脚手架 |
| `/opsx:continue` | 按依赖链逐个创建制品 |
| `/opsx:ff` | 快进：一次创建所有规划制品 |
| `/opsx:verify` | 验证实现是否匹配制品 |
| `/opsx:bulk-archive` | 批量归档多个变更 |
| `/opsx:onboard` | 引导式教程 |

#### 典型工作流示例

```text
You: /opsx:propose add-dark-mode
AI:  Created openspec/changes/add-dark-mode/
     ✓ proposal.md — 为什么要做这个，改什么
     ✓ specs/       — 需求和场景
     ✓ design.md    — 技术方案
     ✓ tasks.md     — 实现清单
     Ready for implementation!

You: /opsx:apply
AI:  Implementing tasks...
     ✓ 1.1 Add theme context provider
     ✓ 1.2 Create toggle component
     All tasks complete!

You: /opsx:archive
AI:  Archived to openspec/changes/archive/2025-01-23-add-dark-mode/
     Specs updated. Ready for the next feature.
```

### 2.2 制品系统 (Artifacts)

每个变更包含四类制品，形成有向无环图（DAG）依赖关系：

```
                    proposal
                   (根节点：为什么)
                       │
         ┌─────────────┴─────────────┐
         │                           │
         ▼                           ▼
      specs                       design
   (改什么：需求                 (怎么做：技术
    和场景)                       方案)
         │                           │
         └─────────────┬─────────────┘
                       │
                       ▼
                    tasks
                (步骤：实现清单)
```

#### proposal.md — 意图与范围

定义 WHY（为什么做）、SCOPE（做什么/不做什么）、APPROACH（大致方向）。

#### specs/ — 规格（Given/When/Then 格式）

使用 RFC 2119 关键词（MUST/SHALL/SHOULD/MAY）表达需求强度：

```markdown
## Requirements

### Requirement: User Authentication
The system SHALL issue a JWT token upon successful login.

#### Scenario: Valid credentials
- GIVEN a user with valid credentials
- WHEN the user submits login form
- THEN a JWT token is returned
```

#### design.md — 技术方案与架构决策

记录技术选型理由和架构决策。

#### tasks.md — 实现清单

分组的可勾选任务列表。

### 2.3 Delta Specs（增量规格）— 核心创新

Delta Specs 是 OpenSpec 最重要的创新。它不重写整个规格，而是精确描述"变化了什么"：

```markdown
## ADDED Requirements
### Requirement: Two-Factor Authentication
The system MUST support TOTP-based two-factor authentication.

## MODIFIED Requirements
### Requirement: Session Expiration
The system MUST expire sessions after 15 minutes of inactivity.
(Previously: 30 minutes)

## REMOVED Requirements
### Requirement: Remember Me
(Deprecated in favor of 2FA.)
```

| Delta 区段 | 归档时操作 |
|-----------|-----------|
| `## ADDED Requirements` | 追加到主规格 |
| `## MODIFIED Requirements` | 替换现有需求 |
| `## REMOVED Requirements` | 从主规格删除 |

**优势：**
- 精确展示变更内容，无需心理 diff
- 多个变更可并行修改同一规格文件
- 审查者只看变化
- 修改现有行为是一等公民

### 2.4 Schema 系统（可定制工作流）

Schema 用 YAML 定义制品类型及其依赖关系：

```yaml
name: spec-driven
version: 1
artifacts:
  - id: proposal
    generates: proposal.md
    requires: []
  - id: specs
    generates: specs/**/*.md
    requires: [proposal]
  - id: design
    generates: design.md
    requires: [proposal]
  - id: tasks
    generates: tasks.md
    requires: [specs, design]

apply:
  requires: [tasks]
  tracks: tasks.md
```

**Schema 管理命令：**
```bash
openspec schemas                    # 列出可用 schema
openspec schema init research-first # 从头创建
openspec schema fork spec-driven my-workflow  # Fork 定制
openspec schema validate my-workflow          # 验证
```

**Schema 解析优先级：**
1. 项目级：`openspec/schemas/<name>/`
2. 用户级：`~/.local/share/openspec/schemas/<name>/`
3. 包内置

### 2.5 超广泛的工具支持（30+ AI 编码助手）

| 工具 | Skills 路径 | Commands 路径 |
|------|------------|--------------|
| Claude Code | `.claude/skills/openspec-*/SKILL.md` | `.claude/commands/opsx/<id>.md` |
| Cursor | `.cursor/skills/openspec-*/SKILL.md` | `.cursor/commands/opsx-<id>.md` |
| Windsurf | `.windsurf/skills/openspec-*/SKILL.md` | `.windsurf/workflows/opsx-<id>.md` |
| GitHub Copilot | `.github/skills/openspec-*/SKILL.md` | `.github/prompts/opsx-<id>.prompt.md` |
| Codex | `.codex/skills/openspec-*/SKILL.md` | `$CODEX_HOME/prompts/opsx-<id>.md` |
| Gemini CLI | `.gemini/skills/openspec-*/SKILL.md` | `.gemini/commands/opsx/<id>.toml` |
| Amazon Q | `.amazonq/skills/openspec-*/SKILL.md` | `.amazonq/prompts/opsx-<id>.md` |
| OpenCode | `.opencode/skills/openspec-*/SKILL.md` | `.opencode/commands/opsx-<id>.md` |
| Kiro | `.kiro/skills/openspec-*/SKILL.md` | `.kiro/prompts/opsx-<id>.prompt.md` |
| ...等 30+ 工具 | | |

### 2.6 验证系统（三维验证）

`/opsx:verify` 从三个维度验证实现质量：

| 维度 | 验证内容 |
|------|---------|
| **完整性 (Completeness)** | 所有任务完成、所有需求实现、场景覆盖 |
| **正确性 (Correctness)** | 实现匹配规格意图、边界情况处理 |
| **一致性 (Coherence)** | 设计决策反映在代码中、模式一致 |

问题分级：CRITICAL / WARNING / SUGGESTION

### 2.7 Coordination Workspaces（协调工作区）

支持跨仓库/跨文件夹的规划协调（beta）：

```yaml
# .openspec-workspace/workspace.yaml
version: 1
name: platform
links:
  api: {}
  web: {}
```

### 2.8 项目配置系统

```yaml
# openspec/config.yaml
schema: spec-driven

context: |
  Tech stack: TypeScript, React, Node.js, PostgreSQL
  API style: RESTful, JSON responses
  Testing: Vitest for unit tests, Playwright for e2e

rules:
  proposal:
    - Include rollback plan
  specs:
    - Use Given/When/Then format for scenarios
  design:
    - Include sequence diagrams for complex flows
```

### 2.9 渐进式严格度

| 级别 | 适用场景 | 内容 |
|------|---------|------|
| **Lite spec（默认）** | 大多数变更 | 简短行为需求 + 明确范围 + 几个验收检查 |
| **Full spec（高风险）** | 跨团队/API 变更/安全/迁移 | 完整需求 + 场景 + 边界情况 |

---

## 三、实现架构 / Implementation Architecture

### 3.1 技术栈

| 层面 | 技术 |
|------|------|
| 语言 | TypeScript 5.9+ |
| 运行时 | Node.js >= 20.19.0 |
| 包管理 | pnpm |
| 测试 | Vitest 3.2+ |
| Lint | ESLint 9 + typescript-eslint |
| CLI 框架 | Commander.js 14 |
| 交互式提示 | @inquirer/prompts 7.8 |
| YAML 解析 | yaml 2.8 |
| 数据验证 | Zod 4.0 |
| 终端美化 | chalk 5.5 + ora 8.2 |
| 遥测 | posthog-node 5.20 |
| 版本管理 | @changesets/cli |

### 3.2 源码目录结构

```
src/
├── index.ts                    # 包入口
├── cli/                        # CLI 命令注册与路由
├── commands/                   # 各 CLI 子命令实现
├── core/                       # 核心业务逻辑
│   ├── artifact-graph/         # ★ 制品依赖图引擎（DAG + 拓扑排序 + 状态检测）
│   ├── command-generation/     # ★ 为各 AI 工具生成命令/技能文件
│   ├── parsers/                # 规格/制品 Markdown 解析器
│   ├── schemas/                # Schema 加载、解析、验证
│   ├── templates/              # 制品模板引擎
│   ├── validation/             # 规格/变更结构验证
│   ├── workspace/              # 协调工作区逻辑
│   ├── archive.ts              # 归档逻辑（移动 + 合并 delta）
│   ├── config.ts               # 配置管理
│   ├── specs-apply.ts          # ★ 规格合并逻辑（Delta → Main）
│   └── profiles.ts             # Profile 管理
├── prompts/                    # AI 提示词模板
├── telemetry/                  # 遥测收集
└── utils/                      # 通用工具函数
```

### 3.3 仓库顶层结构

```
Fission-AI/OpenSpec/
├── .changeset/                 # Changeset 版本管理
├── .devcontainer/              # Dev Container 配置
├── .github/                    # GitHub Actions CI/CD
├── assets/                     # 图片资源
├── bin/openspec.js             # CLI 入口
├── docs/                       # 完整文档（8+ 文件）
├── openspec/                   # ★ 自身的 OpenSpec 规格（dogfooding）
├── schemas/                    # 内置 schema 定义
├── scripts/                    # 构建/发布脚本
├── src/                        # 源代码
├── test/                       # 测试文件
├── AGENTS.md                   # AI Agent 开发指引
├── CHANGELOG.md                # 变更日志
├── package.json                # 包定义
└── README.md                   # 主 README
```

### 3.4 核心架构模式

#### 制品依赖图引擎 (Artifact Graph Engine)

```
Schema YAML 定义
       │
       ▼
┌─────────────────────────────────────────────┐
│         Artifact Graph Engine               │
│                                             │
│  1. 解析 schema.yaml → 构建 DAG            │
│  2. 拓扑排序 → 确定创建顺序                │
│  3. 文件系统检测 → 确定制品状态             │
│  4. 生成富指令 → 模板 + 上下文 + 依赖内容  │
└─────────────────────────────────────────────┘
       │
       ▼
状态输出（JSON）供 AI Agent 消费
```

**状态转换模型：**
```
BLOCKED → READY → DONE
(缺少依赖)  (所有依赖 DONE)  (文件已存在)
```

#### Agent-CLI 协作模式

AI Agent 通过 CLI 查询结构化数据：
```bash
$ openspec status --change "add-auth" --json    # 查询状态
$ openspec instructions specs --change "add-auth" --json  # 获取富指令
```

#### 规格合并引擎 (Specs Apply)

处理 Delta → Main 的智能合并：
- ADDED → 追加新需求
- MODIFIED → 替换匹配需求
- REMOVED → 删除匹配需求

---

## 四、内容概况 / Content Overview

### 4.1 项目产出物总览

| 类别 | 内容 |
|------|------|
| **CLI 工具** | `openspec init` / `openspec update` / `openspec status` / `openspec instructions` |
| **工作流命令** | 11 个 OPSX 命令（propose/explore/apply/sync/archive 等） |
| **Schema 系统** | 可定制的制品依赖图定义 |
| **平台适配** | 30+ AI 工具的技能/命令文件生成 |
| **验证系统** | 三维验证（完整性/正确性/一致性） |
| **协调工作区** | 跨仓库规划协调（beta） |
| **文档** | 8+ 文档文件（concepts、commands、workflows、customization 等） |

### 4.2 文件系统产物

```
项目根/
├── openspec/
│   ├── config.yaml              # 项目配置
│   ├── specs/                   # 主规格（真相来源）
│   │   └── {domain}/spec.md
│   ├── changes/                 # 活跃变更
│   │   └── {change-name}/
│   │       ├── proposal.md
│   │       ├── specs/{domain}/spec.md  # Delta Specs
│   │       ├── design.md
│   │       └── tasks.md
│   ├── changes/archive/         # 已归档变更
│   └── schemas/                 # 自定义 schema（可选）
├── .claude/skills/openspec-*/   # Claude Code 技能
├── .cursor/skills/openspec-*/   # Cursor 技能
└── ...                          # 其他平台配置
```

### 4.3 Dogfooding

OpenSpec 自身使用 OpenSpec 管理开发（`openspec/` 目录），包含自身的规格、变更和归档。

---

## 五、独特差异化 / Unique Differentiators

### 5.1 与其他 Harness 的对比

| 维度 | OpenSpec | Superpowers | CodeStable | Trellis |
|------|----------|-------------|------------|---------|
| **核心关注** | 规格对齐 | 行为纪律 | 知识工程 | 工作流协调 |
| **哲学** | 流动行动 | 强制 TDD | 人在环 | 先计划再编码 |
| **制品** | proposal/specs/design/tasks | 无持久化制品 | requirements/architecture/compound | PRD/spec/research |
| **增量管理** | Delta Specs（核心创新） | 无 | 无 | 无 |
| **Schema** | 可定制 DAG | 固定流程 | 固定流程 | 固定流程 |
| **平台支持** | 30+ | 8+ | Claude Code | 14+ |
| **运行时** | CLI（TypeScript） | 无 | 无 | CLI（TypeScript） |

### 5.2 核心差异化

#### 1. Delta Specs — 增量规格管理

这是 OpenSpec 最独特的贡献。其他系统要么没有规格管理，要么只有全量覆盖。Delta Specs 让规格演进变得精确、可审查、可并行。

#### 2. 制品依赖图引擎

不是线性流水线，而是 DAG。制品之间的依赖关系由 Schema 定义，引擎自动计算创建顺序和状态。这使得工作流可以被自定义而不需要修改代码。

#### 3. "流动而非僵化"的哲学

没有阶段门禁。你可以在任何时候回去修改 proposal、更新 specs、调整 design。这与 Superpowers 的"HARD-GATE"和 CodeStable 的严格阶段形成鲜明对比。

#### 4. 30+ 平台支持

目前市面上支持 AI 工具最多的规格管理系统。一次 `openspec init`，所有工具都能使用。

#### 5. Schema 可定制性

用户可以 fork 内置 schema 或从零创建，定义自己的制品类型和依赖关系。这使得 OpenSpec 不仅仅是一个工具，而是一个**工作流引擎**。

#### 6. 验证系统

三维验证（完整性/正确性/一致性）在归档前确保实现质量，这是其他系统没有的系统化验证机制。

#### 7. 棕地优先

明确设计为适用于现有代码库，而非仅限绿地项目。Delta Specs 的 MODIFIED/REMOVED 区段就是为此设计的。

---

## 六、总结

OpenSpec 代表了 Agent Harness 的"规格对齐"路线。它的核心贡献是：

1. **Delta Specs** — 让规格演进变得精确和可管理
2. **制品 DAG** — 让工作流变得可定制和可扩展
3. **"流动行动"哲学** — 在结构化和灵活性之间找到平衡
4. **30+ 平台支持** — 真正的工具无关性

OpenSpec 的成功（48.2k stars）证明了市场对"轻量级规格管理"的强烈需求——开发者不想要重量级的 PRD 流程，但也不想完全没有规格就让 AI 乱写。OpenSpec 在这两个极端之间找到了甜蜜点。

与 CodeStable 的"知识工程"和 Trellis 的"工作流协调"相比，OpenSpec 更专注于**人机对齐**这一个核心问题：确保人类和 AI 在"要做什么"上达成共识，然后让 AI 去执行。
