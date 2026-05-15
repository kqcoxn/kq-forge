---
name: accessibility
type: constraint
package: frontend-ui
description: WCAG 2.1 AA 无障碍要求，涵盖语义化 HTML、ARIA 角色/状态/属性、键盘导航、焦点管理、颜色对比度、屏幕阅读器测试与常见违规修复。
---

# 无障碍（Accessibility）规范

## 核心原则

1. **可感知** — 信息和界面组件必须以用户可感知的方式呈现
2. **可操作** — 界面组件和导航必须可操作（键盘、辅助设备）
3. **可理解** — 信息和操作必须可理解
4. **健壮性** — 内容必须能被各种用户代理（包括辅助技术）可靠解析
5. **语义优先** — 优先使用原生 HTML 语义，ARIA 是最后手段

## 语义化 HTML

```html
<!-- 正确：使用语义化标签 -->
<header>
  <nav aria-label="主导航">
    <ul>
      <li><a href="/">首页</a></li>
      <li><a href="/products" aria-current="page">产品</a></li>
    </ul>
  </nav>
</header>

<main>
  <article>
    <h1>产品详情</h1>
    <section aria-labelledby="specs-heading">
      <h2 id="specs-heading">规格参数</h2>
      <!-- 内容 -->
    </section>
  </article>
  <aside aria-label="相关推荐">
    <!-- 侧边栏内容 -->
  </aside>
</main>

<footer>
  <p>&copy; 2024 公司名称</p>
</footer>

<!-- 反模式：div 汤 -->
<div class="header">
  <div class="nav">
    <div class="nav-item" onclick="navigate('/')">首页</div>
  </div>
</div>
```

## ARIA 角色、状态与属性

```html
<!-- 自定义组件必须声明角色和状态 -->

<!-- 标签页 -->
<div role="tablist" aria-label="产品信息">
  <button role="tab" id="tab-1" aria-selected="true" aria-controls="panel-1">
    描述
  </button>
  <button role="tab" id="tab-2" aria-selected="false" aria-controls="panel-2">
    评价
  </button>
</div>
<div role="tabpanel" id="panel-1" aria-labelledby="tab-1">
  <!-- 描述内容 -->
</div>
<div role="tabpanel" id="panel-2" aria-labelledby="tab-2" hidden>
  <!-- 评价内容 -->
</div>

<!-- 模态对话框 -->
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">确认删除</h2>
  <p>此操作不可撤销，确定要删除吗？</p>
  <button>取消</button>
  <button>确认删除</button>
</div>

<!-- 实时区域：动态内容更新通知屏幕阅读器 -->
<div aria-live="polite" aria-atomic="true">
  <!-- 搜索结果数量变化时自动播报 -->
  找到 {{ count }} 条结果
</div>

<!-- 错误提示关联 -->
<label for="email">邮箱</label>
<input id="email" type="email" aria-describedby="email-error" aria-invalid="true">
<span id="email-error" role="alert">请输入有效的邮箱地址</span>
```

## 键盘导航

```html
<!-- 所有交互元素必须可通过键盘操作 -->

<!-- 自定义下拉菜单键盘支持 -->
<script>
// 必须支持的键盘交互：
// Enter/Space — 激活按钮/链接
// Arrow Up/Down — 在列表中移动
// Escape — 关闭弹出层
// Tab — 在焦点元素间移动
// Home/End — 跳到列表首/尾

function handleKeyDown(event) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      focusNextItem();
      break;
    case 'ArrowUp':
      event.preventDefault();
      focusPreviousItem();
      break;
    case 'Escape':
      closeMenu();
      returnFocusToTrigger();
      break;
    case 'Home':
      event.preventDefault();
      focusFirstItem();
      break;
    case 'End':
      event.preventDefault();
      focusLastItem();
      break;
  }
}
</script>

<!-- tabindex 使用规则 -->
<!-- tabindex="0" — 加入自然 Tab 顺序 -->
<!-- tabindex="-1" — 可编程聚焦但不在 Tab 顺序中 -->
<!-- tabindex > 0 — 禁止使用！破坏自然顺序 -->
<div role="button" tabindex="0" onkeydown="handleActivate(event)">
  自定义按钮
</div>
```

