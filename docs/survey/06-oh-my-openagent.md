# Oh My OpenAgent (OmO) 深度研究报告

## 项目概览

| 属性 | 详情 |
|------|------|
| **仓库地址** | https://github.com/code-yeongyu/oh-my-openagent |
| **作者** | YeonGyu-Kim (@code-yeongyu) |
| **当前版本** | v4.1.2 (2026-05-14) |
| **Stars** | 57.9k |
| **Forks** | 4.7k |
| **主要语言** | TypeScript (93.3%) |
| **运行时** | Bun |
| **许可证** | SUL-1.0 |
| **npm 包名** | `oh-my-opencode` (过渡期同时发布为 `oh-my-openagent`) |
| **默认分支** | `dev` |
| **提交数** | 6,119 |
| **Release 数** | 177 |

---

## 一、设计思想 / Design Philosophy

### 核心理念："人类介入是失败信号"

OmO 的哲学基础来自其 Ultrawork Manifesto，核心观点是：

> **Human Intervention is a Failure Signal** — 人类在 Agent 工作过程中的介入，不是"人机协作"，而是系统的失败。

类比自动驾驶：当人类需要接管方向盘时，那不是功能，而是系统无法处理当前情况的失败。OmO 认为编码 Agent 也应如此——Agent 应该能够独立完成工作，无需人类"保姆式"监督。

当你发现自己在：
- 修复 AI 写了一半的代码
- 手动纠正明显错误
- 一步步引导 Agent 完成任务
- 反复澄清相同的需求

这不是"人机协作"，这是 AI 在失败。

### 五大设计原则

1. **不可区分的代码质量（Indistinguishable Code）** — Agent 写出的代码应与资深工程师写的代码无法区分。不是"需要清理的 AI 生成代码"，不是"一个好的起点"，而是实际的、最终的、生产就绪的代码。

2. **Token 成本 vs 生产力** — 更高的 Token 消耗是可接受的，只要能显著提升生产力（10x-100x）。多个专业 Agent 并行研究、彻底验证、跨任务积累知识——这些都值得投入。

3. **最小化人类认知负担** — 人类只需表达"想要什么"，其余全部由 Agent 处理。两种方式：Prometheus（面试模式，Agent 问你问题）和 Ultrawork（直接做，Agent 自己搞定一切）。

4. **可预测、持续、可委托** — 像编译器一样：Markdown 文档输入，可运行代码输出。工作应能在中断后恢复。

5. **多模型编排是唯一正确架构** — 不同模型有不同"性格"。Claude 深度思考，GPT 架构推理，Gemini 视觉化，Haiku 快速移动。单模型工具强迫你为所有任务选择一种人格。OmO 利用所有模型的优势，按任务类型路由。

### 与 OpenCode 的关系

OmO 是 **OpenCode 的插件（Plugin）**，不是独立工具。它通过 OpenCode 的插件系统运行，将 OpenCode 从"单 Agent 单模型"转变为"多 Agent 多模型协调团队"。

如果说 OpenCode 是 Debian/Arch，那么 OmO 就是 Ubuntu/Omarchy —— 开箱即用、电池全含。

### 核心循环

```
Human Intent → Agent Execution → Verified Result
       ↑                              ↓
       └──────── Minimum ─────────────┘
          (intervention only on true failure)
```

---

## 二、核心特性 / Core Features

### 2.1 多模型 Agent 编排系统

OmO 的核心创新是**基于类别（Category）的自动模型路由**。Agent 不选择模型名称，而是选择**任务类别**，系统自动映射到最优模型：

