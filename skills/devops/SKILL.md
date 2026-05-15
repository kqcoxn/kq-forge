---
name: devops
description: DevOps 技能集——CI/CD、容器化、部署策略与生产审计
type: capability
---

## 概述

CI/CD 管道设计、Docker 容器化、部署策略（蓝绿/金丝雀）与生产环境审计清单。

## 包含内容

| 文件 | 说明 |
|------|------|
| [deployment-patterns.md](deployment-patterns.md) | 部署策略与回滚机制 |
| [docker-patterns.md](docker-patterns.md) | Dockerfile 最佳实践与多阶段构建 |
| [production-audit.md](production-audit.md) | 生产环境审计清单 |

## 使用方式

```yaml
required_skills:
  - devops
  - devops/docker-patterns
```
