---
name: jpa-patterns
type: capability
package: java
description: JPA/Hibernate 数据访问模式，涵盖实体设计、关系映射、查询优化、N+1 问题与事务管理。
---
# JPA 数据访问模式

## 核心原则

1. **实体即领域模型** — 实体设计反映业务概念，不是数据库表的镜像
2. **延迟加载为默认** — 关联关系默认 LAZY，按需加载
3. **查询优化前置** — 设计阶段就考虑 N+1 问题和查询效率
4. **事务边界清晰** — Service 层管理事务，Repository 层不自行开启事务

## 实体设计

```java
@Entity
@Table(name = "orders")
@EntityListeners(AuditingEntityListener.class)
public class Order {

    // ID 策略：UUID 适合分布式，IDENTITY 适合单库
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false, length = 100)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status = OrderStatus.PENDING;

    // 审计字段
    @CreatedDate
    @Column(updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    @CreatedBy
    @Column(updatable = false)
    private String createdBy;

    // 乐观锁
    @Version
    private Long version;

    // 软删除
    @Column(name = "deleted")
    private boolean deleted = false;

    // 受保护的无参构造器（JPA 要求）
    protected Order() {}

    // 业务构造器
    public Order(String title) {
        this.title = Objects.requireNonNull(title);
    }
}
```

## 关系映射

```java
// OneToMany：父实体管理子集合
@Entity
public class Order {

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();

    // 双向关联的辅助方法
    public void addItem(OrderItem item) {
        items.add(item);
        item.setOrder(this);
    }

    public void removeItem(OrderItem item) {
        items.remove(item);
        item.setOrder(null);
    }
}

@Entity
public class OrderItem {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    private String productId;
    private int quantity;
    private BigDecimal price;
}

// ManyToMany：使用中间实体（推荐，比 @JoinTable 更灵活）
@Entity
public class UserRole {
    @EmbeddedId
    private UserRoleId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("userId")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("roleId")
    private Role role;

    private Instant assignedAt;
}

@Embeddable
public record UserRoleId(String userId, String roleId) implements Serializable {}
```

## 加载策略

```java
// 默认：所有关联 LAZY
@ManyToOne(fetch = FetchType.LAZY)  // 默认 EAGER，必须显式改为 LAZY
private Category category;

@OneToMany(mappedBy = "order", fetch = FetchType.LAZY)  // 默认已是 LAZY
private List<OrderItem> items;

// EntityGraph：按场景选择加载策略
@EntityGraph(attributePaths = {"items", "items.product"})
@Query("SELECT o FROM Order o WHERE o.id = :id")
Optional<Order> findByIdWithItems(@Param("id") String id);

// 命名 EntityGraph
@NamedEntityGraph(
    name = "Order.detail",
    attributeNodes = {
        @NamedAttributeNode("items"),
        @NamedAttributeNode("customer")
    }
)
@Entity
public class Order { /* ... */ }

// 使用命名图
@EntityGraph("Order.detail")
Optional<Order> findDetailById(String id);
```

## N+1 问题解决

```java
// 问题：查询 N 个订单，每个订单触发 1 次 items 查询
List<Order> orders = orderRepository.findAll(); // 1 次查询
orders.forEach(o -> o.getItems().size()); // N 次查询！

// 方案一：JOIN FETCH（JPQL）
@Query("SELECT DISTINCT o FROM Order o JOIN FETCH o.items WHERE o.status = :status")
List<Order> findByStatusWithItems(@Param("status") OrderStatus status);

// 方案二：EntityGraph（见上文）

// 方案三：@BatchSize（Hibernate 特有）
@OneToMany(mappedBy = "order")
@BatchSize(size = 20)  // 批量加载，减少查询次数
private List<OrderItem> items;

// 方案四：子查询加载
@OneToMany(mappedBy = "order")
@Fetch(FetchMode.SUBSELECT)  // 用 IN 子查询一次加载所有
private List<OrderItem> items;
```

## JPQL vs Criteria API

```java
// JPQL：简单查询首选
@Query("""
    SELECT o FROM Order o
    WHERE o.customer.id = :customerId
    AND o.status IN :statuses
    AND o.createdAt >= :since
    ORDER BY o.createdAt DESC
    """)
List<Order> findRecentOrders(
    @Param("customerId") String customerId,
    @Param("statuses") List<OrderStatus> statuses,
    @Param("since") Instant since
);

// Criteria API：动态查询
public List<Order> search(OrderSearchCriteria criteria) {
    CriteriaBuilder cb = entityManager.getCriteriaBuilder();
    CriteriaQuery<Order> query = cb.createQuery(Order.class);
    Root<Order> root = query.from(Order.class);

    List<Predicate> predicates = new ArrayList<>();

    if (criteria.status() != null) {
        predicates.add(cb.equal(root.get("status"), criteria.status()));
    }
    if (criteria.minAmount() != null) {
        predicates.add(cb.greaterThanOrEqualTo(root.get("totalAmount"), criteria.minAmount()));
    }
    if (criteria.keyword() != null) {
        predicates.add(cb.like(cb.lower(root.get("title")),
            "%" + criteria.keyword().toLowerCase() + "%"));
    }

    query.where(predicates.toArray(new Predicate[0]));
    query.orderBy(cb.desc(root.get("createdAt")));

    return entityManager.createQuery(query).getResultList();
}

// Spring Data Specification（推荐替代 Criteria API）
public interface OrderRepository extends JpaSpecificationExecutor<Order> {}

public class OrderSpecs {
    public static Specification<Order> hasStatus(OrderStatus status) {
        return (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    public static Specification<Order> createdAfter(Instant date) {
        return (root, query, cb) -> cb.greaterThan(root.get("createdAt"), date);
    }
}

// 组合使用
var spec = Specification.where(OrderSpecs.hasStatus(ACTIVE))
    .and(OrderSpecs.createdAfter(lastWeek));
orderRepository.findAll(spec, PageRequest.of(0, 20));
```

