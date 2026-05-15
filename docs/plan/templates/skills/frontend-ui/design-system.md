---
name: design-system
type: capability
package: frontend-ui
description: 设计系统构建，涵盖 Token 架构（颜色、间距、字体）、组件 API 设计、变体/尺寸 Props 模式、组合模式、主题化（CSS 变量、Tailwind）、文档（Storybook）与版本策略。
---

# 设计系统构建指南

## 核心原则

1. **Token 驱动** — 所有视觉属性通过 Token 定义，不硬编码魔法值
2. **组合优于配置** — 组件通过组合而非大量 props 实现灵活性
3. **一致性** — 统一的 API 模式让开发者形成肌肉记忆
4. **可访问** — 无障碍内建于组件中，使用者无需额外处理
5. **渐进采用** — 支持增量迁移，不要求一次性全量替换

## Token 架构

```css
/* 基础 Token（原始值） */
:root {
  /* 颜色原语 */
  --color-blue-50: #eff6ff;
  --color-blue-100: #dbeafe;
  --color-blue-500: #3b82f6;
  --color-blue-600: #2563eb;
  --color-blue-900: #1e3a5a;

  /* 间距比例尺 */
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */

  /* 字体比例尺 */
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;

  /* 圆角 */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-full: 9999px;

  /* 阴影 */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
}

/* 语义 Token（引用基础 Token） */
:root {
  --color-primary: var(--color-blue-600);
  --color-primary-hover: var(--color-blue-700);
  --color-text: var(--color-gray-900);
  --color-text-muted: var(--color-gray-500);
  --color-border: var(--color-gray-200);
  --color-surface: var(--color-white);
  --color-error: var(--color-red-600);
  --color-success: var(--color-green-600);
}

/* 暗色主题：覆盖语义 Token */
[data-theme="dark"] {
  --color-text: var(--color-gray-100);
  --color-text-muted: var(--color-gray-400);
  --color-border: var(--color-gray-700);
  --color-surface: var(--color-gray-900);
}
```

## 组件 API 设计

```tsx
// 统一的 Props 模式：variant + size + 其他
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
  asChild?: boolean;  // 支持 Slot 模式
}

// 实现：使用 cva（class-variance-authority）管理变体
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  // 基础样式
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary-hover',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export function Button({ variant, size, loading, children, ...props }: ButtonProps) {
  return (
    <button className={buttonVariants({ variant, size })} {...props}>
      {loading && <Spinner className="mr-2" />}
      {children}
    </button>
  );
}
```

## 组合模式

```tsx
// 复合组件模式：灵活的组合 API
// 使用方式：
// <Card>
//   <Card.Header>
//     <Card.Title>标题</Card.Title>
//     <Card.Description>描述</Card.Description>
//   </Card.Header>
//   <Card.Content>内容</Card.Content>
//   <Card.Footer>操作</Card.Footer>
// </Card>

const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-lg border bg-surface shadow-sm', className)} {...props} />
);

const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
);

const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-2xl font-semibold', className)} {...props} />
);

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Content = CardContent;
Card.Footer = CardFooter;

// Slot 模式：允许自定义根元素
// <Button asChild><a href="/login">登录</a></Button>
import { Slot } from '@radix-ui/react-slot';

export function Button({ asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp {...props} />;
}
```

## Tailwind 主题配置

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(var(--color-primary))',
          foreground: 'hsl(var(--color-primary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--color-destructive))',
          foreground: 'hsl(var(--color-destructive-foreground))',
        },
        border: 'hsl(var(--color-border))',
        ring: 'hsl(var(--color-ring))',
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
      },
      spacing: {
        // 使用 Token 变量
      },
    },
  },
};
```

## Storybook 文档

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'destructive'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { children: '主要按钮', variant: 'primary' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
    </div>
  ),
};

export const Loading: Story = {
  args: { children: '提交中...', loading: true },
};
```

## 版本策略

```
语义化版本：MAJOR.MINOR.PATCH

MAJOR（破坏性变更）：
- 移除组件或 prop
- 修改默认行为
- Token 重命名

MINOR（向后兼容新功能）：
- 新增组件
- 新增 prop/variant
- 新增 Token

PATCH（修复）：
- Bug 修复
- 样式微调
- 文档更新

变更日志格式：
## [2.1.0] - 2024-03-15
### Added
- Button 新增 `loading` prop
- 新增 Skeleton 组件
### Fixed
- Dialog 焦点陷阱在 Safari 中的问题
```

## 检查清单

- [ ] Token 分层：基础 Token → 语义 Token → 组件 Token
- [ ] 所有颜色、间距、字体通过 Token 引用，无硬编码值
- [ ] 组件 API 统一：`variant` + `size` + `asChild` 模式
- [ ] 复合组件使用组合模式而非大量 props
- [ ] 暗色主题通过覆盖语义 Token 实现
- [ ] 每个组件有 Storybook 文档和交互示例
- [ ] 组件内建无障碍支持（ARIA、键盘导航）
- [ ] 版本遵循语义化版本规范
- [ ] 变更日志记录所有用户可见的变更
- [ ] 提供迁移指南（MAJOR 版本升级时）