| 类别 | 默认模型 | 用途 |
|------|----------|------|
| `visual-engineering` | `google/gemini-3.1-pro` | 前端/UI/UX/设计/样式/动画 |
| `ultrabrain` | `openai/gpt-5.5` (xhigh) | 深度逻辑推理、复杂架构决策 |
| `deep` | `openai/gpt-5.5` (medium) | 目标导向的自主问题解决 |
| `artistry` | `google/gemini-3.1-pro` (high) | 高度创意/艺术任务 |
| `quick` | `openai/gpt-5.4-mini` | 单文件修改、拼写修复 |
| `unspecified-low` | `anthropic/claude-sonnet-4-6` | 低难度通用任务 |
| `unspecified-high` | `anthropic/claude-opus-4-7` (max) | 高难度通用任务 |
| `writing` | `google/gemini-3-flash` | 文档、散文、技术写作 |

### 2.2 纪律 Agent 体系（11 个内置 Agent）

#### 主要 Agent（Primary，可通过 Tab 切换）

| Agent | 模型 | 角色 |
|-------|------|------|
| **Sisyphus** | claude-opus-4-7 | 纪律 Agent / 主编排器。计划、委派、驱动完成，永不停止 |
| **Hephaestus** | gpt-5.5 | 合法工匠 / 自主深度工作者。给目标不给步骤，端到端执行 |
| **Prometheus** | claude-opus-4-7 | 战略规划器。面试模式，只读，只能创建 markdown 计划 |
| **Atlas** | claude-sonnet-4-6 | 执行指挥官。读取计划、分析任务、委派，不能自己写代码 |

#### 辅助 Agent（Subagent，通过工具调用）

| Agent | 模型 | 用途 | 限制 |
|-------|------|------|------|
| **Oracle** | gpt-5.5 | 架构决策、代码审查、调试 | 只读 |
| **Librarian** | gpt-5.4-mini-fast | 多仓库分析、文档查找 | 只读 |
| **Explore** | gpt-5.4-mini-fast | 快速代码库探索 | 只读 |
| **Multimodal-Looker** | gpt-5.5 | PDF/图片/图表视觉分析 | 只读 |
| **Metis** | claude-sonnet-4-6 | 计划缺口分析器 | 只读 |
| **Momus** | gpt-5.5 | 计划审查器 | 只读 |
| **Sisyphus-Junior** | 类别依赖 | 类别派生执行器 | 不能再委派 |

### 2.3 Hash-Anchored Edit Tool (Hashline)

**问题：** 大多数 Agent 失败不是模型的错，而是编辑工具的错。现有工具都依赖模型重现它已经看过的内容。

**解决方案：** 每行带有内容哈希标签：

```
11#VK| function hello() {
22#XJ|   return "world";
33#MB| }
```

Agent 通过引用 `LINE#ID` 标签进行编辑。如果文件自上次读取后发生变化，哈希不匹配则编辑被拒绝。

**效果：** Grok Code Fast 1 的编辑成功率从 **6.7% → 68.3%**，仅仅通过更换编辑工具。

### 2.4 Team Mode (v4.0)

将 OmO 从"一个 Agent + 子 Agent"升级为真正的多 Agent 系统：

- Lead Agent + 最多 8 个并行成员
- 12 个 `team_*` 工具
- 共享延迟确认邮箱
- 共享任务列表（文件锁定声明）
- 可选的每成员 git worktree
- 实时 tmux 布局可视化

内置 Team Mode 技能：
- **`hyperplan`** — 5 个敌对 Agent 从正交角度撕裂你的计划
- **`security-research`** — 3 个漏洞猎手 + 2 个 PoC 工程师并行审计

### 2.5 IntentGate 意图门

在执行任何请求前，Sisyphus 先分类用户的**真实意图**：

- 你在要求研究？实现？调查？修复？
- 不只是字面文字，而是真正想要什么
- 激活关键词检测：`ultrawork`/`ulw`, `search`, `analyze`, `team` 模式

### 2.6 `ultrawork` / `ulw` 一键模式

输入 `ultrawork` 或 `ulw`，所有 Agent 激活：
- 自动探索代码库
- 研究模式和最佳实践
- 实现功能
- 用诊断验证
- 持续工作直到完成

### 2.7 Ralph Loop / Todo Enforcer

