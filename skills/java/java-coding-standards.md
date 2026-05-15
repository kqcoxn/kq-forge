---
name: java-coding-standards
type: constraint
package: java
description: 现代 Java（17+）编码规范，涵盖命名、不可变性、Optional、Stream、异常处理与泛型最佳实践。
---
# Java 编码规范（Java 17+）

## 核心原则

1. **不可变优先** — 默认使用不可变数据结构，仅在必要时引入可变性
2. **类型安全** — 利用泛型和密封类消除运行时类型错误
3. **Null 安全** — 使用 Optional 表达可选值，杜绝 null 传播
4. **表达意图** — 代码应自解释，命名即文档

## 命名规范

```java
// 类名：大驼峰，名词或名词短语
public class OrderService {}
public record CreateUserRequest(String name, String email) {}

// 方法名：小驼峰，动词开头
public User findById(String id) {}
public boolean isActive() {}
public void processPayment(Payment payment) {}

// 常量：全大写下划线分隔
public static final int MAX_RETRY_COUNT = 3;
public static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(30);

// 泛型参数：单字母大写，语义明确时可用描述性名称
public interface Repository<T, ID> {}
public <E extends Comparable<E>> List<E> sort(List<E> items) {}

// 包名：全小写，反向域名
package com.example.order.domain;
```

## 不可变性

```java
// Record：天然不可变的数据载体
public record Money(BigDecimal amount, Currency currency) {
    // 紧凑构造器做校验
    public Money {
        Objects.requireNonNull(amount, "金额不能为空");
        Objects.requireNonNull(currency, "币种不能为空");
        if (amount.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("金额不能为负");
        }
    }

    public Money add(Money other) {
        if (!this.currency.equals(other.currency)) {
            throw new IllegalArgumentException("币种不一致");
        }
        return new Money(this.amount.add(other.amount), this.currency);
    }
}

// 不可变集合
var items = List.of("a", "b", "c");                    // 不可变 List
var map = Map.of("key1", "val1", "key2", "val2");      // 不可变 Map
var copy = List.copyOf(mutableList);                    // 防御性拷贝

// 集合收集为不可变
var result = stream.collect(Collectors.toUnmodifiableList());
```

## Optional 使用

```java
// 正确：表达方法可能无返回值
public Optional<User> findByEmail(String email) {
    return Optional.ofNullable(userMap.get(email));
}

// 正确：链式处理
String displayName = findByEmail(email)
    .map(User::displayName)
    .orElse("匿名用户");

// 正确：条件执行
findByEmail(email).ifPresent(user -> sendWelcomeEmail(user));

// 错误：不要用 Optional 作为字段或方法参数
// ❌ private Optional<String> nickname;
// ❌ public void process(Optional<Config> config)

// 错误：不要用 isPresent + get
// ❌ if (opt.isPresent()) { return opt.get(); }
// ✅ return opt.orElseThrow();
```

## Stream API 模式

```java
// 过滤 + 转换 + 收集
List<OrderDTO> activeOrders = orders.stream()
    .filter(Order::isActive)
    .map(order -> new OrderDTO(order.id(), order.total()))
    .toList(); // Java 16+

// 分组
Map<Status, List<Order>> byStatus = orders.stream()
    .collect(Collectors.groupingBy(Order::status));

// 聚合
BigDecimal total = orders.stream()
    .map(Order::amount)
    .reduce(BigDecimal.ZERO, BigDecimal::add);

// flatMap 展平嵌套
List<LineItem> allItems = orders.stream()
    .flatMap(order -> order.items().stream())
    .toList();

// 避免在 Stream 中产生副作用
// ❌ stream.forEach(item -> externalList.add(item));
// ✅ var result = stream.collect(Collectors.toList());
```

## 异常处理

