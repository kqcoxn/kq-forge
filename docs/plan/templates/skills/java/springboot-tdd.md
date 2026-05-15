---
name: springboot-tdd
type: capability
package: java
description: Spring Boot TDD 实践指南，涵盖 JUnit 5、Mockito、MockMvc、TestContainers 与测试数据构建器。
---
# Spring Boot TDD 实践指南

## 核心原则

1. **Red-Green-Refactor** — 先写失败测试，再写最小实现，最后重构
2. **测试金字塔** — 大量单元测试 → 适量集成测试 → 少量端到端测试
3. **测试切片** — 每层使用对应的 Spring 测试切片，避免加载完整上下文
4. **快速反馈** — 单元测试毫秒级，集成测试秒级

## TDD 工作流

```java
// 第一步：Red — 写一个失败的测试
@Test
void createOrder_withValidItems_returnsCreatedOrder() {
    var request = new CreateOrderRequest(List.of(
        new OrderItem("product-1", 2)
    ));

    Order order = orderService.create(request);

    assertThat(order.id()).isNotNull();
    assertThat(order.items()).hasSize(1);
    assertThat(order.status()).isEqualTo(OrderStatus.PENDING);
}

// 第二步：Green — 写最小实现让测试通过
public Order create(CreateOrderRequest request) {
    var order = Order.builder()
        .id(UUID.randomUUID().toString())
        .items(request.items())
        .status(OrderStatus.PENDING)
        .build();
    return repository.save(order);
}

// 第三步：Refactor — 改善设计，测试保持绿色
```

## JUnit 5 基础

```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock UserRepository userRepository;
    @Mock EventPublisher eventPublisher;
    @InjectMocks UserService userService;

    @Test
    @DisplayName("创建用户 - 邮箱已存在时抛出异常")
    void create_whenEmailExists_throwsConflict() {
        // Given
        var request = new CreateUserRequest("张三", "test@example.com");
        when(userRepository.existsByEmail("test@example.com")).thenReturn(true);

        // When & Then
        assertThatThrownBy(() -> userService.create(request))
            .isInstanceOf(ConflictException.class)
            .hasMessageContaining("邮箱已存在");

        verify(userRepository, never()).save(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "invalid-email", "@no-user.com"})
    @DisplayName("创建用户 - 无效邮箱格式")
    void create_withInvalidEmail_throwsValidation(String email) {
        var request = new CreateUserRequest("张三", email);

        assertThatThrownBy(() -> userService.create(request))
            .isInstanceOf(ValidationException.class);
    }

    @Nested
    @DisplayName("更新用户")
    class UpdateUser {
        @Test
        void update_existingUser_returnsUpdated() { /* ... */ }

        @Test
        void update_nonExistentUser_throwsNotFound() { /* ... */ }
    }
}
```

## Controller 测试（MockMvc）

```java
@WebMvcTest(UserController.class)
@Import(SecurityConfig.class)
class UserControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @MockBean UserService userService;

    @Test
    @WithMockUser(roles = "USER")
    void getUser_existingId_returns200() throws Exception {
        var user = UserResponse.builder()
            .id("user-1").name("张三").email("test@example.com").build();
        when(userService.findById("user-1")).thenReturn(user);

        mockMvc.perform(get("/api/v1/users/user-1")
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value("user-1"))
            .andExpect(jsonPath("$.name").value("张三"))
            .andExpect(jsonPath("$.email").value("test@example.com"));
    }

    @Test
    @WithMockUser(roles = "USER")
    void createUser_validRequest_returns201() throws Exception {
        var request = new CreateUserRequest("张三", "test@example.com");
        var response = new UserResponse("user-1", "张三", "test@example.com");
        when(userService.create(any())).thenReturn(response);

        mockMvc.perform(post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value("user-1"));
    }

    @Test
    @WithMockUser(roles = "USER")
    void createUser_invalidRequest_returns400() throws Exception {
        var request = new CreateUserRequest("", "not-an-email");

        mockMvc.perform(post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void getUser_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/users/user-1"))
            .andExpect(status().isUnauthorized());
    }
}
```

