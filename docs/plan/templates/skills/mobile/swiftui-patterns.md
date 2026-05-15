---
name: swiftui-patterns
type: capability
package: mobile
description: SwiftUI 视图组合、状态管理、MVVM 架构、导航、异步数据加载、动画与无障碍修饰符的最佳实践。
---

# SwiftUI 开发模式

## 核心原则

1. **声明式 UI** — 描述"是什么"而非"怎么做"，状态驱动视图更新
2. **单一数据源** — 每个状态只有一个所有者，通过绑定传递
3. **组合优于继承** — 小视图组合成复杂界面，每个视图职责单一
4. **值类型优先** — View 是 struct，轻量且无引用语义问题
5. **无障碍内建** — 从设计阶段就考虑 VoiceOver 和动态字体

## 状态管理

```swift
import SwiftUI

// @State：视图私有的简单状态
struct CounterView: View {
    @State private var count = 0

    var body: some View {
        Button("计数: \(count)") {
            count += 1
        }
    }
}

// @Binding：子视图修改父视图状态
struct ToggleRow: View {
    let title: String
    @Binding var isOn: Bool

    var body: some View {
        Toggle(title, isOn: $isOn)
    }
}

// @Observable（iOS 17+）：替代 ObservableObject
@Observable
class UserViewModel {
    var name = ""
    var email = ""
    var isLoading = false
    private(set) var errorMessage: String?

    func loadProfile() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let profile = try await api.fetchProfile()
            name = profile.name
            email = profile.email
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// 在视图中使用
struct ProfileView: View {
    @State private var viewModel = UserViewModel()

    var body: some View {
        Form {
            if viewModel.isLoading {
                ProgressView()
            } else {
                TextField("姓名", text: $viewModel.name)
                TextField("邮箱", text: $viewModel.email)
            }
        }
        .task { await viewModel.loadProfile() }
    }
}

// @Environment：全局共享状态
@Observable
class AppSettings {
    var theme: Theme = .system
    var language: Language = .chinese
}

struct RootView: View {
    @State private var settings = AppSettings()

    var body: some View {
        ContentView()
            .environment(settings)
    }
}

struct ContentView: View {
    @Environment(AppSettings.self) private var settings
    // ...
}
```

## MVVM 架构

```swift
// Model：纯数据
struct Todo: Identifiable, Codable {
    let id: UUID
    var title: String
    var isCompleted: Bool
    let createdAt: Date
}

// ViewModel：业务逻辑与状态
@Observable
class TodoListViewModel {
    private let repository: TodoRepository
    var todos: [Todo] = []
    var filter: Filter = .all

    enum Filter { case all, active, completed }

    var filteredTodos: [Todo] {
        switch filter {
        case .all: return todos
        case .active: return todos.filter { !$0.isCompleted }
        case .completed: return todos.filter { $0.isCompleted }
        }
    }

    init(repository: TodoRepository = .shared) {
        self.repository = repository
    }

    func addTodo(_ title: String) async throws {
        let todo = Todo(id: UUID(), title: title, isCompleted: false, createdAt: .now)
        try await repository.save(todo)
        todos.append(todo)
    }

    func toggleCompletion(_ todo: Todo) async throws {
        guard let index = todos.firstIndex(where: { $0.id == todo.id }) else { return }
        todos[index].isCompleted.toggle()
        try await repository.save(todos[index])
    }
}

// View：纯展示
struct TodoListView: View {
    @State private var viewModel = TodoListViewModel()
    @State private var newTitle = ""

    var body: some View {
        NavigationStack {
            List {
                ForEach(viewModel.filteredTodos) { todo in
                    TodoRow(todo: todo) {
                        try? await viewModel.toggleCompletion(todo)
                    }
                }
            }
            .navigationTitle("待办事项")
            .toolbar {
                Picker("筛选", selection: $viewModel.filter) {
                    Text("全部").tag(TodoListViewModel.Filter.all)
                    Text("进行中").tag(TodoListViewModel.Filter.active)
                    Text("已完成").tag(TodoListViewModel.Filter.completed)
                }
            }
        }
    }
}
```

## 导航（NavigationStack）

```swift
// 类型安全导航
struct AppNavigation: View {
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            HomeView(path: $path)
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .profile(let userId):
                        ProfileView(userId: userId)
                    case .settings:
                        SettingsView()
                    case .detail(let item):
                        DetailView(item: item)
                    }
                }
        }
    }
}

enum Route: Hashable {
    case profile(userId: String)
    case settings
    case detail(item: Item)
}
```

## 异步数据加载

```swift
struct UserListView: View {
    @State private var users: [User] = []
    @State private var phase: LoadingPhase = .idle

    enum LoadingPhase { case idle, loading, loaded, error(Error) }

    var body: some View {
        Group {
            switch phase {
            case .idle, .loading:
                ProgressView("加载中...")
            case .loaded:
                List(users) { user in
                    UserRow(user: user)
                }
                .refreshable { await loadUsers() }
            case .error(let error):
                ContentUnavailableView("加载失败", systemImage: "wifi.slash",
                    description: Text(error.localizedDescription))
            }
        }
        .task { await loadUsers() }
    }

    private func loadUsers() async {
        phase = .loading
        do {
            users = try await UserAPI.fetchAll()
            phase = .loaded
        } catch {
            phase = .error(error)
        }
    }
}
```

## 动画

```swift
struct AnimatedCard: View {
    @State private var isExpanded = false

    var body: some View {
        VStack {
            Text("标题")
                .font(.headline)
            if isExpanded {
                Text("详细内容...")
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
        .onTapGesture {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                isExpanded.toggle()
            }
        }
    }
}
```

## 无障碍

```swift
struct ProductCard: View {
    let product: Product

    var body: some View {
        VStack {
            AsyncImage(url: product.imageURL)
                .accessibilityHidden(true)  // 装饰性图片隐藏
            Text(product.name)
                .font(.headline)
            Text(product.price, format: .currency(code: "CNY"))
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(product.name)，价格 \(product.price) 元")
        .accessibilityAddTraits(.isButton)
        .accessibilityHint("双击查看详情")
    }
}
```

## Previews

```swift
#Preview("默认状态") {
    TodoListView()
}

#Preview("空列表") {
    TodoListView()
        .environment(TodoListViewModel(repository: .empty))
}

#Preview("暗色模式", traits: .fixedLayout(width: 375, height: 600)) {
    TodoListView()
        .preferredColorScheme(.dark)
}
```

## 检查清单

- [ ] 每个视图 body 不超过 30 行，复杂逻辑提取为子视图
- [ ] 使用 `@Observable`（iOS 17+）替代 `ObservableObject`
- [ ] 状态所有权清晰：`@State` 私有，`@Binding` 传递，`@Environment` 全局
- [ ] 导航使用 `NavigationStack` + 类型安全路由
- [ ] 异步加载使用 `.task` 修饰符，支持取消
- [ ] 列表支持 `.refreshable` 下拉刷新
- [ ] 所有交互元素添加无障碍标签和提示
- [ ] 动画使用 `withAnimation` 包裹状态变更
- [ ] 提供多种 Preview 场景（空状态、加载中、错误、暗色模式）
- [ ] ViewModel 可独立于视图进行单元测试
