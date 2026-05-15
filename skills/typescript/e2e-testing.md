---
name: e2e-testing
type: capability
package: typescript
description: 使用 Playwright 进行端到端测试，涵盖测试结构、选择器策略、断言、网络模拟、认证状态与 CI 配置。
---

# E2E 测试（Playwright）

## 核心原则

1. **用户视角** — 测试用户行为而非实现细节
2. **稳定选择器** — 优先使用 data-testid 和 role，避免脆弱的 CSS 选择器
3. **隔离性** — 每个测试独立，不依赖其他测试的状态
4. **可调试** — 失败时有截图、trace、清晰的错误信息

## 测试结构

```typescript
import { test, expect } from '@playwright/test';

// 测试套件
test.describe('用户登录流程', () => {
  // 每个测试前的准备
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('使用有效凭据登录成功', async ({ page }) => {
    await page.getByLabel('邮箱').fill('user@example.com');
    await page.getByLabel('密码').fill('password123');
    await page.getByRole('button', { name: '登录' }).click();

    // 验证跳转到仪表盘
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  });

  test('无效凭据显示错误信息', async ({ page }) => {
    await page.getByLabel('邮箱').fill('wrong@example.com');
    await page.getByLabel('密码').fill('wrongpass');
    await page.getByRole('button', { name: '登录' }).click();

    await expect(page.getByRole('alert')).toContainText('邮箱或密码错误');
    await expect(page).toHaveURL('/login'); // 停留在登录页
  });
});
```

## Page Object 模式

```typescript
// page-objects/login.page.ts
export class LoginPage {
  constructor(private readonly page: Page) {}

  // 定位器 — 延迟求值
  private get emailInput() { return this.page.getByLabel('邮箱'); }
  private get passwordInput() { return this.page.getByLabel('密码'); }
  private get submitButton() { return this.page.getByRole('button', { name: '登录' }); }
  private get errorAlert() { return this.page.getByRole('alert'); }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message: string) {
    await expect(this.errorAlert).toContainText(message);
  }
}

// page-objects/dashboard.page.ts
export class DashboardPage {
  constructor(private readonly page: Page) {}

  get heading() { return this.page.getByRole('heading', { level: 1 }); }
  get userMenu() { return this.page.getByTestId('user-menu'); }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.page).toHaveURL(/\/dashboard/);
  }
}

// 在测试中使用
test('登录后跳转到仪表盘', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const dashboard = new DashboardPage(page);

  await loginPage.goto();
  await loginPage.login('user@example.com', 'password123');
  await dashboard.expectLoaded();
});
```

## 选择器策略

```typescript
// ✅ 推荐 — 按优先级排序

// 1. Role-based（最佳 — 反映无障碍语义）
page.getByRole('button', { name: '提交' });
page.getByRole('heading', { name: '用户列表' });
page.getByRole('link', { name: '首页' });
page.getByRole('textbox', { name: '搜索' });

// 2. Label（表单元素）
page.getByLabel('用户名');
page.getByPlaceholder('请输入搜索关键词');

// 3. Text（可见文本）
page.getByText('暂无数据');
page.getByText(/共 \d+ 条/);

// 4. Test ID（无语义时的后备方案）
page.getByTestId('user-avatar');
page.getByTestId('sidebar-nav');

// ❌ 避免 — 脆弱选择器
page.locator('.btn-primary'); // CSS 类名可能变化
page.locator('#submit-btn'); // ID 可能重构
page.locator('div > span:nth-child(2)'); // 结构依赖
```

## 断言

```typescript
// 页面断言
await expect(page).toHaveURL('/dashboard');
await expect(page).toHaveTitle(/仪表盘/);

// 元素断言
await expect(page.getByRole('button')).toBeEnabled();
await expect(page.getByRole('button')).toBeDisabled();
await expect(page.getByTestId('modal')).toBeVisible();
await expect(page.getByTestId('modal')).toBeHidden();
await expect(page.getByRole('textbox')).toHaveValue('hello');
await expect(page.getByRole('list')).toHaveCount(5);

// 文本断言
await expect(page.getByTestId('status')).toHaveText('已完成');
await expect(page.getByTestId('message')).toContainText('成功');

// CSS 断言
await expect(page.getByTestId('card')).toHaveClass(/active/);
await expect(page.getByTestId('box')).toHaveCSS('color', 'rgb(255, 0, 0)');

// 软断言 — 不中断测试，收集所有失败
await expect.soft(page.getByTestId('name')).toHaveText('Alice');
await expect.soft(page.getByTestId('email')).toHaveText('alice@test.com');
```

## 导航与等待

