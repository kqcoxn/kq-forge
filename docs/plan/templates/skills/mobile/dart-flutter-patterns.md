---
name: dart-flutter-patterns
type: capability
package: mobile
description: Flutter/Dart 开发模式，涵盖 Widget 组合、状态管理（Riverpod/Bloc）、路由、主题、平台适配、测试与性能优化。
---

# Dart/Flutter 开发模式

## 核心原则

1. **一切皆 Widget** — 通过组合小 Widget 构建复杂 UI
2. **不可变 Widget 树** — Widget 是配置描述，Framework 负责高效更新
3. **声明式状态管理** — 状态变化自动触发 UI 重建
4. **平台自适应** — 一套代码适配 iOS/Android 的视觉差异
5. **const 优先** — 编译期常量 Widget 跳过重建，提升性能

## Widget 组合

```dart
// 提取小 Widget，保持 build 方法简洁
class UserCard extends StatelessWidget {
  const UserCard({super.key, required this.user});
  final User user;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(backgroundImage: NetworkImage(user.avatarUrl)),
        title: Text(user.name),
        subtitle: Text(user.email),
        trailing: const Icon(Icons.chevron_right),
      ),
    );
  }
}

// 使用 const 构造函数优化性能
class AppHeader extends StatelessWidget {
  const AppHeader({super.key, required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),  // const 避免重复分配
      child: Text(title, style: Theme.of(context).textTheme.headlineMedium),
    );
  }
}
```

## 状态管理 — Riverpod

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

// 简单状态 Provider
final counterProvider = StateProvider<int>((ref) => 0);

// 异步数据 Provider
final userListProvider = FutureProvider<List<User>>((ref) async {
  final api = ref.watch(apiClientProvider);
  return api.fetchUsers();
});

// Notifier：复杂状态逻辑
class TodoNotifier extends AsyncNotifier<List<Todo>> {
  @override
  Future<List<Todo>> build() async {
    return ref.watch(todoRepositoryProvider).fetchAll();
  }

  Future<void> addTodo(String title) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final repo = ref.read(todoRepositoryProvider);
      await repo.create(Todo(title: title));
      return repo.fetchAll();
    });
  }

  Future<void> toggle(String id) async {
    final todos = state.valueOrNull ?? [];
    final updated = todos.map((t) =>
      t.id == id ? t.copyWith(completed: !t.completed) : t
    ).toList();
    state = AsyncData(updated);
    await ref.read(todoRepositoryProvider).update(id);
  }
}

final todoProvider = AsyncNotifierProvider<TodoNotifier, List<Todo>>(TodoNotifier.new);

// 在 Widget 中消费
class TodoListPage extends ConsumerWidget {
  const TodoListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final todosAsync = ref.watch(todoProvider);

    return todosAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('错误: $e')),
      data: (todos) => ListView.builder(
        itemCount: todos.length,
        itemBuilder: (_, i) => TodoTile(todo: todos[i]),
      ),
    );
  }
}
```

## 状态管理 — Bloc

```dart
import 'package:flutter_bloc/flutter_bloc.dart';

// Events
sealed class AuthEvent {}
class LoginRequested extends AuthEvent {
  final String email, password;
  LoginRequested({required this.email, required this.password});
}
class LogoutRequested extends AuthEvent {}

// States
sealed class AuthState {}
class AuthInitial extends AuthState {}
class AuthLoading extends AuthState {}
class AuthSuccess extends AuthState { final User user; AuthSuccess(this.user); }
class AuthFailure extends AuthState { final String message; AuthFailure(this.message); }

// Bloc
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final AuthRepository _repo;

  AuthBloc(this._repo) : super(AuthInitial()) {
    on<LoginRequested>(_onLogin);
    on<LogoutRequested>(_onLogout);
  }

  Future<void> _onLogin(LoginRequested event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    try {
      final user = await _repo.login(event.email, event.password);
      emit(AuthSuccess(user));
    } catch (e) {
      emit(AuthFailure(e.toString()));
    }
  }

  Future<void> _onLogout(LogoutRequested event, Emitter<AuthState> emit) async {
    await _repo.logout();
    emit(AuthInitial());
  }
}
```

## 路由（GoRouter）

```dart
import 'package:go_router/go_router.dart';