**Ralph Loop (`/ralph-loop`, `/ulw-loop`)：**
- 自引用开发循环，持续运行直到任务完成
- 检测 `<promise>DONE</promise>` 知道何时完成
- 默认最大迭代 100 次

**Todo Enforcer：**
- Agent 空闲时系统强制拉回继续工作
- 注入系统提醒："你有未完成的 todo！"

**Comment Checker：**
- 运行 `@code-yeongyu/comment-checker` 阻止 AI 生成的低质量注释模式

### 2.8 LSP + AST-Grep 工具

**LSP 工具（IDE 精度给 Agent）：**

| 工具 | 功能 |
|------|------|
| `lsp_diagnostics` | 构建前获取错误/警告 |
| `lsp_prepare_rename` | 验证重命名操作 |
| `lsp_rename` | 跨工作区重命名符号 |
| `lsp_goto_definition` | 跳转到符号定义 |
| `lsp_find_references` | 查找跨工作区所有用法 |
| `lsp_symbols` | 获取文件大纲或工作区符号搜索 |

**AST-Grep 工具：**

| 工具 | 功能 |
|------|------|
| `ast_grep_search` | AST 感知代码模式搜索（25 种语言） |
| `ast_grep_replace` | AST 感知代码替换 |

### 2.9 Skill 系统与 Skill-Embedded MCPs

**技能不只是提示词。** 每个技能带来：
- 领域调优的系统指令
- 嵌入式 MCP 服务器（按需启动）
- 作用域权限

**内置技能：**

| 技能 | 触发条件 | 描述 |
|------|----------|------|
| `git-master` | commit, rebase, squash | Git 专家 |
| `playwright` | 浏览器任务、测试 | Playwright MCP 浏览器自动化 |
| `agent-browser` | agent-browser 浏览器任务 | agent-browser CLI 自动化 |
| `dev-browser` | 有状态浏览器脚本 | 持久页面状态浏览器自动化 |
| `frontend-ui-ux` | UI/UX 任务 | 设计师转开发者人格 |
| `review-work` | "review work", "QA my work" | 5 个并行子 Agent 综合审查 |
| `ai-slop-remover` | "remove AI slop" | 移除 AI 代码异味 |

**Skill-Embedded MCP 隔离**：使用复合键 `${sessionID}:${skillName}:${serverName}` 防止状态泄漏。

**技能加载位置（优先级从高到低）：**
1. `.opencode/skills/*/SKILL.md`（项目，OpenCode 原生）
2. `~/.config/opencode/skills/*/SKILL.md`（用户，OpenCode 原生）
3. `.claude/skills/*/SKILL.md`（项目，Claude Code 兼容）
4. `.agents/skills/*/SKILL.md`（项目，Agents 约定）
5. `~/.agents/skills/*/SKILL.md`（用户，Agents 约定）

### 2.10 深度初始化 `/init-deep`

自动生成分层 `AGENTS.md` 文件：

```
project/
├── AGENTS.md              ← 项目级上下文
├── src/
│   ├── AGENTS.md          ← src 级上下文
│   └── components/
│       └── AGENTS.md      ← 组件级上下文
```

零手动管理。Agent 读取文件时自动注入相关目录的 AGENTS.md。

### 2.11 后台 Agent 系统

- 启动 5+ 专家并行工作
- 上下文保持精简
- 结果就绪时通知
- 并发默认 5，可配置

### 2.12 Tmux 集成

完整交互终端：REPL、调试器、TUI 应用。

- 后台 Agent 在新 pane 中生成
- 实时观看多个 Agent 工作
- Agent 完成时自动清理
- 支持 cmux 兼容

### 2.13 会话工具与恢复

**会话工具**：`session_list`, `session_read`, `session_search`, `session_info`

**会话恢复**：自动从常见故障中恢复：
- 缺失工具结果
- 思考块违规
- 空消息
- 上下文窗口限制
- JSON 解析错误

### 2.14 Doctor 命令

