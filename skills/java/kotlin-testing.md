---
name: kotlin-testing
type: capability
package: java
description: Kotlin 测试实践指南，涵盖 Kotest、MockK、协程测试、Flow 测试与 Spring Boot 集成测试。
---
# Kotlin 测试实践指南

## 核心原则

1. **Kotlin 风格测试** — 使用 Kotest DSL 编写表达力强的测试
2. **协程原生** — 异步代码使用 `runTest` 测试，Flow 使用 Turbine
3. **MockK 优先** — Kotlin 友好的 Mock 框架，支持协程和扩展函数
4. **快速且可靠** — 测试不依赖时间、网络等外部因素

## Kotest 框架

```kotlin
// StringSpec：最简洁的风格
class CalculatorTest : StringSpec({
    "两个正数相加" {
        Calculator.add(1, 2) shouldBe 3
    }

    "除以零抛出异常" {
        shouldThrow<ArithmeticException> {
            Calculator.divide(1, 0)
        }
    }
})

// BehaviorSpec：BDD 风格
class UserServiceSpec : BehaviorSpec({
    given("一个已注册的用户") {
        val user = TestUser.create()

        `when`("使用正确密码登录") {
            val result = authService.login(user.email, user.password)

            then("返回有效 token") {
                result.shouldBeInstanceOf<LoginResult.Success>()
                result.token.shouldNotBeBlank()
            }
        }

        `when`("使用错误密码登录") {
            val result = authService.login(user.email, "wrong")

            then("返回认证失败") {
                result.shouldBeInstanceOf<LoginResult.Failure>()
            }
        }
    }
})

// FunSpec：类似 JUnit 但更灵活
class OrderServiceSpec : FunSpec({
    lateinit var service: OrderService
    lateinit var mockRepo: OrderRepository

    beforeTest {
        mockRepo = mockk()
        service = OrderService(mockRepo)
    }

    test("创建订单保存到仓库") {
        coEvery { mockRepo.save(any()) } returns testOrder()

        val order = service.create(CreateOrderRequest(items = listOf(item())))

        order.status shouldBe OrderStatus.PENDING
        coVerify(exactly = 1) { mockRepo.save(any()) }
    }

    context("取消订单") {
        test("待处理订单可取消") { /* ... */ }
        test("已完成订单不可取消") { /* ... */ }
    }
})
```

## Kotest Matchers

```kotlin
class MatcherExamples : StringSpec({
    "字符串匹配" {
        val name = "张三丰"
        name shouldStartWith "张"
        name shouldHaveLength 3
        name shouldMatch Regex("张.+")
    }

    "集合匹配" {
        val items = listOf(1, 2, 3, 4, 5)
        items shouldHaveSize 5
        items shouldContain 3
        items shouldContainAll listOf(1, 3, 5)
        items.shouldBeSorted()

        val users = listOf(User("张三", 20), User("李四", 30))
        users.shouldExist { it.age > 25 }
        users.shouldForAll { it.name.isNotBlank() }
    }

    "对象匹配" {
        val user = User("张三", "test@example.com")
        user.shouldBeInstanceOf<User>()
        user.name shouldBe "张三"
    }

    "异常匹配" {
        val ex = shouldThrow<ValidationException> {
            validate(invalidInput)
        }
        ex.message shouldContain "格式不正确"
        ex.field shouldBe "email"
    }
})
```

## Kotest 属性测试

```kotlin
class PropertyTestSpec : StringSpec({
    "列表反转两次等于原列表" {
        checkAll(Arb.list(Arb.int())) { list ->
            list.reversed().reversed() shouldBe list
        }
    }

    "字符串长度非负" {
        checkAll(Arb.string()) { str ->
            str.length shouldBeGreaterThanOrEqualTo 0
        }
    }

    "自定义生成器" {
        val emailArb = Arb.bind(
            Arb.string(5..10, Codepoint.alphanumeric()),
            Arb.string(3..7, Codepoint.alphanumeric())
        ) { user, domain -> "$user@$domain.com" }

        checkAll(emailArb) { email ->
            email shouldContain "@"
            email shouldEndWith ".com"
        }
    }

    "边界条件" {
        checkAll(Arb.int(1..100)) { quantity ->
            val order = createOrder(quantity)
            order.total shouldBeGreaterThan BigDecimal.ZERO
        }
    }
})
```

## MockK

```kotlin
class MockKExamples : FunSpec({
    test("基本 Mock") {
        val repo = mockk<UserRepository>()

        every { repo.findById("user-1") } returns User("user-1", "张三")
        every { repo.findById("unknown") } returns null

        repo.findById("user-1")!!.name shouldBe "张三"
        repo.findById("unknown") shouldBe null

        verify(exactly = 1) { repo.findById("user-1") }
    }

    test("参数匹配") {
        val service = mockk<EmailService>()

        every { service.send(match { it.contains("@") }, any(), any()) } returns true

        service.send("test@example.com", "主题", "内容") shouldBe true

        verify { service.send(match { it.endsWith("@example.com") }, any(), any()) }
    }

    test("返回序列") {
        val api = mockk<ExternalApi>()

        every { api.fetch() } returnsMany listOf(
            Result.Error("超时"),
            Result.Error("超时"),
            Result.Success("数据")
        )

        api.fetch().shouldBeInstanceOf<Result.Error>()
        api.fetch().shouldBeInstanceOf<Result.Error>()
        api.fetch().shouldBeInstanceOf<Result.Success>()
    }

    test("relaxed mock - 未配置的方法返回默认值") {
        val logger = mockk<Logger>(relaxed = true)
        logger.info("任何消息") // 不会抛异常
        verify { logger.info("任何消息") }
    }

    test("spy - 部分 mock") {
        val list = spyk(mutableListOf<String>())
        list.add("item")
        list shouldHaveSize 1
        verify { list.add("item") }
    }
})
```

