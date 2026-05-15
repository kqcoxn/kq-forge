---
name: responsive-ui
type: capability
package: frontend-ui
description: 响应式 UI 开发，涵盖移动优先策略、断点设计、流式排版、容器查询、响应式图片、触摸目标、视口单位与 CSS Grid/Flexbox 响应式布局模式。
---

# 响应式 UI 开发指南

## 核心原则

1. **移动优先** — 从最小屏幕开始设计，逐步增强到大屏
2. **内容驱动断点** — 断点由内容需要决定，而非设备尺寸
3. **流式布局** — 使用相对单位和弹性布局，避免固定像素
4. **渐进增强** — 基础功能在所有设备可用，大屏提供增强体验
5. **触摸友好** — 交互目标足够大，间距足够宽

## 移动优先策略

```css
/* 移动优先：基础样式为移动端，通过 min-width 向上增强 */
.container {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 平板及以上 */
@media (min-width: 768px) {
  .container {
    padding: 2rem;
    flex-direction: row;
    gap: 2rem;
  }
}

/* 桌面 */
@media (min-width: 1024px) {
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 3rem;
  }
}

/* 反模式：桌面优先（使用 max-width 向下适配） */
/* 这会导致移动端加载不必要的样式覆盖 */
```

## 断点策略

```css
/* 推荐断点（基于常见内容需求） */
:root {
  --bp-sm: 640px;    /* 大手机横屏 */
  --bp-md: 768px;    /* 平板竖屏 */
  --bp-lg: 1024px;   /* 平板横屏/小笔记本 */
  --bp-xl: 1280px;   /* 桌面 */
  --bp-2xl: 1536px;  /* 大屏桌面 */
}

/* Tailwind 断点使用 */
/* sm:flex-row md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 */

/* 自定义断点：当内容"断裂"时添加 */
@media (min-width: 520px) {
  /* 卡片从单列变为双列的最佳断点 */
  .card-grid { grid-template-columns: repeat(2, 1fr); }
}
```

## 流式排版（Fluid Typography）

```css
/* clamp() 实现流式字体大小 */
/* clamp(最小值, 首选值, 最大值) */
:root {
  --font-size-body: clamp(1rem, 0.9rem + 0.5vw, 1.125rem);
  --font-size-h1: clamp(2rem, 1.5rem + 2.5vw, 3.5rem);
  --font-size-h2: clamp(1.5rem, 1.2rem + 1.5vw, 2.5rem);
}

body {
  font-size: var(--font-size-body);
  line-height: 1.6;
}

h1 { font-size: var(--font-size-h1); }
h2 { font-size: var(--font-size-h2); }

/* 流式间距 */
.section {
  padding-block: clamp(2rem, 5vw, 6rem);
}

/* 流式容器宽度 */
.content {
  width: min(90%, 70ch);  /* 最大 70 字符宽度，适合阅读 */
  margin-inline: auto;
}
```

## 容器查询

```css
/* 容器查询：基于父容器尺寸而非视口 */
.card-wrapper {
  container-type: inline-size;
  container-name: card;
}

/* 容器宽度 < 400px：垂直布局 */
.card {
  display: flex;
  flex-direction: column;
}

/* 容器宽度 ≥ 400px：水平布局 */
@container card (min-width: 400px) {
  .card {
    flex-direction: row;
    align-items: center;
  }
  .card-image {
    width: 40%;
    flex-shrink: 0;
  }
}

/* 容器查询单位 */
@container card (min-width: 600px) {
  .card-title {
    font-size: 3cqi;  /* 容器内联尺寸的 3% */
  }
}
```

## 响应式图片

