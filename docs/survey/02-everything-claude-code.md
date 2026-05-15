# Everything Claude Code (ECC) 深度研究报告

## 项目概览

| 属性 | 详情 |
|------|------|
| **仓库地址** | https://github.com/affaan-m/everything-claude-code |
| **作者** | Affaan Mustafa (@affaanmustafa) |
| **许可证** | MIT |
| **当前版本** | v2.0.0-rc.1 |
| **Stars** | 182K+ |
| **Forks** | 28K+ |
| **贡献者** | 170+ |
| **提交数** | 1,750+ |
| **起源** | Anthropic Hackathon 获奖项目 |

---

## 一、设计思想 / Design Philosophy

### 核心理念

ECC 的核心定位是 **"AI Agent Harness 性能优化系统"**（The performance optimization system for AI agent harnesses）。它不是简单的配置文件集合，而是一个完整的系统，涵盖：技能（Skills）、本能（Instincts）、记忆优化（Memory Optimization）、持续学习（Continuous Learning）、安全扫描（Security Scanning）和研究驱动开发（Research-first Development）。

### 解决的问题

1. **AI 编码代理缺乏结构化工作流** — 裸用 Claude Code/Codex/Cursor 等工具时，缺少系统化的规则、技能和质量门控
2. **跨工具碎片化** — 不同 AI 代理工具各自为政，无法共享工作流资产
3. **会话记忆丢失** — AI 代理在会话间无法保持上下文和学习成果
4. **质量不可控** — 缺少自动化的代码审查、安全检查和测试验证循环
5. **Token 浪费** — 缺乏系统化的 Token 优化和上下文管理策略

### 五大核心原则（来自 SOUL.md）

1. **Agent-First（代理优先）** — 尽早将工作路由到正确的专家代理
2. **Test-Driven（测试驱动）** — 在信任实现变更之前先编写或刷新测试
3. **Security-First（安全优先）** — 验证输入、保护密钥、保持安全默认值
4. **Immutability（不可变性）** — 优先使用显式状态转换而非共享状态变异
5. **Plan Before Execute（先规划后执行）** — 复杂变更应分解为有意识的阶段

### 设计哲学深层解读

ECC 的设计哲学可以概括为"**元编程代理**"——它不是直接帮你写代码，而是优化那个帮你写代码的 AI 代理的行为。这种"优化优化器"的思路体现在：

- **规则层**：告诉代理"始终应该做什么"和"绝不应该做什么"
- **技能层**：告诉代理"遇到特定场景时如何操作"
- **Hook 层**：在代理操作的关键节点自动注入检查和增强
- **学习层**：让代理从自身经验中提取可复用模式

---

## 二、核心特性 / Core Features

### 2.1 多代理编排系统（60 个专业代理）

仓库包含 60 个专业化子代理（`agents/` 目录），每个代理有明确的职责边界：

| 代理类别 | 代表性代理 | 功能 |
|----------|-----------|------|
| 规划类 | `planner.md`, `architect.md` | 功能规划、系统架构设计 |
| 代码审查类 | `code-reviewer.md`, `security-reviewer.md`, `typescript-reviewer.md`, `python-reviewer.md`, `go-reviewer.md`, `java-reviewer.md`, `kotlin-reviewer.md`, `rust-reviewer.md`, `cpp-reviewer.md` | 多语言代码质量与安全审查 |
| 构建修复类 | `build-error-resolver.md`, `java-build-resolver.md`, `kotlin-build-resolver.md`, `go-build-resolver.md`, `rust-build-resolver.md`, `cpp-build-resolver.md`, `pytorch-build-resolver.md` | 多语言构建错误自动修复 |
| 测试类 | `tdd-guide.md`, `e2e-runner.md` | TDD 指导、E2E 测试执行 |
| 运维类 | `loop-operator.md`, `harness-optimizer.md`, `chief-of-staff.md` | 自主循环执行、配置调优、通信分诊 |
| ML 类 | `mle-reviewer.md` | 生产 ML 管道审查 |
| 文档类 | `doc-updater.md`, `docs-lookup.md` | 文档同步、API 文档查找 |
| 重构类 | `refactor-cleaner.md` | 死代码清理 |
| 数据库类 | `database-reviewer.md` | 数据库/Supabase 审查 |

