---
name: compose-multiplatform
type: capability
package: mobile
description: Compose Multiplatform 开发模式，涵盖 Composable 函数、状态管理、导航、跨平台共享 UI、expect/actual 声明、资源管理与测试。
---

# Compose Multiplatform 开发模式

## 核心原则

1. **声明式 UI** — 描述 UI 应该是什么样子，框架负责高效更新
2. **单向数据流** — 状态向下流动，事件向上传递
3. **组合优于继承** — 通过 Composable 函数组合构建界面
4. **共享最大化** — 业务逻辑和 UI 跨平台共享，平台特定代码最小化
5. **稳定性优化** — 利用 Compose 编译器的稳定性推断跳过不必要的重组

## Composable 函数基础

```kotlin
import androidx.compose.runtime.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*

// 无状态 Composable：纯展示
@Composable
fun UserCard(
    name: String,
    email: String,
    onTap: () -> Unit,
    modifier: Modifier = Modifier  // 始终接受 modifier 参数
) {
    Card(
        onClick = onTap,
        modifier = modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(text = name, style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.height(4.dp))
            Text(text = email, style = MaterialTheme.typography.bodySmall)
        }
    }
}

// 有状态 Composable：管理自身状态
@Composable
fun SearchBar(onSearch: (String) -> Unit) {
    var query by remember { mutableStateOf("") }

    OutlinedTextField(
        value = query,
        onValueChange = { query = it },
        placeholder = { Text("搜索...") },
        trailingIcon = {
            IconButton(onClick = { onSearch(query) }) {
                Icon(Icons.Default.Search, contentDescription = "搜索")
            }
        },
        singleLine = true,
        modifier = Modifier.fillMaxWidth()
    )
}
```

## 状态管理

```kotlin
// remember：跨重组保持状态
@Composable
fun Counter() {
    var count by remember { mutableStateOf(0) }
    Button(onClick = { count++ }) {
        Text("点击次数: $count")
    }
}

// rememberSaveable：跨配置变更保持状态
@Composable
fun FormField() {
    var text by rememberSaveable { mutableStateOf("") }
    TextField(value = text, onValueChange = { text = it })
}

// 状态提升：将状态提升到共同父级
@Composable
fun TemperatureConverter() {
    var celsius by remember { mutableStateOf("") }

    Column {
        TemperatureInput(
            value = celsius,
            onValueChange = { celsius = it },
            label = "摄氏度"
        )
        Text("华氏度: ${celsius.toFloatOrNull()?.let { it * 9/5 + 32 } ?: "--"}")
    }
}

// ViewModel 模式（推荐用于复杂状态）
class TodoViewModel : ViewModel() {
    private val _todos = MutableStateFlow<List<Todo>>(emptyList())
    val todos: StateFlow<List<Todo>> = _todos.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    fun addTodo(title: String) {
        viewModelScope.launch {
            _todos.update { it + Todo(title = title) }
        }
    }

    fun toggleTodo(id: String) {
        _todos.update { todos ->
            todos.map { if (it.id == id) it.copy(done = !it.done) else it }
        }
    }
}

@Composable
fun TodoScreen(viewModel: TodoViewModel = viewModel()) {
    val todos by viewModel.todos.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    if (isLoading) {
        CircularProgressIndicator()
    } else {
        LazyColumn {
            items(todos, key = { it.id }) { todo ->
                TodoItem(todo = todo, onToggle = { viewModel.toggleTodo(todo.id) })
            }
        }
    }
}
```

## 导航

```kotlin
import androidx.navigation.compose.*

// 定义路由
sealed class Screen(val route: String) {
    data object Home : Screen("home")
    data object Profile : Screen("profile/{userId}") {
        fun createRoute(userId: String) = "profile/$userId"
    }
    data object Settings : Screen("settings")
}

@Composable
fun AppNavigation() {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = Screen.Home.route) {
        composable(Screen.Home.route) {
            HomeScreen(
                onUserClick = { userId ->
                    navController.navigate(Screen.Profile.createRoute(userId))
                }
            )
        }
        composable(
            route = Screen.Profile.route,
            arguments = listOf(navArgument("userId") { type = NavType.StringType })
        ) { backStackEntry ->
            val userId = backStackEntry.arguments?.getString("userId") ?: return@composable
            ProfileScreen(userId = userId)
        }
        composable(Screen.Settings.route) {
            SettingsScreen()
        }
    }
}
```

