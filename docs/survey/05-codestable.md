# CodeStable 深度研究报告

**项目地址**: https://github.com/liuzhengdongfortest/CodeStable  
**作者**: [@liuzhengdong](https://github.com/liuzhengdongfortest)  
**状态**: Beta | **技能数**: 22 | **许可证**: MIT  
**Stars**: 763 | **Forks**: 48 | **语言构成**: Python 83.6%, JavaScript 15.9%, HTML 0.5%

---

## 一、设计思想 / Design Philosophy

### 1.1 核心理念：编排软件生命周期，而非编排 Agent

CodeStable 与当前主流 AI 编码框架（Superpowers、ECC、Oh-My-OpenAgent 等）走的是**完全相反的方向**：

- **主流框架**的核心问题是："如何把 Agent 编排得更好？让它们组队、协作、头脑风暴、跑流水线。"围绕的实体是 **Agent / Role / Team**。
- **CodeStable** 的核心问题是："软件的需求、约束、决策怎么被记下来、被检索、被复用？"围绕的实体是 **Requirement / Architecture / Feature / Issue / Decision**。

作者的核心信念：

> **软件工程的混乱本质上不是 Agent 不够强，而是要素没被组织好。** Agent 再强，也写不了一个把需求、架构、历史决策全丢失的项目。

### 1.2 "人在环"哲学

CodeStable 明确反对 Oh-My-OpenAgent 的"人介入 = 失败"理念，主张：

- **程序员是软件编码中的在环对象**——可以对黑盒实现不了解，但对整体实现必须有所把控
- 软件架构必须 **可演进、可观测、可控制**
- AI 是高效的执行体，人对整体把控负责

### 1.3 解决的核心痛点

| 痛点 | CodeStable 的应对 |
|------|-------------------|
| 软件复杂度膨胀撑破上下文 | 将知识结构化存储在文件树中，按需加载 |
| 隐知识丢失 | compound/ 知识沉淀机制（复利工程） |
| 需求漂移 | requirements/ 长效档案 + 验收闭环 |
| AI 反复犯同一个错 | 通过 learning/trick/decision 文档让经验被复用 |

### 1.4 与竞品的对比定位

作者调研后对竞品的评价：
- **OpenSpec**：太简单，没有复利工程，生成的 Spec 抽象到人类没法读
- **SuperPowers**：没有流程约束，不知道该用哪个
- **Oh-My-OpenAgent**：太重，且哲学上认为"人介入 = 失败"

---

## 二、核心特性 / Core Features

### 2.1 六大实体建模

| 实体 | 英文 | 职责 |
|------|------|------|
| **需求** | requirements | 原始用户故事、讨论与权衡。代码烂掉时的逃生通道 |
| **架构** | architecture | 系统编排层的结构描述，给人读的精简文档 |
| **路线图** | roadmap | 大需求的事前规划：概设 + 架构层详设 + 子 feature 拆解 |
| **特性** | feature | 实际落地的工程执行过程，含 design/impl/accept 全流程 |
| **问题** | issue | BUG 单子的报告、分析、修复全链路 |
| **知识** | compound | 复利工程知识库：踩坑、好做法、技术决策 |

### 2.2 三大流程

| 流程 | 技能链 | 说明 |
|------|--------|------|
| **特性引入** | `cs-feat` → `cs-feat-design` → `cs-feat-impl` → `cs-feat-accept` | 想清楚 → 设计 → 编码 → 验收 |
| **问题修复** | `cs-issue-report` → `cs-issue-analyze` → `cs-issue-fix` | 报告 → 根因分析 → 定点修复 |
| **代码重构** | `cs-refactor` / `cs-refactor-ff` | AI 辅助重构（beta） |

### 2.3 复利工程（Compound Interest Engineering）

这是 CodeStable 最独特的机制——横切层知识沉淀：

- `cs-learn`：踩坑回顾
- `cs-trick`：可复用编程模式/库用法
- `cs-decide`：技术选型/长期约束
- `cs-explore`：定向代码探索的结论

**飞轮效应**：任何流程跑完发现"值得记下来"都可触发沉淀，沉淀的产物会被下一次 `cs-arch` / `cs-feat-design` / `cs-issue-analyze` 读到并复用。

### 2.4 分层 + 事件驱动架构

工作流不是线性流水线，而是分层结构：
1. **根入口层**（`cs`）：路由分诊
2. **阶段 0**（`cs-onboard`）：一次性接入
3. **第 1 层**：长效档案（requirements + architecture）
4. **第 2 层**：规划层（roadmap，大需求才需要）
5. **第 3 层**：执行流程（feature / issue / refactor）
6. **横切层**：知识沉淀（compound）

### 2.5 22 个技能（Skills）

| 分组 | 技能 |
|------|------|
| 根入口 | `cs` |
| 接入 | `cs-onboard` |
| 需求 & 架构 | `cs-req`, `cs-arch` |
| 路线图 | `cs-roadmap` |
| 讨论 | `cs-brainstorm` |
| 特性流程 | `cs-feat`, `cs-feat-design`, `cs-feat-impl`, `cs-feat-accept`, `cs-feat-ff` |
| 问题流程 | `cs-issue`, `cs-issue-report`, `cs-issue-analyze`, `cs-issue-fix` |
| 重构流程 | `cs-refactor`, `cs-refactor-ff` |
| 知识沉淀 | `cs-learn`, `cs-trick`, `cs-decide` |
| 探索 & 文档 | `cs-explore`, `cs-guide`, `cs-libdoc` |
| 审计 | `cs-audit` |
| 笔记 | `cs-note` |

---

## 三、实现架构 / Implementation Architecture

### 3.1 技术栈

- **载体**：Claude Code Skills 体系（基于 Markdown + YAML frontmatter）
- **辅助工具**：Python 脚本（`search-yaml.py`, `validate-yaml.py`）
- **浏览器桥接**：JavaScript + Chrome Extension（`browser-bridge/`）
- **安装方式**：`npx skills add` 一键安装

### 3.2 仓库顶层结构

```
CodeStable/
├── cs/                    # 根入口技能（路由分诊）
├── cs-onboard/            # 接入技能（含 reference/ 和 tools/ 模板）
│   ├── reference/         # 共享参考文档模板
│   │   ├── shared-conventions.md
│   │   ├── system-overview.md
│   │   ├── code-dimensions.md
│   │   ├── maintainer-notes.md
│   │   ├── requirement-example.md
│   │   └── tools.md
│   └── tools/             # 共享脚本模板
│       ├── search-yaml.py
│       └── validate-yaml.py
├── cs-arch/               # 架构文档技能
├── cs-audit/              # 审计技能
├── cs-brainstorm/         # 讨论分诊技能
├── cs-decide/             # 技术决策沉淀
├── cs-explore/            # 代码探索
├── cs-feat/               # 特性流程入口
├── cs-feat-design/        # 特性设计（含 SKILL.md + reference.md）
├── cs-feat-impl/          # 特性实现
├── cs-feat-accept/        # 特性验收
├── cs-feat-ff/            # 轻量直通车
├── cs-guide/              # 开发者指南
├── cs-issue/              # 问题流程入口
├── cs-issue-report/       # 问题报告
├── cs-issue-analyze/      # 根因分析
├── cs-issue-fix/          # 定点修复
├── cs-learn/              # 踩坑沉淀
├── cs-libdoc/             # 库参考文档
├── cs-note/               # 项目注意事项
├── cs-refactor/           # 重构主流程
├── cs-refactor-ff/        # 轻量重构
├── cs-req/                # 需求文档
├── cs-roadmap/            # 路线图
├── cs-trick/              # 编程模式沉淀
├── browser-bridge/        # 浏览器桥接工具
│   ├── assets/extension/  # Chrome 扩展资源
│   ├── scripts/           # 桥接脚本
│   ├── SKILL.md
│   └── reference.md
├── asset/                 # 图片资源
├── AGENTS.md              # Codex Agent 指令
├── CLAUDE.md              # Claude Code 指令
├── README.md              # 中文说明
├── README.en.md           # 英文说明
└── what-is-skills.md      # Skills 机制科普
```

### 3.3 每个 Skill 的内部结构

每个 `cs-*` 目录是一个独立的 Skill 安装单元：

```
cs-feat-design/
├── SKILL.md          # 主入口（含 YAML frontmatter + 完整流程指引）
└── reference.md      # 详细参考材料（模板、示例、规则）
```

**关键约束**：运行时每个 skill 只能看到自己包内的文件。跨 skill 共享的参考文档通过 `cs-onboard` 复制到项目的 `.codestable/reference/`，其他 skill 用项目相对路径读取。

### 3.4 运行时产物结构

`cs-onboard` 执行后在用户项目中生成：

```
项目根/
├── .codestable/
│   ├── attention.md                 # 技能启动必读的项目注意事项
│   ├── requirements/{slug}.md       # 需求文档（扁平）
│   ├── architecture/
│   │   ├── ARCHITECTURE.md          # 架构总入口
│   │   └── {type}-{slug}.md         # 子系统架构
│   ├── roadmap/{slug}/              # 路线图（含 roadmap.md + items.yaml）
│   ├── features/YYYY-MM-DD-{slug}/  # 特性（design + checklist + acceptance）
│   ├── issues/YYYY-MM-DD-{slug}/    # 问题（report + analysis + fix-note）
│   ├── refactors/YYYY-MM-DD-{slug}/ # 重构（beta）
│   ├── compound/                    # 知识沉淀（统一目录，doc_type 区分）
│   ├── tools/                       # 共享脚本
│   └── reference/                   # 共享参考文档
└── AGENTS.md                        # 项目根级 Agent 指令
```

### 3.5 工具脚本

- **`search-yaml.py`**：在 `.codestable/compound/` 中搜索相关的 decision/explore/trick/learning 文档
- **`validate-yaml.py`**：校验 checklist.yaml 和 items.yaml 的格式正确性

---

## 四、内容概况 / Content Overview

### 4.1 这不是一个代码库，而是一套"知识工程系统"

CodeStable 的本质是一套**结构化的 Prompt Engineering + 工作流编排系统**，以 Claude Code Skills 为载体。它不包含传统意义上的"应用代码"，而是：

- **22 个 SKILL.md 文件**：每个都是精心设计的 AI 行为指令
- **参考文档模板**：`shared-conventions.md`、`system-overview.md`、`code-dimensions.md` 等
- **辅助工具**：Python 脚本用于 YAML 搜索和校验
- **浏览器桥接**：`browser-bridge/` 提供 Chrome 扩展能力

### 4.2 Skill 设计的精细程度

以 `cs-feat-design` 为例，其 SKILL.md 包含：

- **三种入口模式**：正式起草 / 初始化模式 / 从 roadmap 条目起头
- **"编排-计算分离"原则**：design 只管编排层（名词层 + 编排层），计算层归 implement
- **"现状 → 变化"两段式**：强制要求先描述现状再描述变化
- **结构健康度评估**：评估文件是否偏胖、目录是否拥挤
- **三条纪律**：别替用户做决定 / 目标写成可验证的 / 每个 feature 都要能被卸载
- **完整的退出条件 checklist**

### 4.3 模型能力自适应的 Roadmap

作者明确表示：如果未来某个模型做到某个模块的稳定产出，那么这个模块就可以删除。这意味着 CodeStable 不是一个固化的框架，而是随 AI 能力演进而收缩的"脚手架"。

---

## 五、独特差异化 / Unique Differentiators

### 5.1 以"软件要素"而非"Agent"为中心的建模

这是 CodeStable 最根本的差异化。状态不存在于 Agent 的 session 或消息总线中，而是存在于**项目里的文件树**——人和 AI 都能读、都能写、都能 grep。

### 5.2 复利工程（Compound Interest）

知识沉淀不是可选的附加功能，而是系统的核心飞轮：
- 每次流程跑完都可能触发沉淀
- 下一次同类工作会自动读取历史沉淀
- 形成"做得越多、知识越丰富、下次做得越好"的正循环

### 5.3 "编排-计算分离"的设计方法论

在 `cs-feat-design` 中明确区分：
- **编排层**（design 管）：名词层、流程拓扑、挂载点、约束
- **计算层**（implement 管）：具体函数实现、测试代码、库选型

这避免了 design 阶段过早下沉到实现细节。

### 5.4 严格的"人在环"流程控制

- 每个阶段都有明确的退出条件
- 不替用户做决定——碰到不确定的停下来问
- 验收闭环：`cs-feat-accept` 逐层对照 design 核对实现
- 初始化模式：建好骨架后停下来等用户填写，不继续推进

### 5.5 "每个 feature 都要能被卸载"

这是一个独特的设计约束——要求每个 feature 都回答"如果想把它拔掉，要拔哪些地方？"，通过挂载点清单确保边界清晰。

### 5.6 结构健康度评估

在 design 阶段就评估即将被改动的文件是否偏胖、目录是否拥挤，决定是否先做微重构。这防止了 AI 默认往胖文件里塞代码的倾向。

### 5.7 轻量安装 + 零侵入

- 一键安装：`npx skills add`
- 所有产物聚在 `.codestable/` 下，不污染项目其他目录
- 支持迁移已有文档（审计 + 映射方案）

---

## 六、总结

CodeStable 是一个**面向严肃软件工程的 AI 编码工作流系统**，其核心创新在于：

1. **换了一个建模维度**——不编排 Agent，编排软件生命周期要素
2. **把隐性知识显性化**——通过文件树让需求、架构、决策、经验可被检索和复用
3. **流程约束而非自由发挥**——每个阶段有明确的输入、输出、退出条件
4. **复利飞轮**——知识沉淀不是事后总结，而是系统运转的核心动力

适用场景：维护跨年迭代的严肃软件、需要让今天的决策三个月后还能被准确召回的项目。不适用于追求全自动化的 AI 产线或一次性脚本。