代理格式为 Markdown + YAML frontmatter：
```yaml
---
name: code-reviewer
description: Reviews code for quality, security, and maintainability
tools: ["Read", "Grep", "Glob", "Bash"]
model: opus
---

You are a senior code reviewer...
```

### 2.2 技能系统（229 个技能）

技能（Skills）是 ECC 的**主要工作流表面**，位于 `skills/` 目录。覆盖范围极广：

**编程语言/框架技能：**
- TypeScript/JavaScript: `coding-standards`, `frontend-patterns`, `backend-patterns`, `nestjs-patterns`
- Python: `python-patterns`, `python-testing`, `django-patterns`, `fastapi-patterns`
- Go: `golang-patterns`, `golang-testing`
- Java: `springboot-patterns`, `springboot-security`, `springboot-tdd`, `quarkus-patterns`
- Kotlin: `kotlin-patterns`, `kotlin-testing`, `kotlin-ktor-patterns`, `compose-multiplatform-patterns`
- Rust: `rust-patterns`, `rust-testing`
- C++: `cpp-coding-standards`, `cpp-testing`
- Swift: `swift-actor-persistence`, `swift-concurrency-6-2`, `swiftui-patterns`
- Laravel/PHP: `laravel-patterns`, `laravel-security`, `laravel-tdd`
- .NET: `dotnet-patterns`, `csharp-testing`, `fsharp-testing`
- Dart/Flutter: `dart-flutter-patterns`
- Angular: `angular-developer`

**工作流技能：**
- `tdd-workflow` — TDD 方法论（RED-GREEN-IMPROVE 循环）
- `continuous-learning-v2` — 基于本能的持续学习
- `verification-loop` — 持续验证循环
- `eval-harness` — 评估框架
- `search-first` — 研究先行工作流
- `autonomous-loops` — 自主循环模式
- `iterative-retrieval` — 渐进式上下文精炼
- `strategic-compact` — 手动压缩建议

**运营/商业技能：**
- `article-writing` — 长篇写作
- `content-engine` — 多平台社交内容
- `market-research` — 市场/竞争对手研究
- `investor-materials` — 路演材料
- `brand-voice` — 品牌声音
- `customer-billing-ops` — 客户计费运营

**安全技能：**
- `security-review` — 安全检查清单
- `security-scan` — AgentShield 安全审计集成
- `security-bounty-hunter` — 安全赏金猎人
- `defi-amm-security` — DeFi AMM 安全
- `hipaa-compliance` — HIPAA 合规

**基础设施/DevOps 技能：**
- `docker-patterns` — Docker 模式
- `deployment-patterns` — CI/CD 部署
- `database-migrations` — 数据库迁移
- `api-design` — REST API 设计
- `postgres-patterns` — PostgreSQL 优化
- `mcp-server-patterns` — MCP 服务器开发

**AI/ML 技能：**
- `mle-workflow` — 生产 ML 工作流
- `cost-aware-llm-pipeline` — LLM 成本优化
- `prompt-optimizer` — 提示词优化
- `agentic-engineering` — 代理工程

**媒体/视频技能：**
- `manim-video` — Manim 数学动画
- `remotion-video-creation` — Remotion 视频创建
- `videodb` — 视频数据库

### 2.3 Hook 系统（事件驱动自动化）

ECC 实现了完整的生命周期 Hook 系统（`hooks/hooks.json`），覆盖以下事件阶段：

#### SessionStart（会话开始）
- `session:start` — 加载上一次会话上下文、检测包管理器