## 分页

```java
// Spring Data 分页
public interface OrderRepository extends JpaRepository<Order, String> {

    Page<Order> findByStatus(OrderStatus status, Pageable pageable);

    // 带排序的分页
    @Query("SELECT o FROM Order o WHERE o.customer.id = :customerId")
    Page<Order> findByCustomer(@Param("customerId") String customerId, Pageable pageable);
}

// 使用
Page<Order> page = orderRepository.findByStatus(
    OrderStatus.ACTIVE,
    PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "createdAt"))
);

// Slice：不计算总数（性能更好）
Slice<Order> slice = orderRepository.findByStatus(status, pageable);
```

## 投影

```java
// 接口投影：仅查询需要的字段
public interface OrderSummary {
    String getId();
    String getTitle();
    OrderStatus getStatus();
    BigDecimal getTotalAmount();

    @Value("#{target.items.size()}")
    int getItemCount();
}

@Query("SELECT o FROM Order o WHERE o.customer.id = :customerId")
List<OrderSummary> findSummariesByCustomer(@Param("customerId") String customerId);

// DTO 投影（JPQL 构造器表达式）
public record OrderDTO(String id, String title, BigDecimal amount) {}

@Query("""
    SELECT new com.example.dto.OrderDTO(o.id, o.title, o.totalAmount)
    FROM Order o WHERE o.status = :status
    """)
List<OrderDTO> findDTOsByStatus(@Param("status") OrderStatus status);

// 原生查询 + DTO 映射
@Query(value = """
    SELECT o.id, o.title, SUM(i.price * i.quantity) as total
    FROM orders o JOIN order_items i ON o.id = i.order_id
    GROUP BY o.id, o.title
    """, nativeQuery = true)
List<OrderTotalProjection> findOrderTotals();
```

## 事务管理

```java
@Service
@Transactional(readOnly = true) // 类级别：默认只读
public class OrderService {

    // 写操作覆盖为读写事务
    @Transactional
    public Order createOrder(CreateOrderRequest request) {
        var order = new Order(request.title());
        request.items().forEach(item ->
            order.addItem(new OrderItem(item.productId(), item.quantity(), item.price()))
        );
        return orderRepository.save(order);
    }

    // 只读查询：利用 readOnly 优化（Hibernate flush 模式）
    public Optional<Order> findById(String id) {
        return orderRepository.findById(id);
    }

    // 事务传播：REQUIRES_NEW 独立事务
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logAuditEvent(AuditEvent event) {
        auditRepository.save(event);
    }

    // 编程式事务（精细控制）
    public void complexOperation() {
        transactionTemplate.execute(status -> {
            // 操作 1
            // 操作 2
            // 如需回滚：status.setRollbackOnly();
            return null;
        });
    }
}
```

## Hibernate 性能优化

```java
// 1. 批量插入
spring.jpa.properties.hibernate.jdbc.batch_size=50
spring.jpa.properties.hibernate.order_inserts=true
spring.jpa.properties.hibernate.order_updates=true

// 2. 只读查询跳过脏检查
@QueryHints(@QueryHint(name = HINT_READONLY, value = "true"))
List<Order> findByStatus(OrderStatus status);

// 3. 二级缓存（适合读多写少的数据）
@Entity
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
public class Category { /* ... */ }

// 4. 避免 N+1：使用 DTO 投影代替实体加载
// 5. 大批量操作使用 JPQL UPDATE/DELETE
@Modifying
@Query("UPDATE Order o SET o.status = :status WHERE o.createdAt < :before")
int archiveOldOrders(@Param("status") OrderStatus status, @Param("before") Instant before);

// 6. StatelessSession 用于批量导入（跳过一级缓存）
```

## 检查清单

- [ ] 实体 ID 策略明确（UUID 或 IDENTITY），避免 TABLE 策略
- [ ] 所有 `@ManyToOne` 显式设置 `fetch = FetchType.LAZY`
- [ ] 审计字段使用 `@CreatedDate`/`@LastModifiedDate` 自动填充
- [ ] 双向关联提供辅助方法维护一致性
- [ ] 查询使用 EntityGraph 或 JOIN FETCH 解决 N+1 问题
- [ ] 列表查询使用分页，避免全表加载
- [ ] 只需部分字段时使用投影（接口投影或 DTO）
- [ ] Service 层 `@Transactional(readOnly = true)` 为默认，写操作单独标注
- [ ] 批量操作配置 `batch_size`，大批量使用 JPQL 批量语句
- [ ] 乐观锁 `@Version` 防止并发更新丢失
- [ ] 软删除使用 `@Where` 或 `@SQLRestriction` 全局过滤
- [ ] 开发环境开启 SQL 日志，检查查询数量和性能
