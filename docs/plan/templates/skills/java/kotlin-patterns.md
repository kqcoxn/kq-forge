---
name: kotlin-patterns
type: constraint
package: java
description: Kotlin 惯用模式，涵盖空安全、协程、密封类、DSL 构建器、委托与 Java 互操作最佳实践。
---
# Kotlin 惯用模式与最佳实践

## 核心原则

1. **简洁且安全** — 利用类型系统在编译期消除空指针和类型错误
2. **函数式与面向对象融合** — 选择最适合场景的范式
3. **协程优先** — 异步操作使用协程而非回调或 RxJava
4. **与 Java 无缝互操作** — 充分利用现有 Java 生态

## 数据类与密封类

```kotlin
// data class：自动生成 equals/hashCode/toString/copy
data class User(
    val id: String,
    val name: String,
    val email: String,
    val role: Role = Role.USER  // 默认参数
)

// 密封类：穷举所有可能状态
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String, val cause: Throwable? = null) : Result<Nothing>()
    data object Loading : Result<Nothing>()
}

// 配合 when 表达式（编译器强制穷举）
fun <T> handleResult(result: Result<T>): String = when (result) {
    is Result.Success -> "成功: ${result.data}"
    is Result.Error -> "错误: ${result.message}"
    is Result.Loading -> "加载中..."
}

// value class（内联类）：零开销类型安全
@JvmInline
value class UserId(val value: String) {
    init { require(value.isNotBlank()) { "用户ID不能为空" } }
}
```

## 空安全

```kotlin
// 可空类型显式标注
fun findUser(id: String): User? {
    return userMap[id]
}

// 安全调用链
val cityName = user?.address?.city?.name ?: "未知城市"

// let：仅在非空时执行
findUser(id)?.let { user ->
    sendNotification(user)
    logAccess(user.id)
}

// require / check 做前置条件校验
fun processOrder(order: Order?) {
    requireNotNull(order) { "订单不能为空" }
    check(order.status == Status.PENDING) { "仅待处理订单可操作" }
    // order 在此处已智能转换为非空
}

// 平台类型处理（Java 互操作）
// Java 返回的可能为 null，显式标注
val name: String = javaService.getName() ?: throw IllegalStateException("名称为空")
```

## 扩展函数

```kotlin
// 为现有类添加功能
fun String.toSlug(): String =
    this.lowercase()
        .replace(Regex("[^a-z0-9\\s-]"), "")
        .replace(Regex("\\s+"), "-")
        .trim('-')

// 泛型扩展
fun <T> List<T>.secondOrNull(): T? = if (size >= 2) this[1] else null

// 带接收者的扩展（DSL 基础）
fun StringBuilder.appendLine(line: String) {
    append(line)
    append('\n')
}

// 使用
val slug = "Hello World! 你好".toSlug() // "hello-world-"
```

## 作用域函数

```kotlin
// let：转换可空值或限定作用域
val length = str?.let { it.trim().length }

// run：对象配置 + 计算结果
val result = service.run {
    configure(timeout = 5000)
    execute(request)
}

// apply：对象初始化（返回对象本身）
val user = User().apply {
    name = "张三"
    email = "test@example.com"
    role = Role.ADMIN
}

// also：附加操作（日志、调试）
fun createUser(request: CreateUserRequest): User =
    userRepository.save(request.toEntity())
        .also { log.info("创建用户: ${it.id}") }

// with：对同一对象执行多个操作
val description = with(user) {
    "用户 $name ($email), 角色: $role"
}
```

## 协程基础