```html
<!-- srcset + sizes：浏览器选择最佳尺寸 -->
<img
  srcset="
    photo-400.jpg 400w,
    photo-800.jpg 800w,
    photo-1200.jpg 1200w,
    photo-1600.jpg 1600w
  "
  sizes="
    (max-width: 640px) 100vw,
    (max-width: 1024px) 50vw,
    33vw
  "
  src="photo-800.jpg"
  alt="产品展示图"
  loading="lazy"
  decoding="async"
>

<!-- picture 元素：艺术指导（不同裁剪） -->
<picture>
  <!-- 移动端：正方形裁剪 -->
  <source media="(max-width: 640px)" srcset="hero-square.webp">
  <!-- 平板：16:9 裁剪 -->
  <source media="(max-width: 1024px)" srcset="hero-wide.webp">
  <!-- 桌面：超宽裁剪 -->
  <source srcset="hero-ultrawide.webp">
  <img src="hero-wide.jpg" alt="...">
</picture>

<!-- 背景图响应式 -->
<style>
.hero {
  background-image: image-set(
    url("hero-1x.webp") 1x,
    url("hero-2x.webp") 2x
  );
  background-size: cover;
  aspect-ratio: 16 / 9;
}
</style>
```

## 触摸目标

```css
/* WCAG 2.5.8：触摸目标最小 24x24px，推荐 44x44px */
.touch-target {
  min-width: 44px;
  min-height: 44px;
  padding: 12px;
}

/* 紧凑列表中的触摸目标 */
.list-item {
  min-height: 48px;
  display: flex;
  align-items: center;
  padding: 8px 16px;
}

/* 图标按钮：视觉小但点击区域大 */
.icon-button {
  position: relative;
  width: 24px;
  height: 24px;
}
.icon-button::after {
  content: '';
  position: absolute;
  inset: -10px;  /* 扩大点击区域 */
}

/* 相邻触摸目标间距 ≥ 8px */
.button-group {
  display: flex;
  gap: 8px;
}
```

## 视口单位

```css
/* 现代视口单位（解决移动端地址栏问题） */
.full-height {
  /* 旧方案：100vh 在移动端不准确 */
  height: 100vh;
  /* 新方案：动态视口高度 */
  height: 100dvh;
}

/* svh：最小视口高度（地址栏展开时） */
/* lvh：最大视口高度（地址栏收起时） */
/* dvh：动态视口高度（跟随地址栏变化） */

.hero-section {
  min-height: 100svh;  /* 保证内容不被地址栏遮挡 */
}

/* 视口单位用于间距 */
.section-spacing {
  padding-block: max(2rem, 5vh);
}
```

## CSS Grid 响应式布局

```css
/* 自适应网格：无需媒体查询 */
.auto-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  gap: 1.5rem;
}

/* 圣杯布局 */
.page-layout {
  display: grid;
  grid-template-areas:
    "header"
    "main"
    "sidebar"
    "footer";
  gap: 1rem;
}

@media (min-width: 768px) {
  .page-layout {
    grid-template-columns: 250px 1fr;
    grid-template-areas:
      "header header"
      "sidebar main"
      "footer footer";
  }
}

/* Flexbox 响应式：自动换行 */
.flex-wrap-layout {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
.flex-wrap-layout > * {
  flex: 1 1 300px;  /* 最小 300px，自动换行 */
}

/* Subgrid：子元素对齐父网格 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}
.card {
  display: grid;
  grid-template-rows: subgrid;
  grid-row: span 3;  /* 标题 + 内容 + 操作 */
}
```

## 检查清单

- [ ] 采用移动优先策略，基础样式为移动端
- [ ] 断点由内容需求决定，非固定设备尺寸
- [ ] 字体使用 `clamp()` 实现流式缩放
- [ ] 容器查询用于组件级响应式（非页面级）
- [ ] 图片使用 `srcset` + `sizes` 提供多尺寸
- [ ] 触摸目标 ≥ 44x44px，相邻间距 ≥ 8px
- [ ] 使用 `dvh` 替代 `vh` 处理移动端视口
- [ ] Grid 使用 `auto-fit` + `minmax` 实现无断点自适应
- [ ] 在真实设备上测试（非仅浏览器模拟器）
- [ ] 横屏模式下布局正常，无内容溢出
