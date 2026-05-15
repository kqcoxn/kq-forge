---
name: database
description: 数据库开发技能集——迁移管理、SQL 模式、ORM 与缓存
type: capability
---

## 概述

数据库开发最佳实践，涵盖迁移管理、PostgreSQL/MySQL 模式、Prisma ORM 与 Redis 缓存策略。

## 包含内容

| 文件 | 说明 |
|------|------|
| [database-migrations.md](database-migrations.md) | 安全的 schema 变更与零停机迁移 |
| [postgres-patterns.md](postgres-patterns.md) | PostgreSQL 查询优化与高级特性 |
| [mysql-patterns.md](mysql-patterns.md) | MySQL 模式与性能调优 |
| [prisma-patterns.md](prisma-patterns.md) | Prisma ORM 最佳实践 |
| [redis-patterns.md](redis-patterns.md) | Redis 数据结构与缓存策略 |

## 使用方式

```yaml
required_skills:
  - database
  - database/postgres-patterns
  - database/redis-patterns
```