```kotlin
// suspend 函数：可挂起的异步操作
suspend fun fetchUserData(userId: String): UserData {
    val profile = async { userService.getProfile(userId) }
    val orders = async { orderService.getOrders(userId) }
    return UserData(profile.await(), orders.await())
}

// 结构化并发
class UserService(private val scope: CoroutineScope) {

    fun refreshAll(userIds: List<String>) {
        scope.launch {
            supervisorScope { // 子任务失败不影响其他
                userIds.forEach { id ->
                    launch {
                        try {
                            refreshUser(id)
                        } catch (e: Exception) {
                            log.error("刷新用户 $id 失败", e)
                        }
                    }
                }
            }
        }
    }
}

// Flow：冷流，按需生产数据
fun observeOrders(userId: String): Flow<Order> = flow {
    while (currentCoroutineContext().isActive) {
        val orders = orderRepository.findByUserId(userId)
        orders.forEach { emit(it) }
        delay(5000) // 每 5 秒轮询
    }
}.flowOn(Dispatchers.IO)

// Flow 操作符
suspend fun getActiveOrderCount(userId: String): Int =
    observeOrders(userId)
        .filter { it.status == OrderStatus.ACTIVE }
        .take(100)
        .count()
```

## 委托模式

```kotlin
// 类委托：组合替代继承
class LoggingList<T>(
    private val inner: MutableList<T> = mutableListOf()
) : MutableList<T> by inner {

    override fun add(element: T): Boolean {
        println("添加元素: $element")
        return inner.add(element)
    }
}

// 属性委托
class UserPreferences(private val prefs: SharedPreferences) {
    var theme: String by prefs.string(default = "light")
    var fontSize: Int by prefs.int(default = 14)
}

// lazy 委托：延迟初始化
val heavyResource: Resource by lazy {
    loadExpensiveResource()
}

// observable 委托
var name: String by Delegates.observable("初始值") { _, old, new ->
    println("名称从 $old 变为 $new")
}
```

## DSL 构建器

```kotlin
// 类型安全的 DSL
@DslMarker
annotation class HtmlDsl

@HtmlDsl
class HtmlBuilder {
    private val elements = mutableListOf<String>()

    fun head(block: HeadBuilder.() -> Unit) {
        elements += HeadBuilder().apply(block).build()
    }

    fun body(block: BodyBuilder.() -> Unit) {
        elements += BodyBuilder().apply(block).build()
    }

    fun build(): String = elements.joinToString("\n")
}

fun html(block: HtmlBuilder.() -> Unit): String =
    HtmlBuilder().apply(block).build()

// 使用
val page = html {
    head { title("首页") }
    body {
        h1("欢迎")
        p("这是一个 DSL 示例")
    }
}

// 实际应用：路由 DSL
fun Application.configureRouting() {
    routing {
        route("/api/v1") {
            get("/users") { call.respond(userService.findAll()) }
            post("/users") {
                val request = call.receive<CreateUserRequest>()
                call.respond(HttpStatusCode.Created, userService.create(request))
            }
        }
    }
}
```

## Java 互操作

```kotlin
// 为 Java 调用方提供友好 API
class KotlinService {
    // 默认参数对 Java 不可见，使用 @JvmOverloads
    @JvmOverloads
    fun process(input: String, timeout: Long = 5000): Result { /* ... */ }

    // 伴生对象方法暴露为静态方法
    companion object {
        @JvmStatic
        fun create(): KotlinService = KotlinService()
    }

    // 属性暴露为 getter/setter
    @get:JvmName("isActive")
    val active: Boolean = true
}

// 处理 Java 的可空返回
fun processJavaResult(service: JavaService) {
    // Java 方法返回值视为平台类型，显式处理
    val result: String = service.compute() ?: error("计算结果为空")
}
```

## 检查清单

- [ ] 优先使用 `val` 而非 `var`，数据类默认不可变
- [ ] 可空类型使用 `?.`、`?:` 和 `let` 处理，避免 `!!`
- [ ] 密封类 + `when` 表达式处理所有状态分支
- [ ] 协程使用结构化并发，避免 `GlobalScope`
- [ ] Flow 用于响应式数据流，指定 `flowOn` 调度器
- [ ] 扩展函数保持纯函数特性，不修改外部状态
- [ ] 作用域函数选择遵循约定（apply 初始化、let 转换、also 副作用）
- [ ] DSL 使用 `@DslMarker` 防止作用域泄漏
- [ ] Java 互操作使用 `@JvmStatic`、`@JvmOverloads` 注解
- [ ] 协程异常使用 `supervisorScope` 隔离子任务失败
