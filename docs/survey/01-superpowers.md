# obra/superpowers 深度研究报告

## 项目概览

| 属性 | 详情 |
|------|------|
| **仓库地址** | https://github.com/obra/superpowers |
| **作者** | Jesse Vincent (obra) / Prime Radiant |
| **版本** | v5.1.0 |
| **许可证** | MIT |
| **Stars** | 192k |
| **Forks** | 17.1k |
| **主要语言** | Shell (66.4%), JavaScript (24.8%), HTML (3.3%), Python (2.8%), TypeScript (2.1%) |
| **定位** | AI 编程代理的技能框架与软件开发方法论 |

---

## 一、设计思想 / Design Philosophy

### 核心理念

Superpowers 不是一个传统的代码库或工具——它是一套**完整的软件开发方法论**，以可组合的"技能"(Skills) 形式注入到 AI 编程代理中，从根本上改变代理的行为模式。

其核心信念可以概括为：

> **AI 编程代理天生倾向于"跳过思考直接写代码"，这是灾难性的。Superpowers 通过强制性的流程约束，让代理像一个有纪律的高级工程师一样工作。**

### 解决的问题

1. **代理的"冲动编码"问题**：AI 代理收到需求后会立即开始写代码，跳过设计、规划、测试等关键步骤
2. **上下文污染问题**：长时间对话导致代理偏离计划、遗忘约束
3. **质量失控问题**：代理不做 TDD、不做代码审查、不验证结果就宣称完成
4. **自主性与可控性的矛盾**：如何让代理长时间自主工作（数小时）而不偏离方向

### 方法论主张

Superpowers 倡导的四大原则：

1. **测试驱动开发 (TDD)** — 永远先写测试，没有例外
2. **系统化优于临时性** — 流程优于猜测
3. **复杂度削减** — 简单性是首要目标 (YAGNI)
4. **证据优于声明** — 验证后才能宣称成功

### 独特的"人类伙伴"视角

Superpowers 刻意使用 "your human partner"（你的人类伙伴）而非 "the user"（用户）来称呼开发者。这不是修辞——它塑造了代理的行为模式：代理被定位为**协作伙伴**而非**服务工具**，因此它有责任推回不合理的请求、保护人类免于尴尬（如提交低质量 PR）。

---

## 二、核心特性 / Core Features

### 2.1 完整的开发工作流

Superpowers 定义了一个从构思到交付的完整流水线，每个阶段都有对应的 Skill 自动触发：

```
brainstorming → using-git-worktrees → writing-plans → subagent-driven-development → test-driven-development → requesting-code-review → finishing-a-development-branch
```

**关键特征：技能自动触发，不需要人工干预。** 代理在每个任务前自动检查是否有相关技能需要激活。

### 2.2 子代理驱动开发 (Subagent-Driven Development)

这是 Superpowers 最具创新性的特性：

- **每个任务分派一个全新的子代理**，避免上下文污染
- **两阶段审查**：先审查规格合规性 (spec compliance)，再审查代码质量 (code quality)
- **持续执行**：不在任务间暂停询问用户，除非真正被阻塞
- **模型分级**：机械性任务用便宜模型，架构决策用最强模型
- **四种状态处理**：DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED，每种有明确的处理策略
- **提示模板化**：包含 `implementer-prompt.md`、`spec-reviewer-prompt.md`、`code-quality-reviewer-prompt.md` 三个标准化提示模板

### 2.3 苏格拉底式头脑风暴 (Brainstorming)

在写任何代码之前强制执行的设计阶段：

