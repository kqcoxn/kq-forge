---
name: nextjs-patterns
type: capability
package: typescript
description: Next.js App Router 开发模式，涵盖服务端/客户端组件、数据获取、缓存策略、中间件、流式渲染与 ISR。
---

# Next.js App Router 开发模式

## 核心原则

1. **服务端优先** — 默认使用服务端组件，仅在需要交互时使用客户端组件
2. **渐进式渲染** — 利用 Streaming 和 Suspense 提升首屏体验
3. **缓存分层** — 合理使用 revalidate 和 cache tags 控制数据新鲜度
4. **边缘就绪** — 中间件和路由处理器可运行在边缘节点

## 服务端组件 vs 客户端组件

```tsx
// 服务端组件（默认）— 无需 'use client'
// 适用：数据获取、访问后端资源、保持敏感信息在服务端
async function UserProfile({ userId }: { userId: string }) {
  // 直接在组件中获取数据，无需 useEffect
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) notFound();

  return (
    <section>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      {/* 客户端组件嵌入服务端组件 */}
      <FollowButton userId={userId} />
    </section>
  );
}

// 客户端组件 — 需要交互、浏览器 API、状态
'use client';

import { useState, useTransition } from 'react';

function FollowButton({ userId }: { userId: string }) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleFollow = () => {
    startTransition(async () => {
      await followUser(userId);
      setIsFollowing(true);
    });
  };

  return (
    <button onClick={handleFollow} disabled={isPending}>
      {isPending ? '处理中...' : isFollowing ? '已关注' : '关注'}
    </button>
  );
}
```

### 选择指南

| 场景 | 组件类型 |
|------|---------|
| 获取数据 | 服务端 |
| 访问数据库/文件系统 | 服务端 |
| 使用 useState/useEffect | 客户端 |
| 事件监听 (onClick 等) | 客户端 |
| 浏览器 API (localStorage) | 客户端 |
| 静态展示内容 | 服务端 |

## 数据获取

### Server Actions

```tsx
// actions.ts
'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10),
});

export async function createPost(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const result = createPostSchema.safeParse(raw);

  if (!result.success) {
    return { error: result.error.flatten().fieldErrors };
  }

  await db.post.create({ data: result.data });
  revalidateTag('posts');
  redirect('/posts');
}

// 在服务端组件中使用
function CreatePostForm() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <textarea name="content" required />
      <button type="submit">发布</button>
    </form>
  );
}
```

### Route Handlers

```tsx
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = Number(searchParams.get('page') ?? '1');
  const limit = Number(searchParams.get('limit') ?? '20');

  const users = await db.user.findMany({
    skip: (page - 1) * limit,
    take: limit,
  });

  return NextResponse.json({ data: users, page, limit });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  // 验证 + 创建
  const user = await db.user.create({ data: body });
  return NextResponse.json(user, { status: 201 });
}
```

## 缓存策略

```tsx
// 基于时间的重验证
async function BlogList() {
  const posts = await fetch('https://api.example.com/posts', {
    next: { revalidate: 60 }, // 60秒后重新验证
  }).then((r) => r.json());

  return <PostGrid posts={posts} />;
}

// 基于标签的重验证
async function ProductPage({ id }: { id: string }) {
  const product = await fetch(`https://api.example.com/products/${id}`, {
    next: { tags: [`product-${id}`] },
  }).then((r) => r.json());

  return <ProductDetail product={product} />;
}

// 在 Server Action 中按标签失效
'use server';
export async function updateProduct(id: string, data: ProductUpdate) {
  await db.product.update({ where: { id }, data });
  revalidateTag(`product-${id}`);
}

// 不缓存 — 动态数据
async function LiveDashboard() {
  const stats = await fetch('https://api.example.com/stats', {
    cache: 'no-store',
  }).then((r) => r.json());

  return <StatsPanel stats={stats} />;
}
```

## 中间件

```tsx
// middleware.ts（项目根目录）
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 国际化重定向
  const locale = request.headers.get('accept-language')?.split(',')[0] ?? 'zh';
  if (pathname === '/') {
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  // 认证保护
  const token = request.cookies.get('session')?.value;
  if (pathname.startsWith('/dashboard') && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 添加自定义头
  const response = NextResponse.next();
  response.headers.set('x-request-id', crypto.randomUUID());
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

## 并行路由与拦截路由

```
app/
├── @modal/              # 并行路由插槽
│   ├── (.)photo/[id]/   # 拦截路由 — 模态框展示
│   │   └── page.tsx
│   └── default.tsx
├── photo/[id]/          # 完整页面
│   └── page.tsx
└── layout.tsx           # 接收 modal 插槽
```

```tsx
// app/layout.tsx — 并行路由
export default function Layout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}

// app/@modal/(.)photo/[id]/page.tsx — 拦截路由（模态框）
export default function PhotoModal({ params }: { params: { id: string } }) {
  return (
    <Dialog>
      <PhotoDetail id={params.id} />
    </Dialog>
  );
}
```

## 流式渲染

```tsx
import { Suspense } from 'react';

// 页面级流式渲染 — 快速展示骨架，逐步填充内容
export default function DashboardPage() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Suspense fallback={<CardSkeleton />}>
        <RevenueCard />
      </Suspense>
      <Suspense fallback={<CardSkeleton />}>
        <UsersCard />
      </Suspense>
      <Suspense fallback={<TableSkeleton />}>
        <RecentOrders />
      </Suspense>
    </div>
  );
}

// 每个组件独立获取数据，互不阻塞
async function RevenueCard() {
  const revenue = await getRevenue(); // 可能耗时 2s
  return <Card title="收入" value={formatCurrency(revenue)} />;
}

async function RecentOrders() {
  const orders = await getRecentOrders(); // 可能耗时 3s
  return <OrderTable orders={orders} />;
}
```

## Metadata API

```tsx
import type { Metadata, ResolvingMetadata } from 'next';

// 静态元数据
export const metadata: Metadata = {
  title: '我的应用',
  description: '应用描述',
  openGraph: { title: '我的应用', type: 'website' },
};

// 动态元数据
export async function generateMetadata(
  { params }: { params: { id: string } },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const product = await getProduct(params.id);
  const previousImages = (await parent).openGraph?.images ?? [];

  return {
    title: product.name,
    description: product.description,
    openGraph: {
      images: [product.image, ...previousImages],
    },
  };
}
```

## ISR 模式

```tsx
// 静态生成 + 增量再生
export const revalidate = 3600; // 每小时重新生成

// 预生成热门页面
export async function generateStaticParams() {
  const popularProducts = await db.product.findMany({
    where: { views: { gt: 1000 } },
    select: { id: true },
    take: 100,
  });
  return popularProducts.map((p) => ({ id: p.id }));
}

// 未预生成的页面按需生成
export const dynamicParams = true; // 允许动态参数

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
```

## 检查清单

- [ ] 默认使用服务端组件，仅交互部分标记 'use client'
- [ ] 数据变更使用 Server Actions + revalidateTag
- [ ] 页面使用 Suspense 实现流式渲染
- [ ] 缓存策略明确：revalidate 时间或 tags
- [ ] 中间件处理认证、重定向等横切逻辑
- [ ] 动态路由使用 generateStaticParams 预生成
- [ ] 每个页面有适当的 Metadata（SEO）
- [ ] 图片使用 next/image 自动优化
- [ ] 敏感操作（数据库、密钥）只在服务端执行
- [ ] 错误页面 (error.tsx) 和加载页面 (loading.tsx) 完备
