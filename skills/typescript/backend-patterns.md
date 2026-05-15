---
name: backend-patterns
type: capability
package: typescript
description: Node.js 后端开发模式，涵盖项目结构、中间件、依赖注入、仓储模式、服务层、输入验证、日志与优雅关闭。
---

# Node.js 后端开发模式

## 核心原则

1. **分层架构** — Controller → Service → Repository，职责清晰
2. **依赖注入** — 解耦模块，便于测试和替换
3. **防御性编程** — 所有外部输入必须验证
4. **可观测性** — 结构化日志、健康检查、指标暴露

## 项目结构

```
src/
├── modules/                # 按功能模块组织
│   ├── user/
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   ├── user.repository.ts
│   │   ├── user.types.ts
│   │   ├── user.validation.ts
│   │   └── user.test.ts
│   └── order/
│       ├── order.controller.ts
│       ├── order.service.ts
│       └── ...
├── middleware/             # 通用中间件
│   ├── auth.middleware.ts
│   ├── error-handler.ts
│   └── request-logger.ts
├── infrastructure/         # 基础设施
│   ├── database.ts
│   ├── cache.ts
│   └── logger.ts
├── config/                 # 配置
│   └── env.ts
└── app.ts                  # 应用入口
```

## 中间件模式

```typescript
import { Request, Response, NextFunction } from 'express';

// 类型安全的中间件
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

// 异步中间件包装器 — 自动捕获异步错误
function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// 请求日志中间件
function requestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      logger.info('请求完成', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: Date.now() - start,
      });
    });
    next();
  };
}

// 认证中间件
function authGuard(tokenService: TokenService) {
  return asyncHandler(async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new AppError('未提供认证令牌', 'UNAUTHORIZED', 401);
    }
    const payload = await tokenService.verify(token);
    req.user = payload;
    next();
  });
}
```

## 依赖注入

```typescript
// 简单的 DI 容器
class Container {
  private services = new Map<string, unknown>();

  register<T>(token: string, factory: () => T): void {
    this.services.set(token, factory());
  }

  resolve<T>(token: string): T {
    const service = this.services.get(token);
    if (!service) throw new Error(`服务未注册: ${token}`);
    return service as T;
  }
}

// 注册服务
const container = new Container();
container.register('db', () => new DatabaseClient(config.database));
container.register('logger', () => new Logger(config.log));
container.register('userRepo', () => new UserRepository(container.resolve('db')));
container.register('userService', () => new UserService(container.resolve('userRepo')));

// 基于接口的依赖注入
interface IUserRepository {
  findById(id: string): Promise<User | null>;
  create(data: CreateUserDto): Promise<User>;
}

class UserService {
  constructor(private readonly userRepo: IUserRepository) {}

  async getUser(id: string): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new AppError('用户不存在', 'NOT_FOUND', 404);
    return user;
  }
}
```

## 仓储模式

```typescript
// 通用仓储接口
interface Repository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  findAll(filter?: Partial<T>): Promise<T[]>;
  create(data: Omit<T, 'id' | 'createdAt'>): Promise<T>;
  update(id: ID, data: Partial<T>): Promise<T>;
  delete(id: ID): Promise<void>;
}

// 具体实现
class UserRepository implements Repository<User> {
  constructor(private readonly db: DatabaseClient) {}

  async findById(id: string): Promise<User | null> {
    return this.db.query<User>('SELECT * FROM users WHERE id = $1', [id]);
  }

  async create(data: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const result = await this.db.query<User>(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [data.name, data.email],
    );
    return result;
  }

  async findAll(filter?: Partial<User>): Promise<User[]> {
    // 动态构建查询条件
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filter?.name) {
      conditions.push(`name ILIKE $${params.length + 1}`);
      params.push(`%${filter.name}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return this.db.queryAll<User>(`SELECT * FROM users ${where}`, params);
  }
}
```

## 输入验证

```typescript
import { z } from 'zod';

// 定义验证 Schema
const createUserSchema = z.object({
  name: z.string().min(2, '姓名至少2个字符').max(50),
  email: z.string().email('邮箱格式无效'),
  age: z.number().int().min(0).max(150).optional(),
  role: z.enum(['user', 'admin']).default('user'),
});

type CreateUserDto = z.infer<typeof createUserSchema>;

// 验证中间件工厂
function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      res.status(400).json({ code: 'VALIDATION_ERROR', errors });
      return;
    }
    req.body = result.data;
    next();
  };
}

// 使用
router.post('/users', validate(createUserSchema), userController.create);
```

## 结构化日志

```typescript
interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  traceId?: string;
}

class Logger {
  private context: Record<string, unknown> = {};

  child(context: Record<string, unknown>): Logger {
    const child = new Logger();
    child.context = { ...this.context, ...context };
    return child;
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    this.write('error', message, {
      ...meta,
      error: error ? { message: error.message, stack: error.stack } : undefined,
    });
  }

  private write(level: LogEntry['level'], message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: { ...this.context, ...meta },
    };
    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}
```

## 优雅关闭

```typescript
class GracefulShutdown {
  private cleanups: Array<() => Promise<void>> = [];

  register(name: string, cleanup: () => Promise<void>): void {
    this.cleanups.push(cleanup);
  }

  listen(): void {
    const shutdown = async (signal: string) => {
      console.log(`收到 ${signal} 信号，开始优雅关闭...`);
      for (const cleanup of this.cleanups) {
        try {
          await cleanup();
        } catch (error) {
          console.error('清理失败:', error);
        }
      }
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// 使用
const shutdown = new GracefulShutdown();
shutdown.register('http-server', async () => { await server.close(); });
shutdown.register('database', async () => { await db.disconnect(); });
shutdown.register('cache', async () => { await redis.quit(); });
shutdown.listen();
```

## 健康检查

```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, { status: string; latency?: number }>;
  uptime: number;
}

async function healthCheck(deps: { db: DatabaseClient; redis: RedisClient }): Promise<HealthStatus> {
  const checks: HealthStatus['checks'] = {};

  // 数据库检查
  const dbStart = Date.now();
  try {
    await deps.db.query('SELECT 1');
    checks.database = { status: 'ok', latency: Date.now() - dbStart };
  } catch {
    checks.database = { status: 'error' };
  }

  // Redis 检查
  const redisStart = Date.now();
  try {
    await deps.redis.ping();
    checks.redis = { status: 'ok', latency: Date.now() - redisStart };
  } catch {
    checks.redis = { status: 'error' };
  }

  const allOk = Object.values(checks).every((c) => c.status === 'ok');
  return {
    status: allOk ? 'healthy' : 'degraded',
    checks,
    uptime: process.uptime(),
  };
}
```

## 环境配置

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

// 启动时验证环境变量 — 失败则立即退出
function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('环境变量验证失败:');
    result.error.issues.forEach((issue) => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
```

## 检查清单

- [ ] 项目按功能模块组织，非按技术层组织
- [ ] 所有外部输入经过 Zod 验证
- [ ] 中间件使用 asyncHandler 包装异步操作
- [ ] 服务层通过接口依赖仓储层（可替换/可测试）
- [ ] 日志为结构化 JSON 格式，包含 traceId
- [ ] 实现优雅关闭，释放所有资源
- [ ] 健康检查端点覆盖所有外部依赖
- [ ] 环境变量启动时验证，类型安全
- [ ] 错误处理统一，返回标准错误格式
- [ ] 敏感信息不出现在日志中
