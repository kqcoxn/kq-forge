---
name: api
description: API 设计与开发技能集——RESTful 规范、错误处理、架构模式
type: constraint
---

## 概述

REST API 设计规范、统一错误处理策略与六边形架构模式，确保 API 的一致性、可维护性与可测试性。

## 包含内容

| 文件 | 说明 |
|------|------|
| [api-design.md](api-design.md) | REST API 设计规范（资源命名、状态码、分页） |
| [error-handling.md](error-handling.md) | 统一错误处理与响应格式 |
| [hexagonal-architecture.md](hexagonal-architecture.md) | 六边形架构（端口与适配器） |

## 使用方式

```yaml
required_skills:
  - api
  - api/api-design
  - api/hexagonal-architecture
```
