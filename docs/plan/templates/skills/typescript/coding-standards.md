---
name: coding-standards
type: constraint
package: typescript
description: TypeScript/JavaScript 基线编码规范，涵盖命名、不可变性、类型安全、错误处理、异步模式与文件组织。
---

# TypeScript 编码规范

## 核心原则

1. **类型安全优先** — 杜绝 `any`，用类型系统表达业务意图
2. **不可变性** — 优先使用展开运算符和纯函数，避免直接修改
3. **显式优于隐式** — 命名、返回类型、错误处理都应清晰明确
4. **单一职责** — 每个函数/模块只做一件事

## 命名规范

```typescript
// 变量和函数：camelCase
const userName = 'Alice';
function getUserById(id: string): User { /* ... */ }

// 类型、接口、枚举、组件：PascalCase
interface UserProfile {
  displayName: string;
  avatarUrl: string;
}

type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

enum HttpMethod {
  Get = 'GET',
  Post = 'POST',
}

// 常量：UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = '/api/v1';

// 布尔值：is/has/can/should 前缀
const isLoading = false;
const hasPermission = true;
const canEdit = user.role === 'admin';
```

### 反模式

```typescript
// ❌ 避免
const data: any = fetchData();
const cb = (x: any) => x.name;
let arr = [1, 2, 3]; arr.push(4); // 直接修改

// ✅ 正确
const data: UserResponse = await fetchData();
const getName = (user: User) => user.name;
const arr = [1, 2, 3];
const newArr = [...arr, 4]; // 展开创建新数组
```

## 不可变性

```typescript
// 对象更新 — 展开运算符
function updateUser(user: User, patch: Partial<User>): User {
  return { ...user, ...patch };
}

// 数组操作 — 不修改原数组
function addItem<T>(items: readonly T[], item: T): T[] {
  return [...items, item];
}

function removeItem<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

// 使用 readonly 标记不应修改的数据
interface Config {
  readonly apiUrl: string;
  readonly timeout: number;
  readonly features: readonly string[];
}
```

## 类型安全

```typescript
// 使用判别联合类型代替可选字段
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

function processResult(result: Result<User>) {
  if (result.success) {
    // TypeScript 自动收窄类型
    console.log(result.data.name);
  } else {
    console.error(result.error.message);
  }
}

// 使用 satisfies 进行类型检查同时保留字面量类型
const routes = {
  home: '/',
  about: '/about',
  user: '/user/:id',
} satisfies Record<string, string>;

// 使用泛型约束而非 any
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// 使用 unknown 代替 any 处理未知数据
function parseJson(raw: string): unknown {
  return JSON.parse(raw);
}
```

## 错误处理

```typescript
// 定义业务错误类型
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// 类型安全的错误处理
async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      return {
        success: false,
        error: new AppError('用户不存在', 'USER_NOT_FOUND', 404),
      };
    }
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
```

## 异步模式

```typescript
// 并行执行无依赖的异步操作
async function loadDashboard(userId: string) {
  const [user, posts, notifications] = await Promise.all([
    fetchUser(userId),
    fetchPosts(userId),
    fetchNotifications(userId),
  ]);
  return { user, posts, notifications };
}

// 使用 Promise.allSettled 处理部分失败
async function batchProcess(ids: string[]) {
  const results = await Promise.allSettled(
    ids.map((id) => processItem(id)),
  );

  const succeeded = results.filter(
    (r): r is PromiseFulfilledResult<Item> => r.status === 'fulfilled',
  );
  const failed = results.filter(
    (r): r is PromiseRejectedResult => r.status === 'rejected',
  );

  return { succeeded: succeeded.map((r) => r.value), failed };
}

// 带超时的异步操作
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`操作超时: ${ms}ms`)), ms),
  );
  return Promise.race([promise, timeout]);
}
```

## 文件组织

```
src/
├── features/           # 按功能模块组织
│   ├── auth/
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.types.ts
│   │   └── auth.test.ts
│   └── user/
│       ├── user.service.ts
│       ├── user.repository.ts
│       └── user.types.ts
├── shared/             # 跨模块共享代码
│   ├── utils/
│   ├── types/
│   └── constants/
└── infrastructure/     # 基础设施层
    ├── database/
    ├── cache/
    └── logger/
```

### 文件规范

- 每个文件 **200-400 行**，超过则拆分
- 一个文件只导出一个主要概念
- 测试文件与源文件同目录，后缀 `.test.ts` 或 `.spec.ts`
- 类型定义集中在 `*.types.ts` 文件中
- 桶文件 (`index.ts`) 只做重导出，不含逻辑

## 检查清单

- [ ] 所有变量/函数使用 camelCase，类型/组件使用 PascalCase
- [ ] 代码中无 `any` 类型（使用 `unknown` + 类型守卫代替）
- [ ] 对象/数组更新使用展开运算符，无直接修改
- [ ] 所有异步错误都有 try/catch 或 Result 类型处理
- [ ] 无依赖的异步操作使用 Promise.all 并行执行
- [ ] 每个文件不超过 400 行
- [ ] 导出函数有明确的返回类型标注
- [ ] 布尔变量使用 is/has/can/should 前缀