## 焦点管理

```javascript
// 模态框打开时：焦点陷阱
function trapFocus(modal) {
  const focusableElements = modal.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), ' +
    'select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  // 打开时聚焦第一个元素
  firstElement.focus();

  modal.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  });
}

// 关闭模态框后：焦点返回触发元素
function closeModal(triggerElement) {
  modal.hidden = true;
  triggerElement.focus();
}

// 路由切换后：焦点移到主内容区
function onRouteChange() {
  const main = document.querySelector('main');
  main.setAttribute('tabindex', '-1');
  main.focus();
}
```

## 颜色对比度

```css
/* WCAG AA 要求：
   - 正文文本：对比度 ≥ 4.5:1
   - 大文本（18px+ bold 或 24px+）：≥ 3:1
   - UI 组件和图形：≥ 3:1
*/

/* 正确：高对比度 */
.text-primary { color: #1a1a1a; }  /* 在白色背景上 15.3:1 */
.text-secondary { color: #595959; }  /* 在白色背景上 7.0:1 */

/* 错误：对比度不足 */
.text-light { color: #999999; }  /* 在白色背景上 2.8:1 ❌ */

/* 不仅依赖颜色传达信息 */
.error-field {
  border-color: #d32f2f;
  border-width: 2px;  /* 加粗边框 */
}
.error-field::before {
  content: "⚠";  /* 图标辅助 */
}

/* 焦点指示器必须可见 */
:focus-visible {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
}
/* 永远不要：*:focus { outline: none; } */
```

## 屏幕阅读器测试

```
测试工具：
- macOS：VoiceOver（内置，Cmd+F5 开启）
- Windows：NVDA（免费）或 JAWS
- 移动端：iOS VoiceOver / Android TalkBack

测试要点：
1. 页面标题是否正确播报
2. 标题层级是否合理（h1 → h2 → h3，不跳级）
3. 图片 alt 文本是否有意义
4. 表单标签是否正确关联
5. 错误提示是否自动播报
6. 动态内容更新是否通知用户
7. 自定义组件角色是否正确
```

## 常见违规与修复

```html
<!-- 违规1：图片缺少 alt -->
<img src="chart.png">
<!-- 修复：信息性图片加描述，装饰性图片用空 alt -->
<img src="chart.png" alt="2024年Q1销售额增长23%的柱状图">
<img src="decorative-line.png" alt="">

<!-- 违规2：表单缺少标签 -->
<input type="text" placeholder="搜索...">
<!-- 修复：使用 label 或 aria-label -->
<label for="search" class="sr-only">搜索</label>
<input id="search" type="text" placeholder="搜索...">

<!-- 违规3：链接文本不明确 -->
<a href="/report">点击这里</a>
<!-- 修复：描述性链接文本 -->
<a href="/report">下载2024年度报告</a>

<!-- 违规4：自动播放媒体 -->
<video autoplay>
<!-- 修复：不自动播放，或提供暂停控制 -->
<video controls>

<!-- 视觉隐藏但屏幕阅读器可读的工具类 -->
<style>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
```

## 检查清单

- [ ] 所有页面可仅通过键盘完成核心操作
- [ ] 焦点顺序合理，焦点指示器始终可见
- [ ] 模态框实现焦点陷阱，关闭后焦点返回
- [ ] 文本对比度 ≥ 4.5:1（AA），UI 组件 ≥ 3:1
- [ ] 所有图片有适当的 alt 属性
- [ ] 表单字段有关联的 label，错误提示有 aria-describedby
- [ ] 动态内容使用 aria-live 通知辅助技术
- [ ] 标题层级正确（h1 → h2 → h3，不跳级）
- [ ] 自动化扫描通过（axe-core / Lighthouse Accessibility）
- [ ] 至少使用一种屏幕阅读器手动测试核心流程
