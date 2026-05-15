---
name: postgres-patterns
type: capability
package: database
description: PostgreSQL 最佳实践——索引策略、查询优化、连接池、JSONB、CTE、分区
---

# PostgreSQL 模式

## 索引策略

### 选择正确的索引类型

| 场景 | 索引类型 | 示例 |
|------|----------|------|
| 等值查询 | B-tree（默认） | `WHERE status = 'active'` |
| 范围查询 | B-tree | `WHERE created_at > '2025-01-01'` |
| 全文搜索 | GIN | `WHERE to_tsvector(content) @@ query` |
| JSONB 字段 | GIN | `WHERE metadata @> '{"key": "val"}'` |
| 地理位置 | GiST | `WHERE ST_DWithin(point, center, 1000)` |
| 前缀匹配 | B-tree + text_pattern_ops | `WHERE name LIKE 'abc%'` |

### 复合索引原则

```sql
-- 遵循"最左前缀"原则
-- 查询 WHERE a = 1 AND b = 2 AND c > 3 时：
CREATE INDEX idx_abc ON orders(a, b, c);

-- 等值列在前，范围列在后
-- 高选择性列在前，低选择性列在后

-- 覆盖索引（避免回表）
CREATE INDEX idx_users_email_name ON users(email) INCLUDE (name);
```

### 部分索引（减少索引体积）

```sql
-- 只索引活跃订单（90% 的查询只查活跃订单）
CREATE INDEX idx_orders_active ON orders(created_at)
  WHERE status = 'active';

-- 只索引非空值
CREATE INDEX idx_users_phone ON users(phone)
  WHERE phone IS NOT NULL;
```

## 查询优化

### EXPLAIN ANALYZE 解读

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM orders WHERE user_id = 'abc' AND status = 'active';

-- 关注指标：
-- Seq Scan → 全表扫描（大表需要索引）
-- Rows Removed by Filter → 过滤掉的行数（越多越需要索引）
-- Buffers: shared hit vs read → 缓存命中率
-- Planning Time vs Execution Time
```

### 常见优化模式

```sql
-- 避免 SELECT *
SELECT id, name, email FROM users WHERE ...;

-- 用 EXISTS 替代 IN（子查询大时更快）
SELECT * FROM orders o
WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = o.user_id AND u.is_vip);

-- 分页用 keyset 替代 OFFSET（大偏移量性能差）
-- 差：OFFSET 100000 LIMIT 20
-- 好：WHERE id > last_seen_id ORDER BY id LIMIT 20

-- 批量插入用 COPY 或 unnest
INSERT INTO users (name, email)
SELECT * FROM unnest($1::text[], $2::text[]);
```

### CTE（公共表表达式）

```sql
-- 可读性好，但注意 PostgreSQL 12+ 才会内联优化
WITH active_orders AS (
  SELECT * FROM orders WHERE status = 'active'
),
order_totals AS (
  SELECT user_id, SUM(amount) as total
  FROM active_orders
  GROUP BY user_id
)
SELECT u.name, ot.total
FROM users u
JOIN order_totals ot ON u.id = ot.user_id
WHERE ot.total > 1000;

-- 递归 CTE（树形结构查询）
WITH RECURSIVE tree AS (
  SELECT id, parent_id, name, 0 as depth
  FROM categories WHERE parent_id IS NULL
  UNION ALL
  SELECT c.id, c.parent_id, c.name, t.depth + 1
  FROM categories c JOIN tree t ON c.parent_id = t.id
)
SELECT * FROM tree ORDER BY depth, name;
```

## JSONB 使用模式

```sql
-- 创建 JSONB 列
ALTER TABLE products ADD COLUMN metadata JSONB DEFAULT '{}';

-- GIN 索引支持 @>、?、?|、?& 操作符
CREATE INDEX idx_products_metadata ON products USING GIN (metadata);

-- 查询嵌套字段
SELECT * FROM products WHERE metadata @> '{"color": "red"}';
SELECT * FROM products WHERE metadata->>'brand' = 'Apple';
SELECT * FROM products WHERE (metadata->>'price')::numeric > 100;

-- 更新嵌套字段（不覆盖整个 JSON）
UPDATE products
SET metadata = jsonb_set(metadata, '{stock}', '42')
WHERE id = 'abc';
```

**JSONB 使用原则：** 适合半结构化、schema 不固定的数据。如果字段经常被查询和过滤，应该提升为独立列。

## 连接池配置

```
# pgbouncer 推荐配置
[pgbouncer]
pool_mode = transaction          # 事务级复用（推荐）
max_client_conn = 1000           # 最大客户端连接
default_pool_size = 20           # 每个数据库的连接池大小
reserve_pool_size = 5            # 预留连接
reserve_pool_timeout = 3         # 预留连接等待超时（秒）

# 应用层连接池（Node.js pg-pool）
const pool = new Pool({
  max: 20,                       # 最大连接数
  idleTimeoutMillis: 30000,      # 空闲连接超时
  connectionTimeoutMillis: 5000, # 连接超时
})
```

**连接数公式：** `connections = (core_count * 2) + effective_spindle_count`
一般 20-50 个连接足够大多数应用。

## 分区表

```sql
-- 按时间范围分区（适合日志、事件、订单）
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB
) PARTITION BY RANGE (created_at);

-- 创建分区
CREATE TABLE events_2025_01 PARTITION OF events
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE events_2025_02 PARTITION OF events
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- 自动创建分区（用 pg_partman 或定时任务）
```

## 检查清单

- [ ] 慢查询（>100ms）已用 EXPLAIN ANALYZE 分析
- [ ] WHERE 子句中的列有合适的索引
- [ ] 大表操作使用 CONCURRENTLY / 分批
- [ ] 连接池配置合理（不超过 CPU 核数 * 2 + 磁盘数）
- [ ] JSONB 列有 GIN 索引
- [ ] 时序数据使用分区表
- [ ] 避免 N+1 查询（用 JOIN 或批量查询）