#### PreToolUse（工具使用前）
| Hook ID | 匹配器 | 功能 |
|---------|--------|------|
| `pre:bash:dispatcher` | Bash | 合并的 Bash 预检分发器 |
| `pre:write:doc-file-warning` | Write | 非标准文档文件警告 |
| `pre:edit-write:suggest-compact` | Edit\|Write | 建议手动压缩 |
| `pre:observe:continuous-learning` | * | 捕获工具使用观察 |
| `pre:governance-capture` | Bash\|Write\|Edit\|MultiEdit | 捕获治理事件 |
| `pre:config-protection` | Write\|Edit\|MultiEdit | 阻止修改 linter 配置 |
| `pre:mcp-health-check` | * | MCP 服务器健康检查 |
| `pre:edit-write:gateguard-fact-force` | Write\|Edit\|MultiEdit | 首次编辑前要求调查 |

#### PostToolUse（工具使用后）
| Hook ID | 匹配器 | 功能 |
|---------|--------|------|
| `post:bash:dispatcher` | Bash | Bash 后处理 |
| `post:quality-gate` | Edit\|Write\|MultiEdit | 质量门控检查 |
| `post:edit:design-quality-check` | Edit\|Write\|MultiEdit | 前端设计质量检查 |
| `post:edit:accumulator` | Edit\|Write\|MultiEdit | 记录已编辑文件路径 |
| `post:governance-capture` | Bash\|Write\|Edit\|MultiEdit | 治理事件捕获 |
| `post:session-activity-tracker` | * | 会话活动追踪 |
| `post:ecc-metrics-bridge` | * | 会话指标聚合 |
| `post:ecc-context-monitor` | * | 上下文耗尽/成本/循环警告 |

#### Stop（响应结束）
| Hook ID | 功能 |
|---------|------|
| `stop:format-typecheck` | 批量格式化和类型检查 |
| `stop:check-console-log` | 检查 console.log |
| `stop:session-end` | 持久化会话状态 |
| `stop:evaluate-session` | 评估会话提取模式 |
| `stop:cost-tracker` | Token 和成本追踪 |
| `stop:desktop-notify` | 桌面通知 |

Hook 运行时支持配置化控制：
```bash
export ECC_HOOK_PROFILE=minimal|standard|strict
export ECC_DISABLED_HOOKS="pre:bash:tmux-reminder,post:edit:typecheck"
```

### 2.4 规则系统（Rules）

规则位于 `rules/` 目录，按语言分层组织：

```
rules/
├── common/              # 通用原则（必装）
│   ├── coding-style.md
│   ├── git-workflow.md
│   ├── testing.md
│   ├── performance.md
│   ├── patterns.md
│   ├── hooks.md
│   ├── agents.md
│   └── security.md
├── typescript/
├── python/
├── golang/
├── swift/
├── php/
└── arkts/
```

### 2.5 持续学习系统（Continuous Learning v2）

基于"本能"（Instinct）的学习系统：

- **本能提取** — Stop Hook 自动评估会话，提取可复用模式
- **置信度评分** — 每个本能有置信度分数，随使用增长
- **本能进化** — `/evolve` 命令将相关本能聚类为正式技能
- **导入/导出** — 支持团队间共享本能集合
- **修剪** — `/prune` 删除过期的待定本能

学习流程：
```
会话执行 → Stop Hook 评估 → 提取模式 → 创建本能（pending）
→ 多次验证 → 置信度提升 → /evolve 聚类 → 正式技能
```

### 2.6 安全系统（AgentShield）

独立的安全审计工具：

- **规模**：1282 个测试、98% 覆盖率、102 条静态分析规则
- **扫描目标**：CLAUDE.md、settings.json、MCP 配置、Hooks、代理定义、技能
- **5 大扫描类别**：
  1. 密钥检测（14 种模式）
  2. 权限审计
  3. Hook 注入分析
  4. MCP 服务器风险画像
  5. 代理配置审查
- **`--opus` 模式**：三个 Claude Opus 代理组成红队/蓝队/审计员管道
- **输出格式**：终端（A-F 颜色分级）、JSON（CI 管道）、Markdown、HTML

使用方式：
```bash
npx ecc-agentshield scan          # 快速扫描
npx ecc-agentshield scan --fix    # 自动修复
npx ecc-agentshield scan --opus --stream  # 深度三代理分析
npx ecc-agentshield init          # 从零生成安全配置
```

### 2.7 记忆持久化系统

