---
name: csharp-testing
type: capability
package: dotnet
description: 使用 xUnit、FluentAssertions、NSubstitute 进行 C# 单元测试与集成测试，涵盖测试组织、WebApplicationFactory 与 AutoFixture。
---

# C# 测试实践

## 核心原则

1. **Arrange-Act-Assert** — 每个测试三段式结构，职责清晰
2. **测试行为而非实现** — 关注输入输出契约，不绑定内部细节
3. **快速隔离** — 单元测试毫秒级完成，外部依赖全部 mock
4. **可读断言** — 使用 FluentAssertions 让失败信息自解释
5. **测试即文档** — 方法名描述场景和预期结果

## xUnit 基础

```csharp
using Xunit;

public class CalculatorTests
{
    // Fact：无参数的单一测试
    [Fact]
    public void Add_TwoPositiveNumbers_ReturnsSum()
    {
        // Arrange
        var calc = new Calculator();

        // Act
        var result = calc.Add(2, 3);

        // Assert
        Assert.Equal(5, result);
    }

    // Theory：参数化测试
    [Theory]
    [InlineData(0, 0, 0)]
    [InlineData(-1, 1, 0)]
    [InlineData(int.MaxValue, 1, int.MinValue)] // 溢出场景
    public void Add_VariousInputs_ReturnsExpected(int a, int b, int expected)
    {
        var calc = new Calculator();
        Assert.Equal(expected, calc.Add(a, b));
    }

    // 从外部数据源加载测试数据
    [Theory]
    [MemberData(nameof(GetDivisionCases))]
    public void Divide_ValidInputs_ReturnsQuotient(decimal a, decimal b, decimal expected)
    {
        var result = new Calculator().Divide(a, b);
        Assert.Equal(expected, result, precision: 4);
    }

    public static IEnumerable<object[]> GetDivisionCases()
    {
        yield return [10m, 2m, 5m];
        yield return [7m, 3m, 2.3333m];
    }
}
```

## FluentAssertions

```csharp
using FluentAssertions;

public class UserServiceTests
{
    [Fact]
    public void GetUser_ExistingId_ReturnsCorrectUser()
    {
        var user = _service.GetById(42);

        // 对象属性断言
        user.Should().NotBeNull();
        user.Name.Should().Be("Alice");
        user.Email.Should().Contain("@").And.EndWith(".com");
        user.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void GetAllUsers_ReturnsFilteredList()
    {
        var users = _service.GetActive();

        // 集合断言
        users.Should().HaveCount(3)
            .And.OnlyContain(u => u.IsActive)
            .And.BeInAscendingOrder(u => u.Name);
    }

    [Fact]
    public void CreateUser_InvalidEmail_ThrowsValidation()
    {
        var act = () => _service.Create(new CreateUserRequest { Email = "invalid" });

        // 异常断言
        act.Should().Throw<ValidationException>()
            .WithMessage("*邮箱格式*")
            .Which.Errors.Should().ContainKey("Email");
    }

    [Fact]
    public async Task FetchData_Timeout_ThrowsWithinLimit()
    {
        // 异步执行时间断言
        var act = () => _service.FetchExternalDataAsync();
        await act.Should().CompleteWithinAsync(TimeSpan.FromSeconds(5));
    }
}
```

## NSubstitute 模拟

```csharp
using NSubstitute;
using NSubstitute.ExceptionExtensions;

public class OrderServiceTests
{
    private readonly IOrderRepository _repo = Substitute.For<IOrderRepository>();
    private readonly IPaymentGateway _payment = Substitute.For<IPaymentGateway>();
    private readonly ILogger<OrderService> _logger = Substitute.For<ILogger<OrderService>>();
    private readonly OrderService _sut;

    public OrderServiceTests()
    {
        _sut = new OrderService(_repo, _payment, _logger);
    }

    [Fact]
    public async Task PlaceOrder_ValidOrder_ChargesAndSaves()
    {
        // Arrange：设置返回值
        var order = new Order { Id = 1, Total = 99.99m };
        _payment.ChargeAsync(Arg.Any<decimal>(), Arg.Any<string>())
            .Returns(new PaymentResult { Success = true, TransactionId = "tx_123" });

        // Act
        await _sut.PlaceOrderAsync(order);

        // Assert：验证调用
        await _payment.Received(1).ChargeAsync(99.99m, Arg.Is<string>(s => s.Contains("order_1")));
        await _repo.Received(1).SaveAsync(Arg.Is<Order>(o => o.Status == OrderStatus.Confirmed));
    }

    [Fact]
    public async Task PlaceOrder_PaymentFails_DoesNotSave()
    {
        _payment.ChargeAsync(Arg.Any<decimal>(), Arg.Any<string>())
            .ThrowsAsync(new PaymentException("余额不足"));

        var act = () => _sut.PlaceOrderAsync(new Order { Total = 1000m });

        await act.Should().ThrowAsync<PaymentException>();
        await _repo.DidNotReceive().SaveAsync(Arg.Any<Order>());
    }
}
```