内置诊断：`bunx oh-my-opencode doctor`
- 验证插件注册
- 检查配置
- 验证模型可用性
- 检查环境

---

## 三、实现架构 / Implementation Architecture

### 3.1 技术栈

| 层面 | 技术 |
|------|------|
| 语言 | TypeScript (93.3%) + HTML (6.3%) |
| 运行时 | Bun |
| 包管理 | Bun (bun.lock) |
| 构建 | `bun build` (ESM, target bun) + `tsc --emitDeclarationOnly` |
| 类型检查 | `tsgo` (TypeScript Native Preview 7.0.0-dev) |
| 测试 | `bun test` |
| 插件接口 | `@opencode-ai/plugin` ^1.4.0, `@opencode-ai/sdk` ^1.4.0 |
| LSP 通信 | `vscode-jsonrpc` ^8.2.1 |
| AST 操作 | `@ast-grep/napi` ^0.41.1 |
| MCP 协议 | `@modelcontextprotocol/sdk` ^1.29.0 |
| Schema 验证 | Zod ^4.4.3 |
| CLI 框架 | `commander` ^14.0.3 |

### 3.2 仓库目录结构

```
oh-my-openagent/
├── .agents/                    # Agent 配置文件
├── .opencode/                  # OpenCode 插件配置
├── .sisyphus/rules/            # Sisyphus 规则定义
├── assets/                     # 静态资源、JSON Schema
├── bin/                        # CLI 入口
│   └── oh-my-opencode.js
├── docs/                       # 完整文档体系
│   ├── guide/                  # 用户指南
│   │   ├── overview.md
│   │   ├── installation.md
│   │   ├── orchestration.md
│   │   ├── team-mode.md
│   │   └── agent-model-matching.md
│   ├── reference/              # 参考文档
│   │   ├── features.md
│   │   └── configuration.md
│   ├── legal/                  # 法律文档
│   └── manifesto.md            # Ultrawork 设计宣言
├── packages/                   # 平台特定预编译二进制包 (11 个平台)
│   ├── darwin-arm64/
│   ├── darwin-x64/
│   ├── linux-arm64/
│   ├── linux-x64/
│   ├── windows-x64/
│   └── ...
├── script/                     # 构建和工具脚本
├── signatures/                 # 签名文件
├── src/                        # 核心源码
│   ├── agents/                 # Agent 定义、提示词、配置
│   ├── cli/                    # CLI 命令实现
│   ├── config/                 # 配置加载、验证
│   ├── features/               # 20 个功能模块
│   ├── generated/              # 自动生成代码
│   ├── hooks/                  # 54-61 个生命周期钩子
│   ├── mcp/                    # MCP 服务器集成
│   ├── openclaw/               # OpenClaw 双向集成
│   └── plugin-handlers/        # 插件处理器
├── package.json
└── tsconfig.json
```

### 3.3 插件架构

OmO 作为 OpenCode 插件运行，通过以下接口集成：

```typescript
// 插件注册
import { definePlugin } from "@opencode-ai/plugin";

export default definePlugin({
  name: "oh-my-openagent",
  version: "4.1.2",
  agents: [...],           // Agent 定义
  tools: [...],            // 自定义工具
  hooks: [...],            // 生命周期钩子
  skills: [...],           // 技能定义
  mcpServers: [...],       // MCP 服务器
  commands: [...],         // 斜杠命令
});
```

### 3.4 Agent 调度架构

```
用户输入
  → IntentGate（意图分类）
    → 路由到主 Agent（Sisyphus/Hephaestus/Prometheus/Atlas）
      → 主 Agent 分析任务
        → 选择类别（Category）
          → 系统映射到最优模型
            → 执行或委派给子 Agent
              → 子 Agent 返回结果
                → Todo Enforcer 检查完成度
                  → 未完成？继续推进
                  → 完成？返回结果
```

### 3.5 Hashline 编辑架构

