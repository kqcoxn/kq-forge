---
name: springboot-patterns
type: capability
package: java
description: Spring Boot 应用架构模式，涵盖分层结构、依赖注入、REST 控制器、异常处理、配置与测试。
---
# Spring Boot 架构模式

## 核心原则

1. **分层清晰** — Controller → Service → Repository，依赖单向流动
2. **约定优于配置** — 利用 Spring Boot 自动配置减少样板代码
3. **关注点分离** — 每层只处理自己的职责
4. **可测试性** — 通过依赖注入实现各层独立测试

## 项目结构

```
src/main/java/com/example/app/
├── Application.java              # 启动类
├── config/                       # 配置类
│   ├── SecurityConfig.java
│   └── WebConfig.java
├── domain/                       # 领域模型
│   ├── model/
│   │   ├── User.java
│   │   └── Order.java
│   └── event/
│       └── OrderCreatedEvent.java
├── repository/                   # 数据访问层
│   └── UserRepository.java
├── service/                      # 业务逻辑层
│   ├── UserService.java
│   └── impl/
│       └── UserServiceImpl.java
├── controller/                   # 表现层
│   ├── UserController.java
│   └── dto/
│       ├── CreateUserRequest.java
│       └── UserResponse.java
├── exception/                    # 异常处理
│   ├── GlobalExceptionHandler.java
│   └── BusinessException.java
└── infrastructure/               # 基础设施
    ├── client/
    └── messaging/
```

## 依赖注入

```java
// 推荐：构造器注入（不可变、易测试）
@Service
public class OrderService {
    private final OrderRepository orderRepository;
    private final PaymentClient paymentClient;
    private final EventPublisher eventPublisher;

    // Spring 自动注入（单构造器可省略 @Autowired）
    public OrderService(
            OrderRepository orderRepository,
            PaymentClient paymentClient,
            EventPublisher eventPublisher) {
        this.orderRepository = orderRepository;
        this.paymentClient = paymentClient;
        this.eventPublisher = eventPublisher;
    }
}

// @Component 语义化变体
@Repository   // 数据访问层，自动转换持久化异常
@Service      // 业务逻辑层
@Controller   // Web 层
@Configuration // 配置类
```

## 配置管理

```java
// 类型安全的配置绑定
@ConfigurationProperties(prefix = "app.payment")
@Validated
public record PaymentProperties(
    @NotBlank String apiUrl,
    @NotBlank String apiKey,
    @Min(1) int maxRetries,
    Duration timeout
) {}

// 启用配置类
@Configuration
@EnableConfigurationProperties(PaymentProperties.class)
public class PaymentConfig {

    @Bean
    public PaymentClient paymentClient(PaymentProperties props) {
        return PaymentClient.builder()
            .baseUrl(props.apiUrl())
            .timeout(props.timeout())
            .maxRetries(props.maxRetries())
            .build();
    }
}
```

```yaml
# application.yml
app:
  payment:
    api-url: https://api.payment.com
    api-key: ${PAYMENT_API_KEY}
    max-retries: 3
    timeout: 5s
```

## REST 控制器

```java
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUser(@PathVariable String id) {
        User user = userService.findById(id);
        return ResponseEntity.ok(UserResponse.from(user));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse createUser(@Valid @RequestBody CreateUserRequest request) {
        User user = userService.create(request);
        return UserResponse.from(user);
    }

    @GetMapping
    public Page<UserResponse> listUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return userService.findAll(PageRequest.of(page, size))
            .map(UserResponse::from);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUser(@PathVariable String id) {
        userService.delete(id);
    }
}
```

## 全局异常处理

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handleNotFound(NotFoundException ex) {
        return new ErrorResponse(ex.errorCode(), ex.getMessage());
    }

    @ExceptionHandler(ValidationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleValidation(ValidationException ex) {
        return new ErrorResponse("VALIDATION_ERROR", ex.getMessage(), ex.errors());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleBeanValidation(MethodArgumentNotValidException ex) {
        var errors = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> new FieldError(e.getField(), e.getDefaultMessage()))
            .toList();
        return new ErrorResponse("VALIDATION_ERROR", "请求参数校验失败", errors);
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ErrorResponse handleUnexpected(Exception ex) {
        log.error("未预期的异常", ex);
        return new ErrorResponse("INTERNAL_ERROR", "服务器内部错误");
    }
}

public record ErrorResponse(String code, String message, List<FieldError> details) {
    public ErrorResponse(String code, String message) {
        this(code, message, List.of());
    }
}
```

## Bean Validation

```java
public record CreateUserRequest(
    @NotBlank(message = "用户名不能为空")
    @Size(min = 2, max = 50, message = "用户名长度 2-50 字符")
    String name,

    @NotBlank @Email(message = "邮箱格式不正确")
    String email,

    @NotNull @Min(value = 18, message = "年龄不能小于 18")
    Integer age
) {}

// 自定义校验注解
@Target({FIELD, PARAMETER})
@Retention(RUNTIME)
@Constraint(validatedBy = PhoneNumberValidator.class)
public @interface ValidPhone {
    String message() default "手机号格式不正确";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
```

## Profiles 与环境

```java
// 按环境加载不同实现
@Profile("production")
@Service
public class SmtpEmailService implements EmailService { /* ... */ }

@Profile("!production")
@Service
public class MockEmailService implements EmailService { /* ... */ }
```

```yaml
# application-dev.yml
spring:
  datasource:
    url: jdbc:h2:mem:devdb
logging:
  level:
    com.example: DEBUG
```

## Actuator 健康检查

```java
@Component
public class PaymentServiceHealthIndicator implements HealthIndicator {
    private final PaymentClient client;

    @Override
    public Health health() {
        try {
            client.ping();
            return Health.up()
                .withDetail("service", "payment")
                .build();
        } catch (Exception e) {
            return Health.down()
                .withException(e)
                .build();
        }
    }
}
```

## 测试分层

```java
// Controller 层：@WebMvcTest（仅加载 Web 层）
@WebMvcTest(UserController.class)
class UserControllerTest {
    @Autowired MockMvc mockMvc;
    @MockBean UserService userService;

    @Test
    void getUser_returnsUser() throws Exception {
        when(userService.findById("1")).thenReturn(testUser());

        mockMvc.perform(get("/api/v1/users/1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("张三"));
    }
}

// Service 层：纯单元测试
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
    @Mock OrderRepository repository;
    @InjectMocks OrderService service;

    @Test
    void createOrder_savesAndPublishesEvent() { /* ... */ }
}

// Repository 层：@DataJpaTest（内存数据库）
@DataJpaTest
class UserRepositoryTest {
    @Autowired UserRepository repository;

    @Test
    void findByEmail_returnsUser() { /* ... */ }
}
```

## 检查清单

- [ ] 分层结构清晰：Controller 不含业务逻辑，Service 不含持久化代码
- [ ] 使用构造器注入，字段声明为 `final`
- [ ] 配置使用 `@ConfigurationProperties` 类型安全绑定
- [ ] REST 接口使用 DTO 隔离内部模型，通过 `@Valid` 校验入参
- [ ] 全局异常处理覆盖所有业务异常和框架异常
- [ ] 不同环境使用 Profile 隔离配置
- [ ] Actuator 暴露健康检查和指标端点
- [ ] 每层有对应的测试切片（`@WebMvcTest`、`@DataJpaTest`）
- [ ] 敏感配置通过环境变量注入，不硬编码
- [ ] API 版本化（URL 路径或 Header）