## 测试夹具（共享上下文）

```csharp
// 集合夹具：跨测试类共享昂贵资源
public class DatabaseFixture : IAsyncLifetime
{
    public AppDbContext DbContext { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        DbContext = new AppDbContext(options);
        await DbContext.Database.EnsureCreatedAsync();
        await SeedTestDataAsync();
    }

    public async Task DisposeAsync() => await DbContext.DisposeAsync();

    private async Task SeedTestDataAsync()
    {
        DbContext.Users.AddRange(TestData.Users);
        await DbContext.SaveChangesAsync();
    }
}

[CollectionDefinition("Database")]
public class DatabaseCollection : ICollectionFixture<DatabaseFixture> { }

[Collection("Database")]
public class UserRepositoryTests(DatabaseFixture fixture)
{
    [Fact]
    public async Task FindByEmail_Exists_ReturnsUser()
    {
        var repo = new UserRepository(fixture.DbContext);
        var user = await repo.FindByEmailAsync("alice@example.com");
        user.Should().NotBeNull();
    }
}
```

## WebApplicationFactory 集成测试

```csharp
public class ApiIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public ApiIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                // 替换真实数据库为内存数据库
                services.RemoveAll<DbContextOptions<AppDbContext>>();
                services.AddDbContext<AppDbContext>(opt =>
                    opt.UseInMemoryDatabase("TestDb"));

                // 替换外部服务为 mock
                services.RemoveAll<IPaymentGateway>();
                services.AddSingleton(Substitute.For<IPaymentGateway>());
            });
        }).CreateClient();
    }

    [Fact]
    public async Task GetUsers_ReturnsOkWithList()
    {
        var response = await _client.GetAsync("/api/users");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var users = await response.Content.ReadFromJsonAsync<List<UserDto>>();
        users.Should().NotBeEmpty();
    }

    [Fact]
    public async Task CreateUser_InvalidBody_ReturnsBadRequest()
    {
        var response = await _client.PostAsJsonAsync("/api/users", new { });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
```

## AutoFixture 测试数据生成

```csharp
using AutoFixture;
using AutoFixture.Xunit2;

public class ProductServiceTests
{
    // 自动生成测试数据
    [Theory, AutoData]
    public void CalculatePrice_AppliesDiscount(Product product, decimal discount)
    {
        var result = PriceCalculator.Calculate(product, discount);
        result.Should().BeLessThan(product.BasePrice);
    }

    // 自定义 Fixture 配置
    [Theory, AutoNSubstituteData]
    public void CreateProduct_ValidInput_Saves(
        [Frozen] IProductRepository repo,  // Frozen = 注入同一实例
        ProductService sut,                 // 自动注入依赖
        CreateProductRequest request)
    {
        sut.Create(request);
        repo.Received(1).Save(Arg.Is<Product>(p => p.Name == request.Name));
    }
}

// 自定义 AutoData 属性
public class AutoNSubstituteDataAttribute : AutoDataAttribute
{
    public AutoNSubstituteDataAttribute()
        : base(() => new Fixture().Customize(new AutoNSubstituteCustomization()))
    { }
}
```

## 测试组织结构

```
tests/
├── Unit/
│   ├── Services/
│   │   ├── UserServiceTests.cs
│   │   └── OrderServiceTests.cs
│   └── Domain/
│       └── MoneyTests.cs
├── Integration/
│   ├── Api/
│   │   └── UsersEndpointTests.cs
│   └── Repositories/
│       └── UserRepositoryTests.cs
├── Shared/
│   ├── Fixtures/
│   │   └── DatabaseFixture.cs
│   ├── Builders/
│   │   └── UserBuilder.cs       # Test Data Builder 模式
│   └── Extensions/
│       └── HttpClientExtensions.cs
└── Directory.Build.props         # 共享包引用
```

## 检查清单

- [ ] 测试方法命名：`方法名_场景_预期结果`
- [ ] 使用 FluentAssertions 替代原生 Assert，提升可读性
- [ ] Mock 对象使用 `[Frozen]` + AutoFixture 自动注入
- [ ] 集成测试使用 `WebApplicationFactory` 替换外部依赖
- [ ] 异步测试使用 `async Task` 而非 `async void`
- [ ] 共享资源通过 `IClassFixture` / `ICollectionFixture` 管理
- [ ] 测试数据使用 Builder 模式或 AutoFixture 生成
- [ ] 每个测试只验证一个行为，避免多重断言
- [ ] CI 中运行 `dotnet test --collect:"XPlat Code Coverage"`
- [ ] 行覆盖率 ≥ 80%，关键业务逻辑 ≥ 95%
