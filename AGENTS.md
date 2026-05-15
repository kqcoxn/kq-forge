# AGENTS.md

本文件面向 AI 编码代理，指导其参与 kq-forge 项目本身的开发。

---

## 项目概述

kq-forge 是一个模块化 AI 编码代理 Harness（运行时协作框架）的 CLI 工具。用户通过 `npx github:kqcoxn/kq-forge init` 在自己的项目中初始化协作配置。

## 技术栈

- **语言**: TypeScript (ESM)
- **包管理**: pnpm monorepo
- **CLI 框架**: citty
- **Schema 校验**: zod
- **Frontmatter 解析**: gray-matter
- **YAML**: yaml
- **构建**: tsup
- **Node**: >= 18

## 仓库结构

```
kq-forge/
├── packages/
│   ├── core/                    # 核心逻辑（schema、loader、validator、scaffold）
│   ├── cli/                     # CLI 入口（citty 命令定义 + syncPlatforms 协调）
│   ├── platform-opencode/       # OpenCode 适配器
│   ├── platform-claude-code/    # Claude Code 适配器
│   └── platform-codex/          # Codex 适配器
├── agents/                      # Agent 模板源文件（init 时复制到用户 .kqforge/agents/）
├── skills/                      # Skill 模板源文件（init 时复制到用户 .kqforge/skills/）
├── workflows/                   # Workflow 模板源文件（init 时复制到用户 .kqforge/workflows/）
├── AGENTS.template.md           # 用户项目 AGENTS.md/CLAUDE.md 的母版（带占位符）
├── docs/                        # 设计文档
└── package.json                 # 根 package.json（bin 指向 cli/dist/index.js）
```

## 架构要点

### 数据流

```
模板源文件（本仓库 agents/ skills/ workflows/ AGENTS.template.md）
    ↓ init 时复制
用户项目 .kqforge/（single source of truth）
    ↓ sync 时转译
平台原生文件（AGENTS.md / .opencode/ / CLAUDE.md / .claude/）
```

### 包依赖关系

```
cli → core（接口 + scaffold + loader）
cli → platform-opencode / platform-claude-code / platform-codex（适配器实现）
platform-* → core（类型导入）
```

CLI 通过 tsup `noExternal` 把所有 workspace 包打包进单个 bundle。第三方依赖（yaml、zod、gray-matter、citty、consola）保持 external，由根 package.json 的 dependencies 提供。

### 关键设计决策

- `packages/cli/dist/` 提交到 git — `npx github:` 安装方式无 build 步骤
- 模板定位通过 `getTemplateRoot()` 向上查找含 `agents/` + `skills/` 的目录
- 适配器不直接依赖彼此，由 CLI 层的 `sync.ts` 协调调用
- AGENTS.template.md 使用 `{{PLACEHOLDER}}` 占位符，sync 时替换为动态内容

## 开发规范

- 全程使用中文交流
- 修改 core/platform 包后需重新 build（`pnpm run build` 在对应包目录）
- 修改后必须在临时目录做端到端验证（设置 `KQ_FORGE_TEMPLATE_ROOT` 环境变量指向本仓库）
- 不要修改用户项目中由 sync 生成的文件——修改源文件后重新 sync

## CLI 命令清单

| 命令 | 入口 | 说明 |
|------|------|------|
| init | `packages/cli/src/commands/init.ts` | 初始化 .kqforge/ + 自动 sync |
| add-platform | `packages/cli/src/commands/add-platform.ts` | 添加平台 + 自动 sync |
| add | `packages/cli/src/commands/add.ts` | 添加场景包 + 自动 sync |
| sync | `packages/cli/src/commands/sync.ts` | 手动触发平台同步 |
| status | `packages/cli/src/commands/status.ts` | 显示配置状态 |
| validate | `packages/cli/src/commands/validate.ts` | 校验配置合法性 |
| list-packages | `packages/cli/src/commands/list-packages.ts` | 列出可用场景包 |

## 测试方法

```bash
# 在临时目录测试
$env:KQ_FORGE_TEMPLATE_ROOT = "D:\_Projects\kq-forge"
node "D:\_Projects\kq-forge\packages\cli\dist\index.js" init --platform opencode --name test
node "D:\_Projects\kq-forge\packages\cli\dist\index.js" sync
node "D:\_Projects\kq-forge\packages\cli\dist\index.js" add frontend
node "D:\_Projects\kq-forge\packages\cli\dist\index.js" status
node "D:\_Projects\kq-forge\packages\cli\dist\index.js" validate
```
