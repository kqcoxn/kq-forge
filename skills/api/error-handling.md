---
name: error-handling
type: constraint
package: api
description: 统一错误处理模式——类型化错误、错误边界、重试、用户友好消息
---

# 统一错误处理

## 核心原则

1. **快速失败，大声失败**——在错误发生的边界立即暴露，不要埋藏
2. **类型化错误优于字符串消息**——错误是有结构的一等值
3. **用户消息 ≠ 开发者消息**——给用户看友好文本，给日志记完整上下文
4. **永远不要静默吞掉错误**——每个 catch 块必须处理、重抛或记录
5. **错误是 API 契约的一部分**——文档化客户端可能收到的每个错误码

## 错误类层次结构

### TypeScript

```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = this.constructor.name
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details: { field: string; message: string }[]) {
    super(message, 'VALIDATION_ERROR', 422, details)
  }
}

export class UnauthorizedError extends AppError {
  constructor(reason = 'Authentication required') {
    super(reason, 'UNAUTHORIZED', 401)
  }
}
```

### Python

```python
class AppError(Exception):
    def __init__(self, message: str, code: str, status_code: int = 500):
        super().__init__(message)
        self.code = code
        self.status_code = status_code

class NotFoundError(AppError):
    def __init__(self, resource: str, id: str):
        super().__init__(f"{resource} not found: {id}", "NOT_FOUND", 404)

class ValidationError(AppError):
    def __init__(self, message: str, details: list[dict] | None = None):
        super().__init__(message, "VALIDATION_ERROR", 422)
        self.details = details or []
```

### Go

```go
var (
    ErrNotFound     = errors.New("not found")
    ErrUnauthorized = errors.New("unauthorized")
    ErrConflict     = errors.New("conflict")
)

// 用 fmt.Errorf + %w 包装错误，保留原始链
func (r *UserRepo) FindByID(ctx context.Context, id string) (*User, error) {
    user, err := r.db.QueryRow(ctx, query, id)
    if errors.Is(err, sql.ErrNoRows) {
        return nil, fmt.Errorf("user %s: %w", id, ErrNotFound)
    }
    if err != nil {
        return nil, fmt.Errorf("querying user %s: %w", id, err)
    }
    return user, nil
}
```

## Result 模式（无抛出风格）

适用于失败是预期且常见的操作（解析、外部调用）：

```typescript
type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E }

async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const user = await db.users.findUnique({ where: { id } })
    if (!user) return { ok: false, error: new NotFoundError('User', id) }
    return { ok: true, value: user }
  } catch (e) {
    return { ok: false, error: new AppError('Database error', 'DB_ERROR') }
  }
}
```

## 重试与指数退避

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number; retryIf?: (e: unknown) => boolean } = {},
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 500, retryIf = () => true } = options
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt === maxAttempts || !retryIf(error)) throw error
      const jitter = Math.random() * baseDelayMs
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1) + jitter, 10_000)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw lastError
}
```

**重试规则：** 只重试可重试的错误（5xx、网络超时），不重试 4xx 客户端错误。

## 用户友好消息映射

```typescript
const USER_MESSAGES: Record<string, string> = {
  NOT_FOUND: '请求的资源不存在。',
  UNAUTHORIZED: '请先登录。',
  FORBIDDEN: '您没有权限执行此操作。',
  VALIDATION_ERROR: '请检查输入后重试。',
  RATE_LIMITED: '请求过于频繁，请稍后再试。',
  INTERNAL_ERROR: '服务器出了点问题，请稍后再试。',
}
```

## 检查清单

- [ ] 每个 catch 块都处理、重抛或记录——无静默吞掉
- [ ] API 错误遵循标准信封 `{ error: { code, message } }`
- [ ] 用户可见消息不包含堆栈跟踪或内部细节
- [ ] 完整错误上下文记录在服务端日志
- [ ] 自定义错误类继承基类 AppError 并带 code 字段
- [ ] 异步函数将错误传播给调用者——无 fire-and-forget
- [ ] 重试逻辑只重试可重试错误
- [ ] React 组件用 ErrorBoundary 包裹