```
文件读取
  → 为每行生成内容哈希（16 字符集：ZPMQVRWSNKTXJBYH）
    → 返回带标签的内容：`LINE#HASH| content`
      → Agent 引用 LINE#HASH 进行编辑
        → 编辑时验证哈希是否匹配当前文件状态
          → 匹配 → 执行编辑
          → 不匹配 → 拒绝编辑（文件已变更）
```

---

## 四、内容概况 / Content Overview

### 4.1 规模统计

| 组件 | 数量 |
|------|------|
| 主 Agent | 4 |
| 子 Agent | 7 |
| 类别路由 | 8 |
| LSP 工具 | 6 |
| AST 工具 | 2 |
| Team 工具 | 12 |
| 会话工具 | 4 |
| 内置技能 | 7 |
| 远程 MCP | 3 |
| 生命周期钩子 | 54-61 |
| 功能模块 | 20 |
| 平台二进制 | 11 |
| Release 数 | 177 |

### 4.2 支持的平台

- macOS ARM64 / x64
- Linux ARM64 / x64 (glibc + musl)
- Windows x64

### 4.3 内置远程 MCP

- `websearch` (Exa) — 网络搜索
- `context7` — 官方文档查询
- `grep_app` — GitHub 代码搜索

---

## 五、独特差异化 / Unique Differentiators

### 5.1 与其他 Harness 的对比

| 维度 | OmO | Superpowers | ECC | DeerFlow |
|------|-----|-------------|-----|----------|
| **形态** | OpenCode 插件 | 跨平台插件 | Claude Code 配置 | 独立服务 |
| **多模型** | 核心特性（8 类别路由） | 无 | 无 | 模型工厂 |
| **编辑工具** | Hashline（创新） | 无 | 无 | str_replace |
| **LSP 集成** | 有（6 工具） | 无 | 无 | 无 |
| **AST 操作** | 有（ast-grep） | 无 | 无 | 无 |
| **Team Mode** | 有（8 并行） | 并行子代理 | PM2 多代理 | 3 并发子智能体 |
| **哲学** | 人类介入=失败 | 纪律方法论 | 全覆盖优化 | 运行时基座 |

### 5.2 核心差异化

1. **"人类介入是失败信号"哲学** — 最激进的自主性主张。不是"人机协作"，而是追求完全自主执行。

2. **Hashline 编辑工具** — 解决了 Agent 编辑失败的根本原因（不是模型的错，是工具的错），将编辑成功率从 6.7% 提升到 68.3%。

3. **基于类别的多模型路由** — 不是简单的"用最强模型"，而是按任务性质自动选择最适合的模型。这是真正的多模型编排，不是模型切换。

4. **LSP + AST-Grep 集成** — 给 Agent 提供了 IDE 级别的代码理解能力，而不仅仅是文本搜索。

5. **IntentGate** — 在执行前先理解用户的真实意图，避免"拿到提示就跑"的问题。

6. **Ralph Loop + Todo Enforcer** — 系统级的"不完成不罢休"机制，Agent 不能谎称完成。

7. **Team Mode 的敌对设计** — `hyperplan` 技能让 5 个 Agent 从正交角度攻击你的计划，这是真正的"红队"思维。

---

## 六、总结

OmO 代表了 Agent Harness 的"极致自主"路线。它的核心信念是：如果人类需要介入 Agent 的工作，那不是功能，而是失败。

为了实现这一目标，OmO 在三个层面进行了创新：

1. **工具层**：Hashline 编辑、LSP 集成、AST-Grep——给 Agent 更可靠的操作能力
2. **编排层**：多模型类别路由、IntentGate、Team Mode——让正确的 Agent 用正确的模型做正确的事
3. **纪律层**：Ralph Loop、Todo Enforcer、Comment Checker——系统级保证完成质量

OmO 的成功（57.9k stars）证明了"极致自主"这一设计方向的市场吸引力——开发者不想当 AI 的保姆，他们想要一个能独立完成工作的队友。