## 协程 Mock

```kotlin
class CoroutineMockSpec : FunSpec({
    test("mock suspend 函数") {
        val repo = mockk<UserRepository>()

        coEvery { repo.findById("user-1") } returns User("user-1", "张三")
        coEvery { repo.save(any()) } just Runs

        val user = repo.findById("user-1")
        user!!.name shouldBe "张三"

        coVerify { repo.findById("user-1") }
    }

    test("mock suspend 函数抛出异常") {
        val client = mockk<HttpClient>()

        coEvery { client.get(any()) } throws IOException("网络错误")

        shouldThrow<IOException> {
            client.get("https://api.example.com")
        }
    }
})
```

## 协程测试（runTest）

```kotlin
class CoroutineTestSpec : FunSpec({
    test("runTest 自动跳过 delay") {
        runTest {
            val service = CacheService(testScheduler)

            service.put("key", "value")
            advanceTimeBy(Duration.ofMinutes(5))

            // 缓存 5 分钟后过期
            service.get("key") shouldBe null
        }
    }

    test("测试并发操作") {
        runTest {
            val results = mutableListOf<Int>()

            launch { results.add(1); delay(100); results.add(3) }
            launch { results.add(2); delay(50); results.add(4) }

            advanceUntilIdle()
            results shouldContainExactly listOf(1, 2, 4, 3)
        }
    }
})
```

## Flow 测试（Turbine）

```kotlin
class FlowTestSpec : FunSpec({
    test("测试 Flow 发射") {
        val flow = flowOf(1, 2, 3)

        flow.test {
            awaitItem() shouldBe 1
            awaitItem() shouldBe 2
            awaitItem() shouldBe 3
            awaitComplete()
        }
    }

    test("测试 StateFlow") {
        val viewModel = UserViewModel()

        viewModel.state.test {
            awaitItem() shouldBe UiState.Loading

            viewModel.loadUser("user-1")

            awaitItem() shouldBe UiState.Success(testUser())
        }
    }

    test("测试 Flow 错误") {
        val errorFlow = flow<Int> {
            emit(1)
            throw IOException("网络错误")
        }

        errorFlow.test {
            awaitItem() shouldBe 1
            awaitError().shouldBeInstanceOf<IOException>()
        }
    }

    test("测试 Flow 超时") {
        val slowFlow = flow {
            delay(10_000)
            emit("结果")
        }

        slowFlow.test(timeout = 1.seconds) {
            // 使用 runTest 时 delay 会被跳过
            awaitItem() shouldBe "结果"
            awaitComplete()
        }
    }
})
```

## Spring Boot + Kotlin 测试

```kotlin
@SpringBootTest
@Testcontainers
class UserIntegrationSpec : FunSpec() {
    override fun extensions() = listOf(SpringExtension)

    @Autowired lateinit var userService: UserService
    @Autowired lateinit var webTestClient: WebTestClient

    companion object {
        @Container
        val postgres = PostgreSQLContainer("postgres:16-alpine")

        @DynamicPropertySource
        @JvmStatic
        fun configure(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url", postgres::getJdbcUrl)
            registry.add("spring.datasource.username", postgres::getUsername)
            registry.add("spring.datasource.password", postgres::getPassword)
        }
    }

    init {
        test("创建用户 API") {
            val request = CreateUserRequest("张三", "test@example.com")

            webTestClient.post()
                .uri("/api/v1/users")
                .bodyValue(request)
                .exchange()
                .expectStatus().isCreated
                .expectBody<UserResponse>()
                .consumeWith { response ->
                    response.responseBody!!.name shouldBe "张三"
                }
        }

        test("获取不存在的用户返回 404") {
            webTestClient.get()
                .uri("/api/v1/users/nonexistent")
                .exchange()
                .expectStatus().isNotFound
        }
    }
}
```

## 测试 Fixtures

```kotlin
// 使用工厂函数创建测试数据
object TestFixtures {
    fun user(
        id: String = UUID.randomUUID().toString(),
        name: String = "测试用户",
        email: String = "test@example.com",
        role: Role = Role.USER
    ) = User(id, name, email, role)

    fun order(
        userId: String = "user-1",
        items: List<OrderItem> = listOf(orderItem()),
        status: OrderStatus = OrderStatus.PENDING
    ) = Order(UUID.randomUUID().toString(), userId, items, status)

    fun orderItem(
        productId: String = "product-1",
        quantity: Int = 1,
        price: BigDecimal = BigDecimal("99.99")
    ) = OrderItem(productId, quantity, price)
}

// 使用
val user = TestFixtures.user(name = "管理员", role = Role.ADMIN)
val order = TestFixtures.order(items = listOf(
    TestFixtures.orderItem(quantity = 3)
))
```

## 检查清单

- [ ] 使用 Kotest DSL（StringSpec/BehaviorSpec/FunSpec）编写测试
- [ ] 断言使用 Kotest matchers（`shouldBe`、`shouldContain` 等）
- [ ] Mock 使用 MockK，协程 mock 使用 `coEvery`/`coVerify`
- [ ] suspend 函数测试使用 `runTest`，时间控制用 `advanceTimeBy`
- [ ] Flow 测试使用 Turbine 的 `.test {}` 扩展
- [ ] 属性测试覆盖核心算法和数据转换逻辑
- [ ] Spring Boot 集成测试使用 `SpringExtension` + TestContainers
- [ ] 测试数据使用工厂函数，提供合理默认值
- [ ] relaxed mock 仅用于不关心交互的依赖（如 Logger）
- [ ] 每个测试独立运行，不依赖执行顺序
