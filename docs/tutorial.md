# KQ-Forge 使用教程

本文档涵盖 KQ-Forge 的安装、CLI 命令使用和自定义配置方法。

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
| `kq-forge add <package>` | 添加场景包 |
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

# 同时添加多个场景包
npx github:kqcoxn/kq-forge add frontend api python
```

场景包会将对应的 Skills 添加到 `.kqforge/skills/`，并自动同步到已启用的平台目录。

### 可用场景包列表

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
