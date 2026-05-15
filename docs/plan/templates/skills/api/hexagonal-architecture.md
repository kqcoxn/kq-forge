---
name: hexagonal-architecture
type: capability
package: api
description: 六边形架构（端口与适配器）——领域逻辑与基础设施解耦的设计模式
---

# 六边形架构（Ports & Adapters）

## 核心理念

> 业务逻辑不依赖框架、传输层和持久化细节。核心应用依赖抽象端口，适配器在边缘实现端口。

## 何时使用

- 构建需要长期维护和可测试性的新功能
- 重构框架耦合严重的代码（领域逻辑混杂 I/O）
- 同一用例需要支持多种接口（HTTP、CLI、队列消费者、定时任务）
- 替换基础设施（数据库、外部 API、消息总线）而不重写业务规则

## 核心概念

| 概念 | 说明 |
|------|------|
| 领域模型 | 业务规则和实体/值对象。无框架导入 |
| 用例（应用层） | 编排领域行为和工作流步骤 |
| 入站端口 | 描述应用能做什么的契约（命令/查询/用例接口） |
| 出站端口 | 描述应用需要什么依赖的契约（仓储、网关、事件发布者） |
| 适配器 | 端口的基础设施实现（HTTP 控制器、DB 仓储、队列消费者） |
| 组合根 | 唯一的装配位置，将具体适配器绑定到用例 |

## 依赖方向

```
适配器 → 应用层/领域层
应用层 → 端口接口（入站/出站契约）
领域层 → 仅领域内抽象（无框架/基础设施依赖）
```

**永远向内依赖，外层依赖内层，内层不知道外层的存在。**

## 实施步骤

### 1. 建模用例边界

定义单个用例，明确输入/输出 DTO。传输层细节（Express req、GraphQL context）留在边界外。

### 2. 先定义出站端口

识别每个副作用为一个端口：

```typescript
// 端口建模能力，不建模技术
interface UserRepositoryPort {
  findById(id: string): Promise<User | null>
  save(user: User): Promise<void>
}

interface NotificationPort {
  sendWelcomeEmail(user: User): Promise<void>
}

interface ClockPort {
  now(): Date
}
```

### 3. 用例只做纯编排

```typescript
export class CreateUserUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly notification: NotificationPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: CreateUserInput): Promise<User> {
    // 应用层校验
    if (await this.userRepo.findByEmail(input.email)) {
      throw new ConflictError('Email already registered')
    }

    // 领域逻辑
    const user = User.create({
      ...input,
      createdAt: this.clock.now(),
    })

    // 持久化 + 副作用
    await this.userRepo.save(user)
    await this.notification.sendWelcomeEmail(user)

    return user
  }
}
```

### 4. 在边缘构建适配器

```typescript
// 入站适配器：将协议输入转为用例输入
export class UserController {
  constructor(private readonly createUser: CreateUserUseCase) {}

  async handlePost(req: Request): Promise<Response> {
    const input = CreateUserSchema.parse(req.body)
    const user = await this.createUser.execute(input)
    return Response.json({ data: user }, { status: 201 })
  }
}

// 出站适配器：将应用契约映射到具体实现
export class PrismaUserRepository implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } })
    return record ? User.fromRecord(record) : null
  }

  async save(user: User): Promise<void> {
    await this.prisma.user.create({ data: user.toRecord() })
  }
}
```

### 5. 组合根装配

```typescript
// composition-root.ts — 唯一知道所有具体类的地方
const prisma = new PrismaClient()
const userRepo = new PrismaUserRepository(prisma)
const notification = new SmtpNotificationAdapter(config.smtp)
const clock = new SystemClock()

const createUserUseCase = new CreateUserUseCase(userRepo, notification, clock)
const userController = new UserController(createUserUseCase)
```

### 6. 按边界测试

| 测试类型 | 目标 | 方法 |
|----------|------|------|
| 单元测试 | 用例 | 用 fake 端口替换真实依赖 |
| 集成测试 | 适配器 | 用真实基础设施（测试数据库） |
| E2E 测试 | 完整流程 | 通过入站适配器发起请求 |

## 目录结构示例

```
src/
├── domain/           # 领域模型（实体、值对象、领域服务）
│   ├── user.ts
│   └── order.ts
├── application/      # 用例 + 端口定义
│   ├── ports/
│   │   ├── user-repository.port.ts
│   │   └── notification.port.ts
│   └── use-cases/
│       ├── create-user.ts
│       └── place-order.ts
├── infrastructure/   # 出站适配器
│   ├── persistence/
│   │   └── prisma-user-repository.ts
│   └── notification/
│       └── smtp-notification.ts
├── presentation/     # 入站适配器
│   ├── http/
│   │   └── user-controller.ts
│   └── cli/
│       └── user-commands.ts
└── composition-root.ts
```

## 反模式

| 反模式 | 正确做法 |
|--------|----------|
| 用例直接导入 Prisma/TypeORM | 通过端口接口间接依赖 |
| 控制器里写业务逻辑 | 控制器只做输入转换和输出映射 |
| 领域模型导入框架装饰器 | 领域模型纯净，映射逻辑在适配器 |
| 到处 new 具体类 | 集中在组合根装配 |
| 端口按技术命名（SqlUserRepo） | 端口按能力命名（UserRepositoryPort） |
