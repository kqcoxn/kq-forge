---
name: mysql-patterns
type: capability
package: database
description: MySQL 最佳实践——InnoDB 优化、索引策略、查询调优、字符集、复制
---

# MySQL 模式

## InnoDB 核心配置

```ini
[mysqld]
innodb_buffer_pool_size = 70%    # 物理内存的 70%（最重要的参数）
innodb_log_file_size = 1G        # redo log 大小（写密集型加大）
innodb_flush_log_at_trx_commit = 1  # 1=安全 2=性能（允许丢 1 秒数据）
innodb_file_per_table = ON       # 每表独立表空间
innodb_io_capacity = 2000        # SSD 设 2000-5000
innodb_read_io_threads = 8
innodb_write_io_threads = 8
```

## 索引策略

### 聚簇索引（主键）

```sql
-- InnoDB 主键即聚簇索引，数据按主键物理排序
-- 推荐：自增整数或有序 UUID（避免随机 UUID 导致页分裂）
CREATE TABLE orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  -- 或使用有序 UUID
  -- id BINARY(16) PRIMARY KEY  -- UUID v7 (时间有序)
  user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 覆盖索引

```sql
-- 查询只需要 name 和 email，索引覆盖避免回表
CREATE INDEX idx_users_status_name_email ON users(status, name, email);

-- EXPLAIN 显示 Using index 表示覆盖索引命中
EXPLAIN SELECT name, email FROM users WHERE status = 'active';
```

### 前缀索引（长文本列）

```sql
-- 对长文本列只索引前 N 个字符
CREATE INDEX idx_users_email_prefix ON users(email(20));

-- 选择前缀长度：选择性接近完整列即可
SELECT
  COUNT(DISTINCT LEFT(email, 10)) / COUNT(*) AS sel_10,
  COUNT(DISTINCT LEFT(email, 20)) / COUNT(*) AS sel_20,
  COUNT(DISTINCT email) / COUNT(*) AS sel_full
FROM users;
```

## 查询优化

### 避免索引失效

```sql
-- 索引失效场景：
-- 1. 函数包裹列
WHERE YEAR(created_at) = 2025          -- 差
WHERE created_at >= '2025-01-01'       -- 好
  AND created_at < '2026-01-01'

-- 2. 隐式类型转换
WHERE phone = 13800138000              -- 差（phone 是 VARCHAR）
WHERE phone = '13800138000'            -- 好

-- 3. LIKE 前缀通配符
WHERE name LIKE '%alice%'              -- 差（全表扫描）
WHERE name LIKE 'alice%'               -- 好（可用索引）

-- 4. OR 条件（除非所有列都有索引）
WHERE status = 'active' OR type = 'vip'  -- 可能全表扫描
-- 改用 UNION ALL
SELECT * FROM users WHERE status = 'active'
UNION ALL
SELECT * FROM users WHERE type = 'vip' AND status != 'active';
```

### 分页优化

```sql
-- 差：大偏移量性能差（扫描 + 丢弃）
SELECT * FROM orders ORDER BY id LIMIT 20 OFFSET 100000;

-- 好：延迟关联
SELECT o.* FROM orders o
INNER JOIN (SELECT id FROM orders ORDER BY id LIMIT 20 OFFSET 100000) t
ON o.id = t.id;

-- 最好：游标分页
SELECT * FROM orders WHERE id > :last_id ORDER BY id LIMIT 20;
```

### 批量操作

```sql
-- 批量插入（一次多行，减少网络往返）
INSERT INTO users (name, email) VALUES
  ('Alice', 'a@x.com'),
  ('Bob', 'b@x.com'),
  ('Carol', 'c@x.com');

-- 批量更新（用 CASE WHEN 或临时表 JOIN）
UPDATE orders SET status = 'shipped'
WHERE id IN (1, 2, 3, 4, 5);

-- 大批量删除（分批，避免长事务）
DELETE FROM logs WHERE created_at < '2024-01-01' LIMIT 10000;
-- 循环执行直到 affected_rows = 0
```

## 字符集与排序规则

```sql
-- 推荐：utf8mb4（支持完整 Unicode 包括 emoji）
CREATE DATABASE myapp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;  -- ci = case-insensitive

-- 注意：utf8 在 MySQL 中只支持 3 字节，不是真正的 UTF-8
-- 永远使用 utf8mb4
```

## 锁与并发

```sql
-- 行级锁（InnoDB 默认）
SELECT * FROM orders WHERE id = 1 FOR UPDATE;  -- 排他锁
SELECT * FROM orders WHERE id = 1 FOR SHARE;   -- 共享锁

-- 避免死锁：
-- 1. 按固定顺序访问表和行
-- 2. 保持事务短小
-- 3. 使用合适的隔离级别

-- 查看当前锁等待
SELECT * FROM information_schema.INNODB_LOCK_WAITS;
SHOW ENGINE INNODB STATUS;
```

## 检查清单

- [ ] 主键使用自增整数或有序 UUID（非随机 UUID）
- [ ] 字符集统一使用 utf8mb4
- [ ] 慢查询已用 EXPLAIN 分析（关注 type、rows、Extra）
- [ ] 复合索引遵循最左前缀原则
- [ ] 大表 DDL 使用 pt-online-schema-change 或 gh-ost
- [ ] 批量操作分批执行，避免长事务
- [ ] innodb_buffer_pool_size 设为物理内存的 70%
- [ ] 避免 SELECT *，只查需要的列
