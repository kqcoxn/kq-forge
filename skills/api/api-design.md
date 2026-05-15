---
name: api-design
type: constraint
package: api
description: REST API 设计规范——资源命名、状态码、分页、过滤、错误响应、版本控制
---

# API 设计规范

## 核心原则

1. **资源是名词**——URL 表示资源，不表示动作
2. **HTTP 方法表达语义**——GET 读取、POST 创建、PUT 全量更新、PATCH 部分更新、DELETE 删除
3. **状态码诚实**——不要所有响应都返回 200
4. **错误格式统一**——所有错误遵循相同的信封格式
5. **分页是必须的**——列表端点必须支持分页

## URL 设计

```
# 资源：复数、小写、kebab-case
GET    /api/v1/users
GET    /api/v1/users/:id
POST   /api/v1/users
PUT    /api/v1/users/:id
PATCH  /api/v1/users/:id
DELETE /api/v1/users/:id

# 子资源表示从属关系
GET    /api/v1/users/:id/orders
POST   /api/v1/users/:id/orders

# 非 CRUD 动作（谨慎使用动词）
POST   /api/v1/orders/:id/cancel
POST   /api/v1/auth/login
```

### 命名规则

| 规则 | 正确 | 错误 |
|------|------|------|
| 复数名词 | `/users` | `/user` |
| kebab-case | `/team-members` | `/team_members` |
| 无动词 | `/users` | `/getUsers` |
| 查询参数过滤 | `/orders?status=active` | `/orders/active` |

## HTTP 状态码

### 成功

| 状态码 | 用途 |
|--------|------|
| 200 OK | GET、PUT、PATCH（有响应体） |
| 201 Created | POST（附 Location 头） |
| 204 No Content | DELETE、PUT（无响应体） |

### 客户端错误

| 状态码 | 用途 |
|--------|------|
| 400 Bad Request | 格式错误、JSON 解析失败 |
| 401 Unauthorized | 未认证 |
| 403 Forbidden | 已认证但无权限 |
| 404 Not Found | 资源不存在 |
| 409 Conflict | 重复、状态冲突 |
| 422 Unprocessable Entity | 语义无效（JSON 合法但数据不合法） |
| 429 Too Many Requests | 限流 |

### 服务端错误

| 状态码 | 用途 |
|--------|------|
| 500 Internal Server Error | 意外故障（不暴露细节） |
| 502 Bad Gateway | 上游服务故障 |
| 503 Service Unavailable | 临时过载（附 Retry-After） |

## 响应格式

### 成功响应

```json
{
  "data": {
    "id": "abc-123",
    "email": "alice@example.com",
    "name": "Alice",
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

### 列表响应（含分页）

```json
{
  "data": [...],
  "meta": {
    "total": 142,
    "page": 1,
    "per_page": 20,
    "total_pages": 8
  },
  "links": {
    "self": "/api/v1/users?page=1&per_page=20",
    "next": "/api/v1/users?page=2&per_page=20",
    "last": "/api/v1/users?page=8&per_page=20"
  }
}
```

### 错误响应

```json
{
  "error": {
    "code": "validation_error",
    "message": "请求验证失败",
    "details": [
      { "field": "email", "message": "必须是有效的邮箱地址", "code": "invalid_format" },
      { "field": "age", "message": "必须在 0-150 之间", "code": "out_of_range" }
    ]
  }
}
```

## 分页策略

### 偏移分页（简单场景）

```
GET /api/v1/users?page=2&per_page=20
```

适用：管理后台、小数据集（<10K 条）、需要"跳转到第 N 页"

### 游标分页（大规模场景）

```
GET /api/v1/users?cursor=eyJpZCI6MTIzfQ&limit=20
```

适用：无限滚动、信息流、大数据集、公开 API

## 过滤与排序

```
# 等值过滤
GET /api/v1/orders?status=active&customer_id=abc-123

# 比较运算符（方括号表示法）
GET /api/v1/products?price[gte]=10&price[lte]=100

# 多值（逗号分隔）
GET /api/v1/products?category=electronics,clothing

# 排序（- 前缀表示降序）
GET /api/v1/products?sort=-created_at,price

# 稀疏字段集（减少载荷）
GET /api/v1/users?fields=id,name,email
```

## 版本控制

**推荐：URL 路径版本**

```
/api/v1/users
/api/v2/users
```

**版本策略：**
- 最多维护 2 个活跃版本（当前 + 上一个）
- 非破坏性变更不需要新版本（新增字段、新增可选参数、新增端点）
- 破坏性变更必须新版本（删除/重命名字段、改变类型、改变 URL 结构）
- 废弃通知至少提前 6 个月（公开 API）

## 限流

```
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000

HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

## 检查清单

发布新端点前逐条确认：

- [ ] URL 遵循命名规范（复数、kebab-case、无动词）
- [ ] 使用正确的 HTTP 方法
- [ ] 返回恰当的状态码
- [ ] 输入经过 schema 验证
- [ ] 错误响应遵循标准格式
- [ ] 列表端点实现了分页
- [ ] 需要认证的端点已配置认证
- [ ] 授权检查已实现（用户只能访问自己的资源）
- [ ] 限流已配置
- [ ] 响应不泄露内部细节（堆栈跟踪、SQL 错误）
- [ ] 与现有端点命名风格一致
