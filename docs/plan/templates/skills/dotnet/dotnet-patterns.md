---
name: dotnet-patterns
type: constraint
package: dotnet
description: C# 与 ASP.NET Core 编码规范，涵盖命名约定、可空引用类型、记录类型、模式匹配、依赖注入、配置管理、日志与 EF Core 基础。
---

# .NET 编码模式与最佳实践

## 核心原则

1. **约定优于配置** — 遵循 .NET 生态的命名和结构约定
2. **依赖注入贯穿始终** — 所有服务通过 DI 容器管理生命周期
3. **不可变优先** — 使用 record 和 init-only 属性表达数据
4. **可空感知** — 启用 nullable reference types，消除 NullReferenceException
5. **异步到底** — I/O 操作全链路 async/await，不阻塞线程

## 命名约定

```csharp
// 命名空间：PascalCase，与目录结构对应
namespace KqForge.Core.Services;

// 接口：I 前缀
public interface IUserRepository { }

// 类、记录、枚举：PascalCase
public class UserService { }
public record UserDto(string Name, string Email);
public enum OrderStatus { Pending, Confirmed, Shipped }

// 方法与属性：PascalCase
public async Task<User> GetByIdAsync(int id);
public string FullName { get; init; }

// 参数与局部变量：camelCase
public void Process(string userName, int retryCount) { }

// 私有字段：_camelCase
private readonly ILogger<UserService> _logger;
private int _connectionCount;

// 常量：PascalCase
public const int MaxRetryAttempts = 3;
```

## 可空引用类型

```csharp
// 在 .csproj 中启用
// <Nullable>enable</Nullable>

// 明确表达可空性
public class UserProfile
{
    public required string Name { get; init; }      // 必填
    public string? Bio { get; set; }                // 可空
    public string Email { get; init; } = string.Empty;

    // 使用模式匹配安全处理可空值
    public string GetDisplayName() => Bio switch
    {
        null or "" => Name,
        var bio => $"{Name} - {bio}"
    };
}

// 空值传播与合并运算符
string city = user?.Address?.City ?? "未知";

// 参数校验
public void Register(string name)
{
    ArgumentNullException.ThrowIfNull(name);
    ArgumentException.ThrowIfNullOrWhiteSpace(name);
}
```

## 记录类型与模式匹配

```csharp
// record：不可变值对象，自带相等性比较
public record Money(decimal Amount, string Currency)
{
    public Money Add(Money other)
    {
        if (Currency != other.Currency)
            throw new InvalidOperationException("货币类型不匹配");
        return this with { Amount = Amount + other.Amount };
    }
}

// 模式匹配：替代复杂 if-else
public decimal CalculateDiscount(Order order) => order switch
{
    { Total: > 1000, Customer.IsVip: true } => order.Total * 0.2m,
    { Total: > 500 } => order.Total * 0.1m,
    { Items.Count: > 10 } => order.Total * 0.05m,
    _ => 0m
};

// 列表模式（C# 11）
public string Classify(int[] values) => values switch
{
    [] => "空数组",
    [var single] => $"单元素: {single}",
    [var first, .., var last] => $"首: {first}, 尾: {last}"
};
```

## ASP.NET Core Minimal API

```csharp
var builder = WebApplication.CreateBuilder(args);

// 注册服务
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

var app = builder.Build();

// 路由分组
var users = app.MapGroup("/api/users")
    .RequireAuthorization()
    .WithTags("Users");

users.MapGet("/", async (IUserService svc) =>
    Results.Ok(await svc.GetAllAsync()));

users.MapGet("/{id:int}", async (int id, IUserService svc) =>
    await svc.GetByIdAsync(id) is { } user
        ? Results.Ok(user)
        : Results.NotFound());

users.MapPost("/", async (CreateUserRequest req, IUserService svc) =>
{
    var user = await svc.CreateAsync(req);
    return Results.Created($"/api/users/{user.Id}", user);
}).WithValidation<CreateUserRequest>();

app.Run();
```

## 中间件与管道

```csharp
// 自定义中间件
public class RequestTimingMiddleware(RequestDelegate next, ILogger<RequestTimingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            await next(context);
        }
        finally
        {
            sw.Stop();
            logger.LogInformation("请求 {Method} {Path} 耗时 {Elapsed}ms",
                context.Request.Method, context.Request.Path, sw.ElapsedMilliseconds);
        }
    }
}

// 注册顺序很重要
app.UseMiddleware<RequestTimingMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
```

## Options 模式配置

```csharp
// 配置类
public class SmtpOptions
{
    public const string SectionName = "Smtp";
    public required string Host { get; init; }
    public int Port { get; init; } = 587;
    public required string Username { get; init; }
    public required string Password { get; init; }
}

// 注册与验证
builder.Services.AddOptions<SmtpOptions>()
    .BindConfiguration(SmtpOptions.SectionName)
    .ValidateDataAnnotations()
    .ValidateOnStart();

// 注入使用
public class EmailService(IOptions<SmtpOptions> options)
{
    private readonly SmtpOptions _smtp = options.Value;
}
```

## 日志（ILogger + Serilog）

```csharp
// 结构化日志：使用模板而非字符串插值
_logger.LogInformation("用户 {UserId} 登录成功，IP: {IpAddress}", userId, ip);
_logger.LogWarning("重试第 {Attempt}/{MaxAttempts} 次", attempt, maxAttempts);

// Serilog 配置
builder.Host.UseSerilog((ctx, cfg) => cfg
    .ReadFrom.Configuration(ctx.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.Seq("http://localhost:5341"));
```

## Entity Framework Core 基础

```csharp
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Order> Orders => Set<Order>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}

// 实体配置分离
public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(u => u.Id);
        builder.Property(u => u.Email).HasMaxLength(256).IsRequired();
        builder.HasIndex(u => u.Email).IsUnique();
        builder.HasMany(u => u.Orders).WithOne(o => o.User);
    }
}

// Repository 模式
public class UserRepository(AppDbContext db) : IUserRepository
{
    public async Task<User?> GetByIdAsync(int id, CancellationToken ct = default)
        => await db.Users
            .Include(u => u.Orders)
            .FirstOrDefaultAsync(u => u.Id == id, ct);
}
```

## 检查清单

- [ ] 启用 `<Nullable>enable</Nullable>` 并消除所有警告
- [ ] 使用 `record` 表达 DTO 和值对象
- [ ] 所有 I/O 方法使用 async/await 并接受 `CancellationToken`
- [ ] 服务通过 DI 注入，不使用 `new` 创建服务实例
- [ ] 配置使用 Options 模式 + `ValidateOnStart()`
- [ ] 日志使用结构化模板，不使用字符串插值
- [ ] EF Core 实体配置独立为 `IEntityTypeConfiguration`
- [ ] API 端点返回适当的 HTTP 状态码和 Problem Details
- [ ] 中间件按正确顺序注册（异常处理 → 认证 → 授权 → 路由）
- [ ] 使用 `ArgumentNullException.ThrowIfNull` 进行参数校验
