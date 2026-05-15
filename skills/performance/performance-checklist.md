---
name: performance-checklist
type: constraint
package: performance
description: 全栈性能优化清单，涵盖前端（包体积、懒加载、图片优化、Core Web Vitals）、后端（查询优化、缓存、连接池、异步处理）、数据库（索引、查询计划、N+1）与网络（压缩、CDN、HTTP/2）。
---

# 全栈性能优化清单

## 核心原则

1. **度量先行** — 不测量就不优化，用数据驱动决策
2. **瓶颈优先** — 找到最大瓶颈再优化，避免过早优化
3. **用户感知** — 关注用户可感知的性能指标（LCP、TTI）
4. **渐进增强** — 核心功能快速可用，增强功能延迟加载
5. **持续监控** — 性能回归自动检测，纳入 CI 门禁

## 前端性能

### 包体积优化

```javascript
// 1. 代码分割：按路由懒加载
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

// 2. Tree-shaking：使用具名导入
import { debounce } from 'lodash-es';  // 正确：只打包 debounce
// import _ from 'lodash';             // 错误：打包整个 lodash

// 3. 动态导入重型库
const renderChart = async (data) => {
  const { Chart } = await import('chart.js');
  return new Chart(ctx, { data });
};

// 4. 分析包体积
// npx vite-bundle-visualizer
// npx webpack-bundle-analyzer
```

审计项：
- [ ] 主包 < 200KB（gzip 后），首屏 JS < 100KB
- [ ] 路由级代码分割，非首屏页面懒加载
- [ ] 第三方库按需导入，无全量引入
- [ ] 未使用的依赖已移除（`depcheck`）
- [ ] 图片/字体等资源使用独立 chunk

### 图片优化

```html
<!-- 响应式图片 -->
<picture>
  <source srcset="hero.avif" type="image/avif">
  <source srcset="hero.webp" type="image/webp">
  <img src="hero.jpg" alt="..." loading="lazy" decoding="async"
       width="800" height="400">
</picture>

<!-- 不同尺寸适配 -->
<img srcset="photo-400.jpg 400w, photo-800.jpg 800w, photo-1200.jpg 1200w"
     sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px"
     src="photo-800.jpg" alt="...">
```

审计项：
- [ ] 使用现代格式（AVIF > WebP > JPEG）
- [ ] 非首屏图片使用 `loading="lazy"`
- [ ] 图片指定 width/height 防止布局偏移
- [ ] 大图使用 srcset 提供多尺寸
- [ ] 图标使用 SVG sprite 或 icon font

### Core Web Vitals

```
LCP (Largest Contentful Paint) < 2.5s
  - 优化关键资源加载顺序
  - 预加载 LCP 元素：<link rel="preload" as="image" href="hero.jpg">
  - 服务端渲染首屏内容

FID/INP (Interaction to Next Paint) < 200ms
  - 拆分长任务（> 50ms）
  - 使用 requestIdleCallback 处理非紧急工作
  - Web Worker 处理计算密集型任务

CLS (Cumulative Layout Shift) < 0.1
  - 图片/视频预留空间（aspect-ratio）
  - 字体使用 font-display: swap + 预加载
  - 动态内容插入不推移已有内容
```

审计项：
- [ ] LCP < 2.5s（移动端和桌面端）
- [ ] INP < 200ms
- [ ] CLS < 0.1
- [ ] 关键 CSS 内联，非关键 CSS 异步加载
- [ ] 字体预加载 + `font-display: swap`

## 后端性能

### 查询优化

```sql
-- 反模式：SELECT *
SELECT * FROM orders WHERE user_id = 123;

-- 正确：只查需要的列
SELECT id, status, total, created_at
FROM orders
WHERE user_id = 123
ORDER BY created_at DESC
LIMIT 20;

-- 使用覆盖索引避免回表
CREATE INDEX idx_orders_user_status ON orders(user_id, status, created_at DESC);
```

### 缓存策略

```python
# 多级缓存架构
# L1: 进程内缓存（最快，容量小）
# L2: Redis（快，共享）
# L3: 数据库（慢，持久）

@cache(ttl=60, key="user:{user_id}")
async def get_user(user_id: str) -> User:
    # 缓存未命中时查询数据库
    return await db.users.find_one({"_id": user_id})

# 缓存失效策略
# - TTL：适合变化不频繁的数据
# - Write-through：写入时同步更新缓存
# - Write-behind：写入时异步更新缓存
# - Cache-aside：读时填充，写时失效
```

审计项：
- [ ] 热点数据有缓存层（Redis/Memcached）
- [ ] 缓存命中率 > 90%（监控可见）
- [ ] 缓存失效策略明确，无脏数据风险
- [ ] 连接池配置合理（数据库、Redis、HTTP 客户端）
- [ ] 耗时操作异步处理（消息队列/后台任务）

### 连接池

```yaml
# 数据库连接池配置
database:
  pool:
    min_size: 5
    max_size: 20          # 通常 = CPU 核数 * 2 + 磁盘数
    max_idle_time: 300s
    connection_timeout: 5s
    validation_query: "SELECT 1"

# HTTP 客户端连接池
http_client:
  max_connections: 100
  max_connections_per_host: 20
  keepalive_timeout: 30s
```

## 数据库性能

### 索引策略

```sql
-- 复合索引：遵循最左前缀原则
CREATE INDEX idx_orders_composite ON orders(user_id, status, created_at);
-- 可服务：WHERE user_id = ? AND status = ?
-- 不可服务：WHERE status = ? （跳过了 user_id）

-- 部分索引：只索引需要的行
CREATE INDEX idx_active_users ON users(email) WHERE active = true;

-- 表达式索引
CREATE INDEX idx_lower_email ON users(LOWER(email));
```

审计项：
- [ ] 所有 WHERE/JOIN/ORDER BY 列有适当索引
- [ ] 无未使用的索引（定期清理）
- [ ] 慢查询日志已开启，阈值 100ms
- [ ] 定期执行 EXPLAIN ANALYZE 审查查询计划
- [ ] N+1 查询已消除（使用 JOIN 或批量加载）

### N+1 问题

```python
# 反模式：N+1 查询
users = db.query("SELECT * FROM users LIMIT 100")
for user in users:
    orders = db.query(f"SELECT * FROM orders WHERE user_id = {user.id}")

# 正确：批量加载
users = db.query("SELECT * FROM users LIMIT 100")
user_ids = [u.id for u in users]
orders = db.query("SELECT * FROM orders WHERE user_id IN (:ids)", ids=user_ids)
```

## 网络性能

审计项：
- [ ] 启用 Brotli/Gzip 压缩（文本资源压缩率 > 70%）
- [ ] 静态资源通过 CDN 分发
- [ ] HTTP/2 或 HTTP/3 已启用
- [ ] 合理的缓存头（`Cache-Control`、`ETag`）
- [ ] API 响应支持分页，单次返回数据量有上限
- [ ] 使用 `Connection: keep-alive` 复用 TCP 连接
- [ ] DNS 预解析：`<link rel="dns-prefetch" href="//api.example.com">`

## 总检查清单

- [ ] **前端**：包体积达标、图片优化、Core Web Vitals 全绿
- [ ] **后端**：缓存命中率高、连接池配置合理、无阻塞操作
- [ ] **数据库**：索引覆盖、无慢查询、无 N+1
- [ ] **网络**：压缩启用、CDN 配置、HTTP/2+
- [ ] **监控**：性能指标可观测、回归自动告警
- [ ] **CI**：Lighthouse CI / 性能预算集成到流水线