- 逐个提问（每条消息只问一个问题）
- 优先使用多选题，降低用户回答成本
- 提出 2-3 种方案并给出推荐
- 分段展示设计，逐段获得用户确认
- 写入设计文档到 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` 并提交 git
- 包含自审查环节（检查占位符、矛盾、歧义、范围）
- **硬门控 (HARD-GATE)**：未获设计批准前，禁止任何实现行为
- **反模式防护**："这太简单不需要设计" — 每个项目都必须经过此流程
- **可视化伴侣**：可选的浏览器端 mockup/图表展示能力

### 2.4 严格的 TDD 执行

不是建议，而是**铁律**：

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

- 先写测试 → 看它失败 → 写最小代码 → 看它通过 → 重构
- 如果先写了代码？**删除它，从头开始**。不保留为"参考"，不"改编"，不看它
- 内置反合理化表格，预防代理找借口跳过 TDD
- 包含"红旗"列表，代理可以自我检查是否在合理化
- 明确声明："Violating the letter of the rules is violating the spirit of the rules"
- 验证清单：每个新函数有测试、看过每个测试失败、失败原因正确、写了最小代码、所有测试通过、输出干净

### 2.5 系统化调试 (Systematic Debugging)

四阶段根因分析流程：

1. **根因调查 (Phase 1)** — 读错误信息、复现、检查变更、在多组件系统中添加诊断仪器、追踪数据流
2. **模式分析 (Phase 2)** — 找到工作示例、对比参考实现、识别差异、理解依赖
3. **假设与测试 (Phase 3)** — 科学方法，一次只改一个变量，形成明确假设
4. **实现修复 (Phase 4)** — 先写失败测试，再修复，验证

**铁律**：如果 3 次修复都失败了，停下来质疑架构（Phase 4.5），而不是继续打补丁。与人类伙伴讨论后再继续。

**支撑技术文档**：
- `root-cause-tracing.md` — 通过调用栈反向追踪 bug
- `defense-in-depth.md` — 找到根因后在多层添加验证
- `condition-based-waiting.md` — 用条件轮询替代任意超时

### 2.6 并行代理调度 (Dispatching Parallel Agents)

当面对多个独立问题时：

- 按问题域分组（如：工具审批流 / 批量完成行为 / 中止功能）
- 每个域分派一个专注的代理，提供精确的范围、目标、约束
- 并行执行，互不干扰
- 最后审查整合，检查冲突，运行完整测试套件
- **明确的不适用场景**：故障相关联时、需要理解全系统状态时、代理会互相干扰时

### 2.7 实现计划编写 (Writing Plans)

将设计转化为可执行的详细计划：

- **2-5 分钟粒度**的任务步骤
- 每步包含：精确文件路径、完整代码、验证命令、预期输出
- **禁止占位符**：不允许 "TBD"、"TODO"、"类似任务 N"、"添加适当的错误处理"
- 包含文件结构映射（在定义任务前先确定文件职责）
- 自审查环节：规格覆盖检查、占位符扫描、类型一致性检查
- 执行交接：提供子代理驱动（推荐）或内联执行两种选择

### 2.8 Git Worktree 隔离

每个开发任务在独立的 git worktree 中进行：

- 新分支 + 隔离工作区
- 运行项目设置，验证测试基线干净
- 完成后提供选项：合并/PR/保留/丢弃
- 清理 worktree

### 2.9 代码审查工作流

双向审查支持：

- `requesting-code-review` — 审查前检查清单，按严重程度报告问题，关键问题阻止进展
- `receiving-code-review` — 响应反馈的标准流程

---

## 三、实现架构 / Implementation Architecture

### 3.1 技术栈

Superpowers 是一个**零依赖的纯文档/配置项目**。它不是传统意义上的"软件"——它是一套注入到 AI 代理系统提示中的指令集。

| 组件 | 技术 |
|------|------|
| 技能定义 | Markdown (SKILL.md) + YAML frontmatter |
| 插件元数据 | JSON (plugin.json, marketplace.json) |
| 测试脚本 | Shell, JavaScript, Python |
| 流程图 | Graphviz DOT 语法（内嵌在 Markdown 中） |
| 包管理 | package.json (仅用于版本管理，无运行时依赖) |
| 图表渲染 | `render-graphs.js` (将 DOT 渲染为 SVG) |

### 3.2 仓库结构

```
superpowers/
├── .claude-plugin/              # Claude Code 插件配置
│   ├── plugin.json              # 插件元数据（名称、版本、作者、关键词）
│   └── marketplace.json         # 市场注册信息
├── .codex-plugin/               # OpenAI Codex 插件配置
├── .cursor-plugin/              # Cursor 插件配置
├── .opencode/                   # OpenCode 插件配置
│   └── plugins/superpowers.js   # OpenCode 入口
├── .github/                     # PR 模板、CI 配置
├── skills/                      # 核心技能库（14 个技能目录）
│   ├── brainstorming/
│   │   ├── SKILL.md
│   │   └── visual-companion.md
│   ├── dispatching-parallel-agents/
│   │   └── SKILL.md
│   ├── executing-plans/
│   │   └── SKILL.md
│   ├── finishing-a-development-branch/
│   │   └── SKILL.md
│   ├── receiving-code-review/
│   │   └── SKILL.md
│   ├── requesting-code-review/
│   │   └── SKILL.md
│   ├── subagent-driven-development/
│   │   ├── SKILL.md
│   │   ├── implementer-prompt.md
│   │   ├── spec-reviewer-prompt.md
│   │   └── code-quality-reviewer-prompt.md
│   ├── systematic-debugging/
│   │   ├── SKILL.md
│   │   ├── root-cause-tracing.md
│   │   ├── defense-in-depth.md
│   │   └── condition-based-waiting.md
│   ├── test-driven-development/
│   │   ├── SKILL.md
│   │   └── testing-anti-patterns.md
│   ├── using-git-worktrees/
│   │   └── SKILL.md
│   ├── using-superpowers/           # 引导技能（bootstrap）
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── copilot-tools.md
│   │       ├── codex-tools.md
│   │       └── gemini-tools.md
│   ├── verification-before-completion/
│   │   └── SKILL.md
│   ├── writing-plans/
│   │   └── SKILL.md
│   └── writing-skills/              # 元技能：如何创建新技能
│       ├── SKILL.md
│       ├── testing-skills-with-subagents.md
│       ├── persuasion-principles.md
│       ├── anthropic-best-practices.md
│       └── graphviz-conventions.dot
├── hooks/                       # Git hooks
├── scripts/                     # 辅助脚本
├── tests/                       # 技能测试
├── docs/                        # 文档
├── assets/                      # 资源文件
├── CLAUDE.md                    # Claude Code 贡献者指南
├── AGENTS.md                    # 通用代理指南
├── GEMINI.md                    # Gemini CLI 引导
├── package.json                 # {"name":"superpowers","version":"5.1.0"}
└── gemini-extension.json        # Gemini 扩展配置
```

### 3.3 多平台适配架构

Superpowers 的一个关键架构决策是**跨代理平台兼容**。同一套技能内容通过不同的适配层服务于 8+ 个平台：

| 平台 | 集成方式 | 配置目录/文件 |
|------|----------|---------------|
| Claude Code | 官方插件市场 | `.claude-plugin/plugin.json` |
| OpenAI Codex CLI | 官方插件市场 | `.codex-plugin/` |
| Gemini CLI | 扩展安装命令 | `gemini-extension.json` + `GEMINI.md` |
| OpenCode | 自定义安装指令 | `.opencode/plugins/superpowers.js` |
| Cursor | 插件市场 | `.cursor-plugin/` |
| GitHub Copilot CLI | 市场注册 | 通过 marketplace |
| Factory Droid | 市场注册 | 通过仓库 URL |

每个平台有不同的工具名称（如 Claude 的 `Skill` 工具 vs Gemini 的 `activate_skill` vs Copilot 的 `skill`），通过 `skills/using-superpowers/references/` 目录下的映射文件处理平台差异。

### 3.4 技能加载机制

```
会话启动 
  → 平台加载 using-superpowers (bootstrap skill)
    → 建立技能发现规则
      → 每条用户消息到达时：
        → 检查是否有技能适用（即使只有 1% 可能性）
          → 是 → 调用 Skill 工具加载技能内容
            → 宣布："Using [skill] to [purpose]"
              → 技能有检查清单？→ 创建 TodoWrite 逐项跟踪
                → 严格按技能指令执行
          → 否（绝对不适用）→ 正常响应