```typescript
// 等待导航完成
await page.getByRole('link', { name: '详情' }).click();
await page.waitForURL('/detail/**');

// 等待网络请求完成
const responsePromise = page.waitForResponse('**/api/users');
await page.getByRole('button', { name: '加载' }).click();
const response = await responsePromise;
expect(response.status()).toBe(200);

// 等待元素状态
await page.getByTestId('loading').waitFor({ state: 'hidden' });
await page.getByTestId('content').waitFor({ state: 'visible' });

// 等待多个条件
await Promise.all([
  page.waitForResponse('**/api/data'),
  page.getByRole('button', { name: '刷新' }).click(),
]);
```

## 网络模拟

```typescript
// 拦截 API 请求并返回模拟数据
test('显示用户列表', async ({ page }) => {
  // 模拟 API 响应
  await page.route('**/api/users', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: '1', name: 'Alice', email: 'alice@test.com' },
        { id: '2', name: 'Bob', email: 'bob@test.com' },
      ]),
    });
  });

  await page.goto('/users');
  await expect(page.getByRole('listitem')).toHaveCount(2);
});

// 模拟网络错误
test('API 失败时显示错误提示', async ({ page }) => {
  await page.route('**/api/users', (route) =>
    route.fulfill({ status: 500, body: 'Internal Server Error' }),
  );

  await page.goto('/users');
  await expect(page.getByRole('alert')).toContainText('加载失败');
});

// 延迟响应 — 测试加载状态
test('加载中显示骨架屏', async ({ page }) => {
  await page.route('**/api/data', async (route) => {
    await new Promise((r) => setTimeout(r, 2000));
    await route.fulfill({ status: 200, body: '{}' });
  });

  await page.goto('/data');
  await expect(page.getByTestId('skeleton')).toBeVisible();
});
```

## 认证状态

```typescript
// 全局 setup — 保存认证状态
// global-setup.ts
import { chromium } from '@playwright/test';

async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('/login');
  await page.getByLabel('邮箱').fill('admin@test.com');
  await page.getByLabel('密码').fill('admin123');
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL('/dashboard');

  // 保存认证状态
  await page.context().storageState({ path: '.auth/admin.json' });
  await browser.close();
}

export default globalSetup;

// playwright.config.ts
export default defineConfig({
  globalSetup: './global-setup.ts',
  projects: [
    // 无认证的测试
    { name: 'public', testMatch: /.*\.public\.spec\.ts/ },
    // 已认证的测试
    {
      name: 'authenticated',
      testMatch: /.*\.auth\.spec\.ts/,
      use: { storageState: '.auth/admin.json' },
    },
  ],
});
```

## 视觉回归

```typescript
// 截图对比
test('首页视觉回归', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixelRatio: 0.01, // 允许 1% 差异
  });
});

// 组件级截图
test('按钮各状态视觉', async ({ page }) => {
  await page.goto('/components/button');

  const button = page.getByTestId('primary-button');
  await expect(button).toHaveScreenshot('button-default.png');

  await button.hover();
  await expect(button).toHaveScreenshot('button-hover.png');
});

// 全页面截图（含滚动）
test('长页面完整截图', async ({ page }) => {
  await page.goto('/long-page');
  await expect(page).toHaveScreenshot('long-page.png', {
    fullPage: true,
  });
});
```

## 并行执行与 CI 配置

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true, // 测试文件间并行
  forbidOnly: !!process.env.CI, // CI 中禁止 .only
  retries: process.env.CI ? 2 : 0, // CI 中失败重试
  workers: process.env.CI ? 4 : undefined, // CI 中限制并发

  reporter: [
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry', // 首次重试时记录 trace
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],

  // 启动开发服务器
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

## 调试

```typescript
// 使用 trace viewer 调试
// 运行: npx playwright test --trace on
// 查看: npx playwright show-trace trace.zip

// 暂停执行 — 打开 Inspector
test('调试测试', async ({ page }) => {
  await page.goto('/');
  await page.pause(); // 打开 Playwright Inspector
  // 在 Inspector 中逐步执行
});

// 慢动作模式
// 运行: npx playwright test --headed --slowmo=500

// 失败时自动截图（已在配置中启用）
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('failure-screenshot', {
      body: screenshot,
      contentType: 'image/png',
    });
  }
});
```

## 检查清单

- [ ] 使用 Page Object 模式封装页面交互
- [ ] 选择器优先使用 role > label > testid，避免 CSS/XPath
- [ ] 每个测试独立，不依赖执行顺序
- [ ] API 请求通过 route 拦截模拟，测试不依赖真实后端
- [ ] 认证状态通过 storageState 复用，避免重复登录
- [ ] CI 配置包含重试、trace、截图
- [ ] 关键页面有视觉回归测试
- [ ] 测试覆盖多浏览器和移动端视口
- [ ] 使用 webServer 配置自动启动开发服务器
- [ ] 失败测试有足够的调试信息（截图、trace、视频）
