---
name: prisma-patterns
type: capability
package: database
description: Prisma ORM 最佳实践——Schema 设计、关系建模、查询优化、迁移、类型安全
---

# Prisma ORM 模式

## Schema 设计

### 基础模型

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  role      Role     @default(USER)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // 关系
  posts     Post[]
  profile   Profile?

  @@map("users")  // 表名用 snake_case
}

enum Role {
  USER
  ADMIN
  MODERATOR
}
```

### 命名规范

| 层面 | 规范 | 示例 |
|------|------|------|
| Model 名 | PascalCase 单数 | `User`, `OrderItem` |
| 字段名 | camelCase | `createdAt`, `userId` |
| 表名（@@map） | snake_case 复数 | `users`, `order_items` |
| 列名（@map） | snake_case | `created_at`, `user_id` |
| 枚举 | PascalCase + UPPER_CASE 值 | `Role.ADMIN` |

### 关系建模

```prisma
// 一对一
model User {
  id      String   @id @default(uuid())
  profile Profile?
}

model Profile {
  id     String @id @default(uuid())
  bio    String?
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId String @unique @map("user_id")

  @@map("profiles")
}

// 一对多
model User {
  id    String @id @default(uuid())
  posts Post[]
}

model Post {
  id       String @id @default(uuid())
  title    String
  author   User   @relation(fields: [authorId], references: [id])
  authorId String @map("author_id")

  @@index([authorId])
  @@map("posts")
}

// 多对多（显式中间表，推荐）
model Post {
  id   String     @id @default(uuid())
  tags PostTag[]
}

model Tag {
  id    String    @id @default(uuid())
  name  String    @unique
  posts PostTag[]
}

model PostTag {
  post   Post   @relation(fields: [postId], references: [id], onDelete: Cascade)
  postId String @map("post_id")
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)
  tagId  String @map("tag_id")

  @@id([postId, tagId])
  @@map("post_tags")
}
```

## 查询优化

### 避免 N+1 查询

```typescript
// 差：N+1 查询
const users = await prisma.user.findMany()
for (const user of users) {
  const posts = await prisma.post.findMany({ where: { authorId: user.id } })
}

// 好：include 预加载
const users = await prisma.user.findMany({
  include: { posts: true }
})

// 好：select 只取需要的字段
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    posts: {
      select: { id: true, title: true },
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }
  }
})
```

### 批量操作

```typescript
// 批量创建
await prisma.user.createMany({
  data: users,
  skipDuplicates: true,
})

// 批量更新（事务）
await prisma.$transaction(
  ids.map(id =>
    prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE' },
    })
  )
)

// 批量删除
await prisma.user.deleteMany({
  where: { lastLoginAt: { lt: oneYearAgo } }
})
```

### 游标分页

```typescript
async function getUsers(cursor?: string, take = 20) {
  const users = await prisma.user.findMany({
    take: take + 1,  // 多取一条判断是否有下一页
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,  // 跳过 cursor 本身
    }),
    orderBy: { createdAt: 'desc' },
  })

  const hasNext = users.length > take
  if (hasNext) users.pop()

  return {
    data: users,
    nextCursor: hasNext ? users[users.length - 1].id : null,
  }
}
```

## 事务

```typescript
// 交互式事务（需要中间逻辑）
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.findUnique({ where: { id } })
  if (!user) throw new NotFoundError('User', id)

  const order = await tx.order.create({
    data: { userId: user.id, total: amount }
  })

  await tx.user.update({
    where: { id },
    data: { balance: { decrement: amount } }
  })

  return order
}, {
  maxWait: 5000,    // 等待连接的最大时间
  timeout: 10000,   // 事务超时时间
  isolationLevel: 'Serializable',  // 按需设置隔离级别
})
```

## 迁移工作流

```bash
# 开发环境：生成并应用迁移
npx prisma migrate dev --name add_users_table

# 生产环境：只应用迁移（不生成）
npx prisma migrate deploy

# 重置开发数据库
npx prisma migrate reset

# 查看迁移状态
npx prisma migrate status

# 生成客户端（schema 变更后）
npx prisma generate
```

### 迁移最佳实践

```
1. 每个迁移做一件事（不要混合多个变更）
2. 迁移文件提交到 Git
3. 不要手动编辑已应用的迁移文件
4. 生产环境用 prisma migrate deploy（不是 dev）
5. 大表变更先在 staging 测试
```

## 中间件与扩展

```typescript
// 软删除中间件
prisma.$use(async (params, next) => {
  if (params.action === 'delete') {
    params.action = 'update'
    params.args.data = { deletedAt: new Date() }
  }
  if (params.action === 'findMany') {
    params.args.where = { ...params.args.where, deletedAt: null }
  }
  return next(params)
})

// 查询日志
prisma.$use(async (params, next) => {
  const start = Date.now()
  const result = await next(params)
  const duration = Date.now() - start
  if (duration > 100) {
    console.warn(`Slow query: ${params.model}.${params.action} (${duration}ms)`)
  }
  return result
})
```

## 检查清单

- [ ] Schema 使用 @@map / @map 映射为 snake_case 表名/列名
- [ ] 外键字段有 @@index（Prisma 不自动创建）
- [ ] 关系定义了 onDelete 行为（Cascade / SetNull / Restrict）
- [ ] 查询使用 select/include 避免 N+1
- [ ] 批量操作使用 createMany / $transaction
- [ ] 分页使用游标而非 skip/take（大数据集）
- [ ] 事务设置了 timeout 和 maxWait
- [ ] 迁移文件已提交到版本控制
- [ ] 生产部署使用 `prisma migrate deploy`