```

**关键设计决策**：

1. `using-superpowers` 是唯一在会话开始时自动加载的技能，它教会代理如何发现和使用其他技能
2. 技能按需加载（不是全部预加载），节省上下文窗口
3. 技能优先级：用户指令 > Superpowers 技能 > 默认系统提示
4. 流程技能优先于实现技能（brainstorming 先于 frontend-design）

### 3.5 技能文件格式规范

每个技能是一个目录，核心文件为 `SKILL.md`：

```yaml
---
name: skill-name-with-hyphens          # 仅字母、数字、连字符
description: Use when [触发条件]         # 第三人称，最大 1024 字符
---                                      # 遵循 agentskills.io/specification

# 技能标题

## Overview                              # 核心原则 1-2 句
## When to Use                           # 触发条件 + 可选 DOT 流程图
## The Process / Core Pattern            # 核心流程（含代码示例）
## Red Flags                             # 反模式/停止信号列表
## Common Rationalizations               # 反合理化表格
## Integration                           # 与其他技能的关系
```

**CSO (Claude Search Optimization)** — 技能的 description 字段经过精心优化以确保被正确发现：
- 只描述触发条件，不描述工作流
- 包含具体症状、错误信息、工具名称等搜索关键词
- 第三人称撰写

### 3.6 子代理通信协议

子代理驱动开发中的通信模式：

```
控制器代理 (Controller)
  ├── 读取计划文件，提取所有任务全文
  ├── 创建 TodoWrite 跟踪
  │
  ├── [Task N] 分派实现者子代理
  │   ├── 提供：任务全文 + 场景上下文 + 项目信息
  │   ├── 实现者返回状态：DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
  │   └── 实现者自审查后提交
  │
  ├── [Task N] 分派规格审查者子代理
  │   ├── 提供：任务规格 + git diff
  │   └── 返回：✅ 合规 / ❌ 问题列表
  │       └── 如有问题 → 实现者修复 → 重新审查（循环）
  │
  ├── [Task N] 分派代码质量审查者子代理
  │   ├── 提供：git SHAs + 代码变更
  │   └── 返回：✅ 批准 / ❌ 问题列表
  │       └── 如有问题 → 实现者修复 → 重新审查（循环）
  │
  └── [所有任务完成] 分派最终审查者 → finishing-a-development-branch
