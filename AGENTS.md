# AGENTS.md

---

## 项目协作规则

以下规则对所有 Agent 生效，不可被单个 Agent 或 Workflow 覆盖。

### 基本原则

1. **以人为本** — 人类是最终决策者。任何 Agent 在不确定时应请求澄清而非猜测。
2. **因地制宜** — 不同任务使用不同的 autonomy level，不存在"一刀切"的最优模式。
3. **实事求是** — 犯错不可怕，隐瞒错误不可接受。发现问题立即上报。

### Autonomy Level 约定

| 等级   | 模式     | 人类角色                     | 适用场景             |
| ------ | -------- | ---------------------------- | -------------------- |
| **L0** | 全手动   | Agent 建议，人执行           | 高风险变更、架构决策 |
| **L1** | 半自动   | Agent 执行，关键节点等人确认 | 常规功能开发         |
| **L2** | 监督自动 | Agent 全自动，人异步 review  | 批量任务、重构       |
| **L3** | 全自动   | Agent 自主完成，仅失败时通知 | 机械性任务、格式化   |

默认等级：**L1**（可在 `.kqforge/config.yaml` 中修改）。

### 对抗三角约定

- Writer（执行者）不能 review 自己的产出
- Reviewer（审查者）只读，不能直接修改代码
- Judge（裁决者）独立于 Writer 和 Reviewer，做最终裁决
- 对抗轮次有上限（默认 `round_cap: 3`），达到上限后 Judge 强制裁决

### 记忆沉淀触发条件

以下情况必须触发记忆沉淀（写入 `.kqforge/memory/`）：

- 发现项目级约束或约定（如"本项目用 pnpm"）
- 犯错后的根因分析结论
- 人类明确指出的偏好或规则
- 反复出现的模式（第二次遇到时沉淀）

---

## 自定义规则

全程使用中文。

---

## Agents

| Agent           | 职责                                                     | 默认等级 | 文件                                           |
| --------------- | -------------------------------------------------------- | -------- | ---------------------------------------------- |
| **lead**        | 编排者：需求探索、方案设计、任务分解、委派调度、反思沉淀 | L1       | [agents/lead.md](agents/lead.md)               |
| **implementer** | 执行者：按计划实现代码，自检后交付                       | L1       | [agents/implementer.md](agents/implementer.md) |
| **reviewer**    | 审查者：只读 review，输出结构化审查报告                  | L1       | [agents/reviewer.md](agents/reviewer.md)       |
| **judge**       | 裁决者：独立第三方，PASS/FAIL/PARTIAL 裁决               | L1       | [agents/judge.md](agents/judge.md)             |

---

## Skills

### 核心 Skills（base 包默认包含）

| Skill     | 类型       | 说明                     | 路径                                           |
| --------- | ---------- | ------------------------ | ---------------------------------------------- |
| design    | capability | 任务分解与方案设计方法论 | [skills/design/](skills/design/SKILL.md)       |
| implement | capability | 编码实现规范与自检清单   | [skills/implement/](skills/implement/SKILL.md) |
| review    | capability | 代码审查方法论与报告格式 | [skills/review/](skills/review/SKILL.md)       |
| debug     | capability | 系统化调试方法论         | [skills/debug/](skills/debug/SKILL.md)         |
| reflect   | capability | 反思沉淀与记忆管理       | [skills/reflect/](skills/reflect/SKILL.md)     |

### 通用约束 Skills

| Skill              | 类型       | 说明                  | 路径                                                             |
| ------------------ | ---------- | --------------------- | ---------------------------------------------------------------- |
| code-hygiene       | constraint | AI 代码异味识别与预防 | [skills/code-hygiene/](skills/code-hygiene/SKILL.md)             |
| git-conventions    | constraint | Git 提交与分支规范    | [skills/git-conventions/](skills/git-conventions/SKILL.md)       |
| security-check     | constraint | 基础安全检查清单      | [skills/security-check/](skills/security-check/SKILL.md)         |
| test-first         | constraint | 测试优先约束          | [skills/test-first/](skills/test-first/SKILL.md)                 |
| verify-before-done | constraint | 完成前验证约束        | [skills/verify-before-done/](skills/verify-before-done/SKILL.md) |

### 领域 Skills

