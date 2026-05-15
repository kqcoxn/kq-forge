---
name: frontend-patterns
type: capability
package: typescript
description: React/Next.js 前端开发模式，涵盖组件组合、自定义 Hook、状态管理、性能优化、表单处理与无障碍访问。
---

# 前端开发模式

## 核心原则

1. **组合优于继承** — 通过组合小组件构建复杂 UI
2. **状态最小化** — 只存储必要状态，派生值用计算得出
3. **性能有意识** — 避免不必要的重渲染，按需优化
4. **无障碍优先** — 键盘可操作、屏幕阅读器友好

## 组件组合模式

### 复合组件

```tsx
// 复合组件 — 共享隐式状态
interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('必须在 Tabs 内使用');
  return ctx;
}

function Tabs({ defaultTab, children }: { defaultTab: string; children: ReactNode }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div role="tablist">{children}</div>
    </TabsContext.Provider>
  );
}

function TabTrigger({ id, children }: { id: string; children: ReactNode }) {
  const { activeTab, setActiveTab } = useTabsContext();
  return (
    <button
      role="tab"
      aria-selected={activeTab === id}
      onClick={() => setActiveTab(id)}
    >
      {children}
    </button>
  );
}

function TabContent({ id, children }: { id: string; children: ReactNode }) {
  const { activeTab } = useTabsContext();
  if (activeTab !== id) return null;
  return <div role="tabpanel">{children}</div>;
}

// 使用
<Tabs defaultTab="profile">
  <TabTrigger id="profile">个人资料</TabTrigger>
  <TabTrigger id="settings">设置</TabTrigger>
  <TabContent id="profile"><ProfilePanel /></TabContent>
  <TabContent id="settings"><SettingsPanel /></TabContent>
</Tabs>
```

### Render Props

```tsx
interface DataListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  renderEmpty?: () => ReactNode;
}

function DataList<T>({ items, renderItem, renderEmpty }: DataListProps<T>) {
  if (items.length === 0) return renderEmpty?.() ?? <p>暂无数据</p>;
  return <ul>{items.map((item, i) => <li key={i}>{renderItem(item, i)}</li>)}</ul>;
}
```

## 自定义 Hook

```tsx
// 防抖 Hook
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// 数据请求 Hook
interface UseQueryResult<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  refetch: () => void;
}

function useQuery<T>(key: string, fetcher: () => Promise<T>): UseQueryResult<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await fetcher();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [fetcher]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, error, isLoading, refetch: fetch };
}
```

## 状态管理

### Context + Reducer（中小规模）

```tsx
type AuthAction =
  | { type: 'LOGIN'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_PROFILE'; payload: Partial<User> };

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN':
      return { user: action.payload, isAuthenticated: true };
    case 'LOGOUT':
      return { user: null, isAuthenticated: false };
    case 'UPDATE_PROFILE':
      return { ...state, user: state.user ? { ...state.user, ...action.payload } : null };
  }
}
```

### Zustand（大规模）

```tsx
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  total: () => number;
}

const useCartStore = create<CartStore>()(
  devtools(
    persist(
      (set, get) => ({
        items: [],
        addItem: (item) => set((s) => ({ items: [...s.items, item] })),
        removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
        total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      }),
      { name: 'cart-storage' },
    ),
  ),
);
```

## 性能优化

```tsx
// React.memo — 避免父组件重渲染导致子组件不必要更新
const ExpensiveList = memo(function ExpensiveList({ items }: { items: Item[] }) {
  return <ul>{items.map((item) => <ListItem key={item.id} item={item} />)}</ul>;
});

// useMemo — 缓存昂贵计算
function Dashboard({ transactions }: { transactions: Transaction[] }) {
  const summary = useMemo(
    () => computeExpensiveSummary(transactions),
    [transactions],
  );
  return <SummaryChart data={summary} />;
}

// useCallback — 稳定回调引用
function SearchPage() {
  const [query, setQuery] = useState('');
  const handleSearch = useCallback(
    (term: string) => { setQuery(term); },
    [],
  );
  return <SearchInput onSearch={handleSearch} />;
}

// 懒加载 — 按需加载重型组件
const HeavyEditor = lazy(() => import('./HeavyEditor'));

function EditorPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <HeavyEditor />
    </Suspense>
  );
}
```

## 表单处理

```tsx
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
  password: z.string().min(8, '密码至少8位'),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginPage() {
  const [form, setForm] = useState<LoginForm>({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginForm, string>>>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const result = loginSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof LoginForm;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    // 提交表单
    submitLogin(result.data);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor="email">邮箱</label>
      <input
        id="email"
        type="email"
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        aria-invalid={!!errors.email}
        aria-describedby={errors.email ? 'email-error' : undefined}
      />
      {errors.email && <span id="email-error" role="alert">{errors.email}</span>}
      <button type="submit">登录</button>
    </form>
  );
}
```

## 错误边界

```tsx
interface ErrorBoundaryProps {
  fallback: (error: Error, reset: () => void) => ReactNode;
  children: ReactNode;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error, this.reset);
    }
    return this.props.children;
  }
}

// 使用
<ErrorBoundary fallback={(err, reset) => (
  <div role="alert">
    <p>出错了：{err.message}</p>
    <button onClick={reset}>重试</button>
  </div>
)}>
  <App />
</ErrorBoundary>
```

## 无障碍访问

```tsx
// 键盘导航 — 列表项焦点管理
function MenuList({ items }: { items: MenuItem[] }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === 'ArrowDown') next = Math.min(index + 1, items.length - 1);
    if (e.key === 'ArrowUp') next = Math.max(index - 1, 0);
    if (next !== index) {
      e.preventDefault();
      refs.current[next]?.focus();
    }
  };

  return (
    <ul role="menu">
      {items.map((item, i) => (
        <li key={item.id} role="menuitem">
          <button
            ref={(el) => { refs.current[i] = el; }}
            onKeyDown={(e) => handleKeyDown(e, i)}
            aria-label={item.label}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

## 检查清单

- [ ] 复杂 UI 使用复合组件模式拆分
- [ ] 可复用逻辑提取为自定义 Hook
- [ ] 列表渲染使用稳定的 key（非 index）
- [ ] 昂贵计算使用 useMemo，回调使用 useCallback
- [ ] 大型组件使用 lazy + Suspense 懒加载
- [ ] 表单有客户端验证（Zod）和无障碍错误提示
- [ ] 所有交互元素可键盘操作
- [ ] 使用 role、aria-label、aria-describedby 等 ARIA 属性
- [ ] 错误边界包裹关键 UI 区域
- [ ] 状态管理方案与应用规模匹配