```

---

## 四、内容概况 / Content Overview

### 4.1 技能完整分类

**测试类 (Testing) — 1 个技能**

| 技能 | 触发条件 | 核心功能 |
|------|----------|----------|
| `test-driven-development` | 实现任何功能或修复 bug 前 | RED-GREEN-REFACTOR 循环，含反模式参考文档 |

**调试类 (Debugging) — 2 个技能**

| 技能 | 触发条件 | 核心功能 |
|------|----------|----------|
| `systematic-debugging` | 遇到任何 bug、测试失败或意外行为 | 四阶段根因分析流程 |
| `verification-before-completion` | 修复完成前 | 确保真正修复后才宣称完成 |

**协作类 (Collaboration) — 9 个技能**

| 技能 | 触发条件 | 核心功能 |
|------|----------|----------|
| `brainstorming` | 任何创造性工作前 | 苏格拉底式设计精炼，HARD-GATE 阻止未批准的实现 |
| `writing-plans` | 有规格/需求的多步骤任务前 | 2-5 分钟粒度的详细实现计划 |
| `executing-plans` | 有计划需要执行（并行会话模式） | 批量执行 + 人工检查点 |
| `subagent-driven-development` | 有计划需要执行（同会话模式） | 每任务一个子代理 + 两阶段审查 |
| `dispatching-parallel-agents` | 面对 2+ 个无共享状态的独立任务 | 并发子代理工作流 |
| `requesting-code-review` | 任务间 | 代码审查前检查清单 |
| `receiving-code-review` | 收到审查反馈时 | 响应反馈的标准流程 |
| `using-git-worktrees` | 设计批准后 | 创建隔离工作区 |
| `finishing-a-development-branch` | 所有任务完成时 | 验证测试、合并/PR/保留/丢弃决策 |

**元技能 (Meta) — 2 个技能**

| 技能 | 触发条件 | 核心功能 |
|------|----------|----------|
| `using-superpowers` | 每个会话开始时 | 引导技能，教代理如何发现和使用技能系统 |
| `writing-skills` | 创建/编辑/验证技能时 | TDD 应用于文档的完整方法论 |

### 4.2 支撑文档与资源

- **子代理提示模板** (`skills/subagent-driven-development/`)
- **调试辅助技术** (`skills/systematic-debugging/`)
- **技能编写辅助** (`skills/writing-skills/`)：含说服原理研究、Anthropic 官方指南
- **平台工具映射** (`skills/using-superpowers/references/`)

### 4.3 测试体系

Superpowers 的测试使用**子代理压力测试**方法论：

1. **压力场景设计**：组合多种压力（时间压力 + 沉没成本 + 权威压力 + 疲劳）
2. **基线测试 (RED)**：在没有技能的情况下运行场景，记录代理的违规行为
3. **合规测试 (GREEN)**：加载技能后运行相同场景，验证代理遵守规则
4. **漏洞封堵 (REFACTOR)**：发现新的合理化路径后添加显式反制

---

## 五、独特差异化 / Unique Differentiators

### 5.1 与其他代理框架的本质区别

| 维度 | Superpowers | 传统代理框架 (LangChain, CrewAI 等) |
|------|-------------|----------------------------------------------|
| **本质** | 方法论 + 行为塑造指令 | 代码库 + API + 运行时 |
| **依赖** | 零依赖 | 大量第三方依赖 |
| **实现语言** | Markdown/YAML（自然语言） | Python/TypeScript（编程语言） |
| **作用层** | 系统提示层（塑造已有代理的行为） | 应用层（构建新的代理系统） |
| **目标** | 让现有代理更可靠地工作 | 构建新的代理应用 |
| **跨平台** | 8+ 平台原生支持 | 通常绑定特定框架/模型 |
| **运行时开销** | 零（纯提示注入） | 有（框架运行时） |

### 5.2 核心差异化特征

#### 1. "不是代码，是纪律"

Superpowers 不提供任何运行时代码。它通过精心设计的自然语言指令来塑造 AI 代理的行为。这是一种全新的"编程"范式——**用文档编程 AI 的行为**。

#### 2. 反合理化工程 (Anti-Rationalization Engineering)

系统性地预测 AI 代理会如何找借口违反规则，并预先封堵每一个合理化路径：

| 借口 | 现实 |
|------|------|
| "太简单不需要测试" | 简单代码也会出错，测试只需 30 秒 |
| "我先写完再补测试" | 事后通过的测试什么都证明不了 |
| "删除 X 小时的工作太浪费" | 沉没成本谬误。保留未验证的代码才是技术债 |
| "TDD 太教条了，我在务实" | TDD 就是务实的：比调试更快发现 bug |

#### 3. 说服科学基础

`writing-skills` 技能引用了 Cialdini (2021) 和 Meincke (2025) 的说服原理研究，将行为心理学应用于 AI 代理的行为塑造。这不是拍脑袋写的规则——每条规则背后都有行为科学支撑。

#### 4. 94% PR 拒绝率

CLAUDE.md 中明确警告贡献者：94% 的 PR 会被拒绝。这不是傲慢——而是对质量标准的极端坚持。每个技能都经过反复的压力测试和迭代。

#### 5. 元技能 (Meta-Skill)

`writing-skills` 是一个教代理如何创建新技能的技能——这是自举 (bootstrapping) 的体现。它将 TDD 方法论应用于文档编写本身，形成了一个自我进化的系统。

---

## 六、总结

Superpowers 的本质贡献是证明了一个反直觉的命题：**最有效的 AI 编程工具不是代码，而是纪律**。通过精心设计的自然语言指令、反合理化工程和行为科学原理，它将 AI 代理从"冲动的初级程序员"转变为"有纪律的高级工程师"。

它的成功（192k stars）证明了市场对"AI 代理行为工程"这一新范式的强烈需求——开发者不只需要更强的模型，更需要让现有模型更可靠地工作的方法论。