通过 Hook 实现跨会话记忆：

```
SessionStart → 加载上次会话状态
     ↓
工作执行中 → PostToolUse Hook 持续追踪活动
     ↓
PreCompact → 上下文压缩前保存关键信息
     ↓
Stop → 保存当前会话状态 + 评估可提取模式
     ↓
SessionEnd → 生命周期标记
```

### 2.8 命令系统

**活跃命令**（`commands/` 目录）：
- `/plan` — 实现规划
- `/code-review` — 质量审查
- `/build-fix` — 修复构建错误
- `/refactor-clean` — 死代码移除
- `/quality-gate` — 验证门控
- `/learn` — 会话中提取模式
- `/skill-create` — 从 git 历史生成技能
- `/instinct-status`, `/instinct-import`, `/instinct-export` — 本能管理
- `/evolve` — 本能聚类为技能
- `/multi-plan`, `/multi-execute`, `/multi-workflow` — 多代理编排
- `/sessions` — 会话历史管理

### 2.9 ECC 2.0 控制平面（Alpha）

`ecc2/` 目录包含 Rust 编写的控制平面原型：

- `ecc dashboard` — 仪表板
- `ecc start` — 启动会话
- `ecc sessions` — 列出会话
- `ecc status` — 状态报告
- `ecc stop` — 停止会话
- `ecc resume` — 恢复会话
- `ecc daemon` — 守护进程模式

### 2.10 桌面仪表板 GUI

`ecc_dashboard.py`（Tkinter）提供可视化探索界面：
- 标签页界面：Agents、Skills、Commands、Rules、Settings
- 深色/浅色主题切换
- 跨所有组件的搜索和过滤

---

## 三、实现架构 / Implementation Architecture

### 3.1 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 核心脚本 | Node.js (>=18)、TypeScript | Hook 运行时、安装器、CLI 工具 |
| Hook 运行时 | Node.js | 跨平台 Hook 执行 |
| 控制平面 (ECC2) | Rust | 高性能守护进程、会话管理 |
| 安全扫描 | Node.js + Claude API | AgentShield 静态分析 + AI 红队 |
| 仪表板 | Python (Tkinter) | 桌面 GUI |
| 技能/规则/代理 | Markdown + YAML | 声明式配置 |

### 3.2 仓库结构

```
everything-claude-code/
├── agents/                  # 60 个专业子代理定义
├── skills/                  # 229 个技能（SKILL.md 格式）
├── rules/                   # 分层规则系统
│   ├── common/              # 通用规则
│   ├── typescript/          # TS 特定规则
│   ├── python/              # Python 特定规则
│   └── ...                  # 其他语言
├── hooks/                   # Hook 配置和脚本
│   ├── hooks.json           # Hook 注册表
│   └── memory-persistence/  # 记忆持久化 Hook
├── commands/                # 活跃命令
├── legacy-command-shims/    # 75 个遗留命令重定向
├── scripts/                 # Hook 运行时脚本
│   ├── hooks/               # Hook 实现
│   ├── orchestrate-worktrees.js  # Git Worktree 编排
│   └── orchestrate-codex-worker.sh
├── ecc2/                    # Rust 控制平面（Alpha）
├── security/                # AgentShield 安全扫描器
├── docs/                    # 文档
├── CLAUDE.md                # 主配置入口
├── RULES.md                 # 规则摘要
├── SOUL.md                  # 核心原则
├── AGENTS.md                # 代理系统说明
├── ecc_dashboard.py         # Tkinter 仪表板
└── package.json             # 项目元数据
```

### 3.3 Hook 执行架构

```
用户操作 → Claude Code 事件触发
  → hooks.json 匹配事件类型和工具名
    → 执行对应 Node.js 脚本
      → 脚本返回结果（pass/block/warn）
        → 结果注入代理上下文或阻止操作
```

Hook 支持三种严格度配置：
- `minimal` — 仅关键安全检查
- `standard` — 标准质量门控
- `strict` — 全部 Hook 启用

### 3.4 多代理编排架构

