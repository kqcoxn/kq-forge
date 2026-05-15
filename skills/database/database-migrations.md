---
name: database-migrations
type: capability
package: database
description: 数据库迁移管理——安全的 schema 变更流程、零停机迁移、回滚策略
---

# 数据库迁移管理

## 核心原则

1. **迁移是代码**——纳入版本控制，经过 review，可重复执行
2. **向前兼容**——新 schema 必须兼容旧代码（先扩展后收缩）
3. **可回滚**——每个迁移都有对应的回滚脚本
4. **小步快跑**——拆分大迁移为多个小迁移，降低风险
5. **零停机**——生产环境迁移不能锁表超过秒级

## 安全迁移模式

### 添加列（安全）

```sql
-- 安全：添加可空列，不锁表
ALTER TABLE users ADD COLUMN avatar_url TEXT;

-- 安全：添加带默认值的列（PostgreSQL 11+ 不重写表）
ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT false;
```

### 删除列（两步法）

```sql
-- 步骤 1：先让代码停止读写该列（部署代码变更）
-- 步骤 2：确认无代码引用后，再删除列
ALTER TABLE users DROP COLUMN legacy_field;
```

**禁止一步到位删除正在使用的列。**

### 重命名列（三步法）

```sql
-- 步骤 1：添加新列
ALTER TABLE users ADD COLUMN display_name TEXT;

-- 步骤 2：双写（代码同时写入新旧列）+ 回填
UPDATE users SET display_name = name WHERE display_name IS NULL;

-- 步骤 3：代码切换到只读新列，确认后删除旧列
ALTER TABLE users DROP COLUMN name;
```

### 添加索引（不锁表）

```sql
-- PostgreSQL：CONCURRENTLY 不阻塞写入
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- MySQL：ALGORITHM=INPLACE 减少锁时间
ALTER TABLE users ADD INDEX idx_email (email), ALGORITHM=INPLACE, LOCK=NONE;
```

### 添加非空约束（安全方式）

```sql
-- 步骤 1：添加带默认值的列（或先回填数据）
UPDATE users SET status = 'active' WHERE status IS NULL;

-- 步骤 2：添加约束（PostgreSQL 用 NOT VALID 避免全表扫描）
ALTER TABLE users ADD CONSTRAINT users_status_not_null
  CHECK (status IS NOT NULL) NOT VALID;

-- 步骤 3：后台验证
ALTER TABLE users VALIDATE CONSTRAINT users_status_not_null;
```

## 危险操作清单

| 操作 | 风险 | 安全替代 |
|------|------|----------|
| `DROP TABLE` | 数据丢失 | 先重命名为 `_deprecated_xxx`，观察一周后删除 |
| `ALTER TABLE ... NOT NULL` | 全表锁 | 用 CHECK 约束 + NOT VALID |
| `ALTER TABLE ... TYPE` | 全表重写 | 添加新列 + 双写 + 切换 |
| `CREATE INDEX` | 锁表 | `CREATE INDEX CONCURRENTLY` |
| `TRUNCATE TABLE` | 数据丢失 | 确认有备份，且不在事务中 |

## 迁移文件规范

### 命名格式

```
migrations/
├── 20250115_001_create_users_table.sql
├── 20250115_002_add_users_email_index.sql
├── 20250120_001_add_orders_table.sql
└── 20250120_002_add_orders_user_fk.sql
```

### 文件结构

```sql
-- Migration: 20250115_001_create_users_table
-- Description: 创建用户表
-- Author: team

-- Up
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);

-- Down
DROP INDEX IF EXISTS idx_users_email;
DROP TABLE IF EXISTS users;
```

## 迁移工作流

```
1. 本地开发 → 写迁移脚本
2. 本地测试 → 在空数据库上运行 up + down + up
3. Code Review → 检查安全性和回滚脚本
4. Staging → 在类生产数据上测试
5. Production → 在低峰期执行，监控锁等待和慢查询
6. 验证 → 确认应用正常，保留回滚窗口
```

## 检查清单

每个迁移提交前确认：

- [ ] 有对应的回滚脚本（Down）
- [ ] 回滚脚本已测试（up → down → up 循环）
- [ ] 不会锁表超过 5 秒（大表用 CONCURRENTLY / 分批）
- [ ] 向前兼容（旧代码能在新 schema 上运行）
- [ ] 不删除正在使用的列/表
- [ ] 大数据回填用分批处理（不一次性 UPDATE 全表）
- [ ] 索引创建使用 CONCURRENTLY（PostgreSQL）
- [ ] 迁移是幂等的（重复执行不报错）
