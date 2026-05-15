---
name: redis-patterns
type: capability
package: database
description: Redis 使用模式——缓存策略、数据结构选型、过期策略、分布式锁、发布订阅
---

# Redis 使用模式

## 缓存策略

### Cache-Aside（旁路缓存）

```
读取：
1. 查 Redis → 命中则返回
2. 未命中 → 查数据库 → 写入 Redis → 返回

写入：
1. 更新数据库
2. 删除 Redis 缓存（不是更新缓存）
```

```typescript
async function getUser(id: string): Promise<User> {
  // 1. 查缓存
  const cached = await redis.get(`user:${id}`)
  if (cached) return JSON.parse(cached)

  // 2. 查数据库
  const user = await db.users.findById(id)
  if (!user) throw new NotFoundError('User', id)

  // 3. 写缓存（带过期时间）
  await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 3600)

  return user
}

async function updateUser(id: string, data: Partial<User>): Promise<void> {
  await db.users.update(id, data)
  await redis.del(`user:${id}`)  // 删除缓存，不是更新
}
```

**为什么删除而不是更新？** 避免并发写入导致缓存与数据库不一致。

### Write-Through（写穿透）

```
写入：同时写数据库和缓存（适合读多写少且一致性要求高的场景）
```

### 缓存穿透防护

```typescript
// 空值缓存：防止恶意查询不存在的 key
async function getUser(id: string): Promise<User | null> {
  const cached = await redis.get(`user:${id}`)
  if (cached === 'NULL') return null  // 空值标记
  if (cached) return JSON.parse(cached)

  const user = await db.users.findById(id)
  if (!user) {
    await redis.set(`user:${id}`, 'NULL', 'EX', 300)  // 空值缓存 5 分钟
    return null
  }

  await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 3600)
  return user
}
```

### 缓存雪崩防护

```typescript
// 过期时间加随机抖动，避免大量 key 同时过期
const baseTTL = 3600
const jitter = Math.floor(Math.random() * 600)  // 0-10 分钟随机
await redis.set(key, value, 'EX', baseTTL + jitter)
```

## 数据结构选型

| 场景 | 数据结构 | 命令 |
|------|----------|------|
| 简单键值 | String | GET/SET/INCR |
| 对象属性 | Hash | HGET/HSET/HMGET |
| 排行榜 | Sorted Set | ZADD/ZRANGE/ZRANK |
| 消息队列 | List / Stream | LPUSH/BRPOP / XADD/XREAD |
| 标签/集合运算 | Set | SADD/SINTER/SUNION |
| 计数器/限流 | String + INCR | INCR/EXPIRE |
| 位图/布隆过滤器 | Bitmap / Module | SETBIT/GETBIT |
| 地理位置 | Geo | GEOADD/GEORADIUS |

### Hash vs String（存储对象）

```
# String：整体序列化，读写整个对象
SET user:123 '{"name":"Alice","email":"a@x.com","age":30}'

# Hash：字段级读写，适合部分更新
HSET user:123 name "Alice" email "a@x.com" age 30
HGET user:123 name        # 只读一个字段
HINCRBY user:123 age 1    # 原子递增
```

**选择原则：** 需要部分读写 → Hash；整体读写且需要 TTL → String。

## 分布式锁

```typescript
// 基于 SET NX EX 的简单分布式锁
async function acquireLock(key: string, ttlMs: number): Promise<string | null> {
  const token = crypto.randomUUID()
  const result = await redis.set(
    `lock:${key}`, token, 'PX', ttlMs, 'NX'
  )
  return result === 'OK' ? token : null
}

// 释放锁（Lua 脚本保证原子性）
async function releaseLock(key: string, token: string): Promise<boolean> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `
  const result = await redis.eval(script, 1, `lock:${key}`, token)
  return result === 1
}

// 使用
const token = await acquireLock('order:123', 5000)
if (!token) throw new Error('Failed to acquire lock')
try {
  await processOrder('123')
} finally {
  await releaseLock('order:123', token)
}
```

**注意：** 单节点 Redis 锁在故障转移时可能失效。高可靠场景用 Redlock 算法或 etcd/ZooKeeper。

## 限流（滑动窗口）

```typescript
// 滑动窗口限流：每分钟最多 100 次请求
async function isRateLimited(userId: string, limit: number, windowMs: number): Promise<boolean> {
  const key = `ratelimit:${userId}`
  const now = Date.now()
  const windowStart = now - windowMs

  const pipe = redis.pipeline()
  pipe.zremrangebyscore(key, 0, windowStart)  // 清理过期记录
  pipe.zadd(key, now, `${now}:${crypto.randomUUID()}`)  // 添加当前请求
  pipe.zcard(key)  // 计数
  pipe.expire(key, Math.ceil(windowMs / 1000))  // 设置过期

  const results = await pipe.exec()
  const count = results[2][1] as number
  return count > limit
}
```

## 键命名规范

```
# 格式：业务:实体:ID:子属性
user:123                    # 用户对象
user:123:sessions           # 用户会话集合
order:456:items             # 订单商品列表
cache:api:users:page:1      # API 缓存
lock:order:789              # 分布式锁
ratelimit:user:123          # 限流计数器
queue:email:pending         # 邮件队列

# 规则：
# - 用冒号分隔层级
# - 全小写
# - 避免过长（影响内存）
# - 避免特殊字符
```

## 检查清单

- [ ] 所有缓存 key 都设置了 TTL（无永不过期的缓存）
- [ ] 缓存更新策略是"删除"而非"更新"（Cache-Aside）
- [ ] 空值有缓存（防穿透），TTL 较短
- [ ] TTL 有随机抖动（防雪崩）
- [ ] 分布式锁有超时时间（防死锁）
- [ ] 释放锁时验证 token（防误释放）
- [ ] 键命名遵循统一规范
- [ ] 大 value（>10KB）已拆分或压缩
- [ ] Pipeline/批量操作减少网络往返
