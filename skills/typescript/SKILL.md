---
name: typescript
description: TypeScript/JavaScript 全栈开发技能集——编码规范、前后端模式、框架最佳实践与测试策略
type: capability
---

## 概述

覆盖 TypeScript/JavaScript 生态的编码规范、前后端模式、框架最佳实践与端到端测试策略。适用于使用 Node.js / React / Vue 等技术栈的项目。

## 包含内容

| 文件 | 说明 |
|------|------|
| [coding-standards.md](coding-standards.md) | 基线编码规范（命名、类型安全、不可变性、错误处理） |
| [frontend-patterns.md](frontend-patterns.md) | React/Vue 前端组件与状态管理模式 |
| [backend-patterns.md](backend-patterns.md) | Node.js 后端架构与中间件模式 |
| [nestjs-patterns.md](nestjs-patterns.md) | NestJS 框架模式（模块、DI、Guard、Pipe） |
| [nextjs-patterns.md](nextjs-patterns.md) | Next.js 框架模式（App Router、SSR、ISR） |
| [vite-patterns.md](vite-patterns.md) | Vite 构建工具配置与优化 |
| [e2e-testing.md](e2e-testing.md) | 端到端测试策略（Playwright / Cypress） |

## 使用方式

在 agent 定义中引用整个技能集或单个子文件：

```yaml
required_skills:
  - typescript                    # 引用整个技能集
  - typescript/nestjs-patterns    # 仅引用特定子文件
```