## 跨平台共享（expect/actual）

```kotlin
// commonMain：共享接口声明
expect class PlatformContext

expect fun getPlatformName(): String

expect class FileStorage(context: PlatformContext) {
    suspend fun readText(path: String): String
    suspend fun writeText(path: String, content: String)
}

// androidMain：Android 实现
actual typealias PlatformContext = android.content.Context

actual fun getPlatformName(): String = "Android ${Build.VERSION.SDK_INT}"

actual class FileStorage actual constructor(private val context: PlatformContext) {
    actual suspend fun readText(path: String): String {
        return context.openFileInput(path).bufferedReader().readText()
    }
    actual suspend fun writeText(path: String, content: String) {
        context.openFileOutput(path, Context.MODE_PRIVATE).use {
            it.write(content.toByteArray())
        }
    }
}

// iosMain：iOS 实现
actual class PlatformContext  // iOS 不需要 Context

actual fun getPlatformName(): String = "iOS ${UIDevice.currentDevice.systemVersion}"

actual class FileStorage actual constructor(context: PlatformContext) {
    actual suspend fun readText(path: String): String {
        val dir = NSSearchPathForDirectoriesInDomains(
            NSDocumentDirectory, NSUserDomainMask, true
        ).first() as String
        return NSString.stringWithContentsOfFile("$dir/$path") ?: ""
    }
    // ...
}
```

## 资源管理

```kotlin
// commonMain/composeResources/ 目录结构
// ├── drawable/
// │   └── logo.png
// ├── values/
// │   └── strings.xml
// └── font/
//     └── roboto_regular.ttf

// 使用共享资源
@Composable
fun AppLogo() {
    Image(
        painter = painterResource(Res.drawable.logo),
        contentDescription = "应用图标"
    )
}

@Composable
fun Greeting() {
    Text(text = stringResource(Res.string.hello_world))
}
```

## 测试

```kotlin
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import org.junit.Rule
import org.junit.Test

class TodoScreenTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun `显示待办列表`() {
        composeRule.setContent {
            TodoScreen(viewModel = FakeTodoViewModel(sampleTodos))
        }

        composeRule.onNodeWithText("买牛奶").assertIsDisplayed()
        composeRule.onNodeWithText("写代码").assertIsDisplayed()
    }

    @Test
    fun `点击切换完成状态`() {
        val viewModel = FakeTodoViewModel(sampleTodos)
        composeRule.setContent { TodoScreen(viewModel = viewModel) }

        composeRule.onNodeWithText("买牛奶").performClick()

        assert(viewModel.todos.value.first().done)
    }

    @Test
    fun `空列表显示提示`() {
        composeRule.setContent {
            TodoScreen(viewModel = FakeTodoViewModel(emptyList()))
        }

        composeRule.onNodeWithText("暂无待办事项").assertIsDisplayed()
    }
}
```

## 检查清单

- [ ] 每个 Composable 接受 `modifier: Modifier = Modifier` 参数
- [ ] 无状态 Composable 与有状态 Composable 分离
- [ ] 使用 `remember` / `rememberSaveable` 正确管理状态生命周期
- [ ] 列表使用 `LazyColumn` + `key` 参数优化重组
- [ ] 平台特定代码通过 `expect/actual` 隔离
- [ ] 共享资源放在 `commonMain/composeResources/`
- [ ] ViewModel 使用 `StateFlow` 暴露状态
- [ ] UI 测试覆盖关键交互路径
- [ ] 避免在 Composable 中执行副作用，使用 `LaunchedEffect`
- [ ] 数据类标记为 `@Stable` 或 `@Immutable` 帮助编译器优化