```
用户请求 → 主代理（Claude Code）
  ├── 识别任务类型
  ├── 选择专业子代理
  │   ├── code-reviewer（代码审查）
  │   ├── build-error-resolver（构建修复）
  │   ├── tdd-guide（TDD 指导）
  │   └── ...
  ├── 委派任务
  ├── 收集结果
  └── 综合响应
```

支持 PM2 + Git Worktree 的并行多代理执行模式。

### 3.5 持续学习架构

```
会话 N
  → Stop Hook: evaluate-session.js
    → 分析会话中的模式
      → 提取本能（instinct）
        → 写入 .instincts/ 目录
          → 置信度: 0.3 (pending)

会话 N+1, N+2, ...
  → 相同模式再次出现
    → 置信度递增
      → 达到阈值 → 可进化

/evolve 命令
  → 聚类相关本能
    → 生成正式技能（SKILL.md）
      → 加入技能库
```

---

## 四、内容概况 / Content Overview

### 4.1 规模统计

| 组件 | 数量 |
|------|------|
| 专业子代理 | 60 |
| 技能 | 229 |
| Hook 事件处理器 | 25+ |
| 活跃命令 | 20+ |
| 遗留命令 Shim | 75 |
| 规则文件 | 8+ (common) + 语言特定 |
| 安全规则 | 102 条静态分析 |
| 安全测试 | 1,282 |

### 4.2 覆盖领域

ECC 的技能覆盖了远超编程的领域：

- **软件工程**：TDD、代码审查、调试、重构、部署
- **多语言支持**：TypeScript、Python、Go、Java、Kotlin、Rust、C++、Swift、PHP、Dart、F#、Perl
- **AI/ML**：模型训练、评估、部署、成本优化
- **安全**：代码安全、DeFi 安全、HIPAA 合规、代理安全
- **商业运营**：市场研究、投资者材料、品牌声音、内容引擎
- **基础设施**：Docker、CI/CD、数据库、网络
- **媒体制作**：视频编辑、动画、演示文稿
- **供应链**：物流、库存、海关合规

### 4.3 安装方式

```bash
# 一键安装（推荐）
npx ecc-installer

# 手动安装
git clone https://github.com/affaan-m/everything-claude-code.git ~/.ecc
cd ~/.ecc && npm install
```

安装器自动：
- 检测已有配置
- 合并规则和技能
- 配置 Hook
- 设置 AgentShield

---

## 五、独特差异化 / Unique Differentiators

### 5.1 与 Superpowers 的对比

| 维度 | ECC | Superpowers |
|------|-----|-------------|
| **规模** | 229 技能 + 60 代理 | 14 技能 |
| **覆盖面** | 编程 + 商业 + 运营 + 安全 | 纯软件开发流程 |
| **运行时** | 有（Hook 脚本、控制平面） | 无（纯文档） |
| **学习能力** | 有（持续学习系统） | 无 |
| **安全工具** | 有（AgentShield） | 无 |
| **哲学** | 全面覆盖、电池全含 | 精简、方法论纯粹 |

### 5.2 核心差异化

1. **"电池全含"哲学** — 不是教你方法论，而是直接给你 229 个即用技能
2. **持续学习** — 代理能从自身经验中学习，形成"本能"并进化为正式技能
3. **安全即一等公民** — AgentShield 不是附加功能，而是核心组件
4. **Hook 驱动自动化** — 不依赖代理"记住"规则，而是在系统层面强制执行
5. **跨领域覆盖** — 从编程到商业运营到供应链管理，一套系统覆盖所有
6. **ECC2 控制平面** — 向真正的"代理操作系统"方向演进

---

## 六、总结

ECC 代表了 Agent Harness 的"最大化"路线——通过海量的技能、代理、Hook 和规则，构建一个全方位的 AI 代理增强系统。它的成功（182k stars）证明了市场对"开箱即用的完整解决方案"的强烈需求。

与 Superpowers 的"方法论纯粹主义"不同，ECC 选择了"实用主义全覆盖"——不管你做什么工作，ECC 都有对应的技能和代理来帮助你。这种"瑞士军刀"式的设计使其成为目前最全面的 Agent Harness 之一。