## Repository 测试（@DataJpaTest）

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class UserRepositoryTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired UserRepository repository;

    @Test
    void findByEmail_existingUser_returnsUser() {
        var user = UserEntity.builder()
            .name("张三").email("test@example.com").build();
        repository.save(user);

        Optional<UserEntity> found = repository.findByEmail("test@example.com");

        assertThat(found).isPresent();
        assertThat(found.get().getName()).isEqualTo("张三");
    }

    @Test
    void findByEmail_nonExistent_returnsEmpty() {
        Optional<UserEntity> found = repository.findByEmail("nobody@example.com");
        assertThat(found).isEmpty();
    }
}
```

## TestContainers 集成测试

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class OrderIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Container
    static GenericContainer<?> redis = new GenericContainer<>("redis:7-alpine")
        .withExposedPorts(6379);

    @DynamicPropertySource
    static void configure(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    }

    @Autowired TestRestTemplate restTemplate;

    @Test
    void fullOrderWorkflow() {
        // 创建订单
        var createReq = new CreateOrderRequest(List.of(new OrderItem("p1", 2)));
        var createResp = restTemplate.postForEntity("/api/v1/orders", createReq, OrderResponse.class);
        assertThat(createResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        String orderId = createResp.getBody().id();

        // 查询订单
        var getResp = restTemplate.getForEntity("/api/v1/orders/" + orderId, OrderResponse.class);
        assertThat(getResp.getBody().status()).isEqualTo("PENDING");
    }
}
```

## 测试切片总结

```java
// @WebMvcTest — 仅加载 Web 层（Controller + Filter + ControllerAdvice）
@WebMvcTest(OrderController.class)

// @DataJpaTest — 仅加载 JPA 层（Entity + Repository）
@DataJpaTest

// @DataMongoTest — MongoDB 层
@DataMongoTest

// @JsonTest — JSON 序列化/反序列化
@JsonTest

// @RestClientTest — RestTemplate / WebClient
@RestClientTest(PaymentClient.class)

// @SpringBootTest — 完整上下文（集成测试）
@SpringBootTest
```

## AssertJ 断言

```java
// 字符串
assertThat(name).isNotBlank().startsWith("张").hasSize(2);

// 集合
assertThat(orders)
    .hasSize(3)
    .extracting(Order::status)
    .containsExactly(PENDING, ACTIVE, COMPLETED);

// 异常
assertThatThrownBy(() -> service.process(null))
    .isInstanceOf(IllegalArgumentException.class)
    .hasMessageContaining("不能为空")
    .hasNoCause();

// 对象字段
assertThat(user)
    .extracting("name", "email", "active")
    .containsExactly("张三", "test@example.com", true);

// 软断言（收集所有失败）
SoftAssertions.assertSoftly(soft -> {
    soft.assertThat(response.status()).isEqualTo(200);
    soft.assertThat(response.body().name()).isEqualTo("张三");
    soft.assertThat(response.body().email()).isNotNull();
});
```

## 测试数据构建器

```java
// 使用 Builder 模式构造测试数据
public class TestUserBuilder {
    private String id = UUID.randomUUID().toString();
    private String name = "测试用户";
    private String email = "test@example.com";
    private UserStatus status = UserStatus.ACTIVE;

    public static TestUserBuilder aUser() {
        return new TestUserBuilder();
    }

    public TestUserBuilder withName(String name) {
        this.name = name;
        return this;
    }

    public TestUserBuilder withEmail(String email) {
        this.email = email;
        return this;
    }

    public TestUserBuilder inactive() {
        this.status = UserStatus.INACTIVE;
        return this;
    }

    public User build() {
        return new User(id, name, email, status);
    }

    public UserEntity buildEntity() {
        return UserEntity.builder()
            .id(id).name(name).email(email).status(status).build();
    }
}

// 使用
var user = TestUserBuilder.aUser().withName("李四").inactive().build();
```

## 测试配置

```java
// 测试专用配置
@TestConfiguration
public class TestSecurityConfig {
    @Bean
    public SecurityFilterChain testFilterChain(HttpSecurity http) throws Exception {
        return http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll()).build();
    }
}

// 共享容器基类（避免每个测试类启动新容器）
@Testcontainers
public abstract class AbstractIntegrationTest {
    @Container
    protected static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:16-alpine")
            .withReuse(true);

    @DynamicPropertySource
    static void configure(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }
}
```

## 检查清单

- [ ] 遵循 Red-Green-Refactor 循环，先写测试再写实现
- [ ] Controller 测试使用 `@WebMvcTest`，验证请求/响应/状态码
- [ ] Service 测试使用 `@ExtendWith(MockitoExtension.class)`，纯单元测试
- [ ] Repository 测试使用 `@DataJpaTest` + TestContainers
- [ ] 集成测试使用 `@SpringBootTest` + TestContainers
- [ ] 断言使用 AssertJ，避免 JUnit 原生 assert
- [ ] 测试数据使用 Builder 模式，提供合理默认值
- [ ] 每个测试方法只验证一个行为
- [ ] 测试命名格式：`方法名_条件_预期结果`
- [ ] 共享 TestContainers 实例减少启动时间
- [ ] 测试覆盖率 > 80%，核心业务逻辑 > 90%