```java
// 自定义异常层次
public sealed class DomainException extends RuntimeException
    permits NotFoundException, ValidationException, ConflictException {

    private final String errorCode;

    protected DomainException(String message, String errorCode) {
        super(message);
        this.errorCode = errorCode;
    }

    public String errorCode() { return errorCode; }
}

public final class NotFoundException extends DomainException {
    public NotFoundException(String resource, String id) {
        super("%s [%s] 未找到".formatted(resource, id), "NOT_FOUND");
    }
}

public final class ValidationException extends DomainException {
    private final List<FieldError> errors;

    public ValidationException(List<FieldError> errors) {
        super("校验失败", "VALIDATION_ERROR");
        this.errors = List.copyOf(errors);
    }
}

// 使用原则：
// - 可恢复的业务错误 → 非受检异常（RuntimeException 子类）
// - 调用方必须处理的 → 受检异常（仅限 I/O 等基础设施层）
// - 编程错误 → IllegalArgumentException / IllegalStateException
```

## Null 安全

```java
// 方法入口校验
public void processOrder(Order order) {
    Objects.requireNonNull(order, "订单不能为空");
    // ...
}

// 使用注解标注意图（配合 IDE 检查）
public @NonNull User findById(@NonNull String id) {
    return Optional.ofNullable(cache.get(id))
        .orElseGet(() -> repository.findById(id)
            .orElseThrow(() -> new NotFoundException("User", id)));
}

// 集合永远不返回 null，返回空集合
public List<Order> findByUser(String userId) {
    // ✅ 返回空 List 而非 null
    return repository.findByUserId(userId);
}
```

## 泛型最佳实践

```java
// PECS 原则：Producer Extends, Consumer Super
public <T> void copy(List<? extends T> source, List<? super T> dest) {
    for (T item : source) {
        dest.add(item);
    }
}

// 类型安全的异构容器
public class TypeSafeRegistry {
    private final Map<Class<?>, Object> map = new ConcurrentHashMap<>();

    public <T> void register(Class<T> type, T instance) {
        map.put(Objects.requireNonNull(type), instance);
    }

    public <T> T get(Class<T> type) {
        return type.cast(map.get(type));
    }
}
```

## 现代 Java 特性（17+）

```java
// 密封类：限制继承层次
public sealed interface Shape permits Circle, Rectangle, Triangle {
    double area();
}

public record Circle(double radius) implements Shape {
    public double area() { return Math.PI * radius * radius; }
}

// 模式匹配（Java 21+）
public String describe(Shape shape) {
    return switch (shape) {
        case Circle c when c.radius() > 10 -> "大圆: r=" + c.radius();
        case Circle c -> "圆: r=" + c.radius();
        case Rectangle r -> "矩形: %dx%d".formatted(r.width(), r.height());
        case Triangle t -> "三角形";
    };
}

// 文本块
String json = """
    {
        "name": "%s",
        "email": "%s",
        "active": true
    }
    """.formatted(name, email);

// instanceof 模式匹配
if (obj instanceof String s && s.length() > 5) {
    System.out.println(s.toUpperCase());
}
```

## 检查清单

- [ ] 数据传输对象使用 `record`，业务实体使用不可变设计
- [ ] 方法返回可选值使用 `Optional`，不返回 null
- [ ] 集合字段和返回值使用不可变集合（`List.of`、`List.copyOf`）
- [ ] 异常层次使用 `sealed` 限制，区分业务异常和系统异常
- [ ] Stream 操作无副作用，终端操作收集结果
- [ ] 泛型遵循 PECS 原则，通配符使 API 更灵活
- [ ] 使用 `Objects.requireNonNull` 在方法入口做前置校验
- [ ] 密封类 + 模式匹配替代 if-else 链和 instanceof 检查
- [ ] 文本块用于多行字符串（SQL、JSON、HTML）
- [ ] 命名遵循 Java 社区惯例，类名名词、方法名动词
- [ ] 代码通过 Checkstyle / SpotBugs 静态分析无警告