| Skill             | 说明                          | 子文件 | 路径                                                           |
| ----------------- | ----------------------------- | ------ | -------------------------------------------------------------- |
| typescript        | TypeScript/JavaScript 全栈    | 7      | [skills/typescript/](skills/typescript/SKILL.md)               |
| python            | Python 全栈（Django/FastAPI） | 5      | [skills/python/](skills/python/SKILL.md)                       |
| golang            | Go 语言模式与测试             | 2      | [skills/golang/](skills/golang/SKILL.md)                       |
| rust              | Rust 模式与测试               | 2      | [skills/rust/](skills/rust/SKILL.md)                           |
| java              | Java/Kotlin + Spring Boot     | 7      | [skills/java/](skills/java/SKILL.md)                           |
| cpp               | 现代 C++ 规范与测试           | 2      | [skills/cpp/](skills/cpp/SKILL.md)                             |
| dotnet            | .NET/C#/F# 模式与测试         | 3      | [skills/dotnet/](skills/dotnet/SKILL.md)                       |
| mobile            | Android/iOS/跨平台            | 4      | [skills/mobile/](skills/mobile/SKILL.md)                       |
| database          | 数据库迁移、SQL、ORM、缓存    | 5      | [skills/database/](skills/database/SKILL.md)                   |
| api               | API 设计、错误处理、架构      | 3      | [skills/api/](skills/api/SKILL.md)                             |
| devops            | CI/CD、Docker、部署策略       | 3      | [skills/devops/](skills/devops/SKILL.md)                       |
| frontend-ui       | 无障碍、设计系统、响应式      | 3      | [skills/frontend-ui/](skills/frontend-ui/SKILL.md)             |
| ai-ml             | LLM 管道、ML 工作流、PyTorch  | 4      | [skills/ai-ml/](skills/ai-ml/SKILL.md)                         |
| performance       | 基准测试与性能优化            | 2      | [skills/performance/](skills/performance/SKILL.md)             |
| security-advanced | 漏洞挖掘与安全扫描            | 2      | [skills/security-advanced/](skills/security-advanced/SKILL.md) |
| documentation     | 代码导览与新人上手            | 2      | [skills/documentation/](skills/documentation/SKILL.md)         |
| workflow-advanced | ADR 与搜索优先策略            | 2      | [skills/workflow-advanced/](skills/workflow-advanced/SKILL.md) |

---

## Workflows

| Workflow      | 说明                                            | 适用场景         | 文件                                             |
| ------------- | ----------------------------------------------- | ---------------- | ------------------------------------------------ |
| **feature**   | 完整功能开发流（探索→计划→实现→审查→裁决→反思） | 新功能、较大变更 | [workflows/feature.md](workflows/feature.md)     |
| **bugfix**    | 轻量缺陷修复流（诊断→修复→验证→反思）           | Bug 修复、小改动 | [workflows/bugfix.md](workflows/bugfix.md)       |
| **longmarch** | 大型项目里程碑流（规划→迭代循环→检查点）        | 跨多天的大型任务 | [workflows/longmarch.md](workflows/longmarch.md) |

---

## 扩展指南

KQ-Forge 的设计原则是"必须扩展"——base 包提供骨架，项目必须根据自身情况添加内容。

### 添加自定义 Agent

在 `agents/` 目录下创建 `.md` 文件：

```markdown
---
name: my-agent
description: 你的 Agent 描述
scope: src/api/**
autonomy: L1
required_skills:
  - implement
  - api
optional_skills:
  - debug
---

你是 [角色名]。你的核心职责是...
```

### 添加自定义 Skill

在 `skills/` 目录下创建文件夹，入口为 `SKILL.md`：

```
skills/
└── my-skill/
    └── SKILL.md
```

SKILL.md 格式：

```markdown
---
name: my-skill
description: 技能描述
type: constraint | capability
---

## 规则/方法

...
```

如果 skill 内容较多，可拆分为多个子文件，在 SKILL.md 中引用：

```
skills/
└── my-skill/
    ├── SKILL.md          # 入口概述 + 引用子文件
    ├── sub-topic-a.md
    └── sub-topic-b.md
```

### 添加自定义 Workflow

在 `workflows/` 目录下创建 `.md` 文件：

```markdown
---
name: my-workflow
description: 工作流描述
steps:
  - agent: lead
    action: plan
  - agent: implementer
    action: implement
  - agent: reviewer
    action: review
---

这是一个自定义工作流...
```

### 添加项目规则

直接在本文件的 [自定义规则](#自定义规则) 区域添加即可。规则对所有 Agent 生效。