final router = GoRouter(
  initialLocation: '/',
  redirect: (context, state) {
    final isLoggedIn = authNotifier.isAuthenticated;
    if (!isLoggedIn && !state.matchedLocation.startsWith('/login')) {
      return '/login';
    }
    return null;
  },
  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
    ShellRoute(
      builder: (_, __, child) => AppShell(child: child),
      routes: [
        GoRoute(path: '/', builder: (_, __) => const HomePage()),
        GoRoute(
          path: '/users/:id',
          builder: (_, state) => UserDetailPage(
            userId: state.pathParameters['id']!,
          ),
        ),
      ],
    ),
  ],
);
```

## 主题系统

```dart
class AppTheme {
  static ThemeData light() => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: const Color(0xFF1A73E8),
      brightness: Brightness.light,
    ),
    textTheme: _textTheme,
    cardTheme: const CardTheme(elevation: 2, margin: EdgeInsets.all(8)),
    inputDecorationTheme: const InputDecorationTheme(
      border: OutlineInputBorder(),
      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    ),
  );

  static ThemeData dark() => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: const Color(0xFF1A73E8),
      brightness: Brightness.dark,
    ),
    textTheme: _textTheme,
  );

  static const _textTheme = TextTheme(
    headlineLarge: TextStyle(fontWeight: FontWeight.bold),
  );
}
```

## 测试

```dart
// Widget 测试
testWidgets('点击按钮增加计数', (tester) async {
  await tester.pumpWidget(const MaterialApp(home: CounterPage()));

  expect(find.text('0'), findsOneWidget);
  await tester.tap(find.byIcon(Icons.add));
  await tester.pump();
  expect(find.text('1'), findsOneWidget);
});

// Golden 测试（截图对比）
testWidgets('UserCard 渲染正确', (tester) async {
  await tester.pumpWidget(MaterialApp(
    home: UserCard(user: mockUser),
  ));
  await expectLater(
    find.byType(UserCard),
    matchesGoldenFile('goldens/user_card.png'),
  );
});

// Bloc 测试
blocTest<AuthBloc, AuthState>(
  '登录成功发射 AuthSuccess',
  build: () => AuthBloc(mockRepo),
  act: (bloc) => bloc.add(LoginRequested(email: 'a@b.com', password: '123')),
  expect: () => [isA<AuthLoading>(), isA<AuthSuccess>()],
);
```

## 性能优化

```dart
// 1. const Widget 跳过重建
const SizedBox(height: 16);
const Divider();

// 2. RepaintBoundary 隔离重绘区域
RepaintBoundary(
  child: ComplexAnimatedWidget(),
)

// 3. ListView.builder 懒加载
ListView.builder(
  itemCount: items.length,
  itemBuilder: (_, i) => ItemTile(item: items[i]),
)

// 4. 图片缓存与尺寸限制
Image.network(
  url,
  cacheWidth: 200,  // 解码时限制尺寸，节省内存
  cacheHeight: 200,
)

// 5. 避免在 build 中创建对象
// 反模式：每次 build 创建新 TextStyle
Text('hello', style: TextStyle(fontSize: 16));
// 正确：提取为常量
static const _style = TextStyle(fontSize: 16);
Text('hello', style: _style);
```

## 检查清单

- [ ] Widget 拆分粒度合理，单个 build 方法不超过 40 行
- [ ] 使用 `const` 构造函数标记所有不变 Widget
- [ ] 状态管理方案统一（Riverpod 或 Bloc，不混用）
- [ ] 路由使用 GoRouter，支持深链接和重定向
- [ ] 主题通过 `ThemeData` 统一管理，不硬编码颜色
- [ ] 长列表使用 `ListView.builder` 而非 `Column + children`
- [ ] 复杂动画区域包裹 `RepaintBoundary`
- [ ] Widget 测试覆盖关键交互流程
- [ ] Golden 测试保护视觉回归
- [ ] 平台差异通过 `Platform.isIOS` 或自适应 Widget 处理
