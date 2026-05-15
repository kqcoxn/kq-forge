---
name: golang-patterns
type: constraint
package: golang
description: 构建健壮、高效且可维护的 Go 应用程序的惯用模式、项目布局与并发最佳实践。
---
# Go 惯用模式与最佳实践

## 核心原则

1. **简洁胜于巧妙** — 代码应当直白易读，避免过度抽象
2. **组合优于继承** — 通过接口和嵌入实现代码复用
3. **显式优于隐式** — 错误处理、依赖注入均应显式声明
4. **并发是工具而非目标** — 仅在确有需要时引入 goroutine

## 项目布局

```
myapp/
├── cmd/
│   └── myapp/          # 入口点，仅负责组装依赖并启动
│       └── main.go
├── internal/           # 私有包，外部不可导入
│   ├── domain/         # 领域模型与业务逻辑
│   ├── service/        # 应用服务层
│   ├── repository/     # 数据访问层
│   └── handler/        # HTTP/gRPC 处理器
├── pkg/                # 可被外部项目复用的公共库
├── config/             # 配置文件与加载逻辑
├── migrations/         # 数据库迁移脚本
├── go.mod
└── go.sum
```

- `cmd/` 下每个子目录对应一个可执行文件
- `internal/` 利用 Go 编译器强制私有性
- `pkg/` 仅放置真正通用的工具代码

## 命名规范

```go
// 包名：小写单词，不用下划线或驼峰
package userrepo

// 接口命名：动词+er 后缀（单方法接口）
type Reader interface {
    Read(ctx context.Context, id string) (*User, error)
}

// 导出函数：大写开头，动词短语
func NewUserService(repo UserRepository) *UserService { ... }

// 未导出辅助函数：小写开头
func validateEmail(email string) error { ... }

// 常量：使用 MixedCaps，不用 ALL_CAPS
const MaxRetryCount = 3
```

## 错误处理

```go
// 使用 %w 包装错误以保留错误链
func (s *UserService) GetUser(ctx context.Context, id string) (*User, error) {
    user, err := s.repo.FindByID(ctx, id)
    if err != nil {
        return nil, fmt.Errorf("获取用户 %s: %w", id, err)
    }
    return user, nil
}

// 定义哨兵错误用于类型判断
var ErrNotFound = errors.New("资源未找到")

// 调用方使用 errors.Is / errors.As 判断
if errors.Is(err, ErrNotFound) {
    // 处理 404
}

// 自定义错误类型携带上下文
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("字段 %s 校验失败: %s", e.Field, e.Message)
}
```

## defer 使用

```go
func ReadFile(path string) ([]byte, error) {
    f, err := os.Open(path)
    if err != nil {
        return nil, err
    }
    defer f.Close() // 确保资源释放

    return io.ReadAll(f)
}

// 注意：defer 中的错误也应处理
func WriteData(w io.WriteCloser, data []byte) error {
    defer func() {
        if cerr := w.Close(); cerr != nil {
            log.Printf("关闭写入器失败: %v", cerr)
        }
    }()
    _, err := w.Write(data)
    return err
}
```

## 接口与组合

```go
// 接口应小而精，由消费方定义
type OrderRepository interface {
    Save(ctx context.Context, order *Order) error
    FindByID(ctx context.Context, id string) (*Order, error)
}

// 通过嵌入组合能力
type ReadWriteCloser interface {
    io.Reader
    io.Writer
    io.Closer
}

// 结构体嵌入实现复用（非继承）
type BaseService struct {
    logger *slog.Logger
}

type OrderService struct {
    BaseService // 嵌入，获得 logger 字段
    repo OrderRepository
}
```

## 并发模式

```go
// 使用 errgroup 管理并发任务
func FetchAll(ctx context.Context, urls []string) ([]Response, error) {
    g, ctx := errgroup.WithContext(ctx)
    results := make([]Response, len(urls))

    for i, url := range urls {
        i, url := i, url // 捕获循环变量（Go 1.22 前需要）
        g.Go(func() error {
            resp, err := fetch(ctx, url)
            if err != nil {
                return err
            }
            results[i] = resp
            return nil
        })
    }

    if err := g.Wait(); err != nil {
        return nil, err
    }
    return results, nil
}

// 使用 channel 做扇入
func merge(channels ...<-chan int) <-chan int {
    var wg sync.WaitGroup
    out := make(chan int)

    for _, ch := range channels {
        wg.Add(1)
        go func(c <-chan int) {
            defer wg.Done()
            for v := range c {
                out <- v
            }
        }(ch)
    }

    go func() {
        wg.Wait()
        close(out)
    }()
    return out
}

// sync.Once 用于延迟初始化
var (
    dbOnce sync.Once
    dbConn *sql.DB
)

func GetDB() *sql.DB {
    dbOnce.Do(func() {
        dbConn = mustConnect()
    })
    return dbConn
}
```

## Context 传播

```go
// context 始终作为第一个参数传递
func (s *Service) Process(ctx context.Context, req *Request) error {
    // 设置超时
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()

    // 传递给下游调用
    result, err := s.client.Call(ctx, req.Payload)
    if err != nil {
        return err
    }

    // 检查取消信号
    select {
    case <-ctx.Done():
        return ctx.Err()
    default:
        return s.save(ctx, result)
    }
}
```

## 依赖注入（无框架）

```go
// 通过构造函数注入依赖
type UserService struct {
    repo   UserRepository
    cache  Cache
    logger *slog.Logger
}

func NewUserService(repo UserRepository, cache Cache, logger *slog.Logger) *UserService {
    return &UserService{repo: repo, cache: cache, logger: logger}
}

// 在 main 中手动组装（wire 可选）
func main() {
    logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
    db := mustOpenDB()
    repo := repository.NewPostgresUserRepo(db)
    cache := redis.NewCache(redisClient)
    svc := service.NewUserService(repo, cache, logger)
    handler := handler.NewUserHandler(svc)
    // ...
}
```

## 配置模式

```go
// 使用结构体 + 环境变量加载
type Config struct {
    Server   ServerConfig   `yaml:"server"`
    Database DatabaseConfig `yaml:"database"`
}

type ServerConfig struct {
    Port         int           `yaml:"port" env:"SERVER_PORT" envDefault:"8080"`
    ReadTimeout  time.Duration `yaml:"read_timeout" env:"SERVER_READ_TIMEOUT" envDefault:"5s"`
    WriteTimeout time.Duration `yaml:"write_timeout" env:"SERVER_WRITE_TIMEOUT" envDefault:"10s"`
}

// 函数选项模式用于可选配置
type Option func(*Server)

func WithPort(port int) Option {
    return func(s *Server) { s.port = port }
}

func WithLogger(l *slog.Logger) Option {
    return func(s *Server) { s.logger = l }
}

func NewServer(opts ...Option) *Server {
    s := &Server{port: 8080, logger: slog.Default()}
    for _, opt := range opts {
        opt(s)
    }
    return s
}
```

## 表驱动测试（简要）

```go
func TestAdd(t *testing.T) {
    tests := []struct {
        name     string
        a, b     int
        expected int
    }{
        {"正数相加", 1, 2, 3},
        {"负数相加", -1, -2, -3},
        {"零值", 0, 0, 0},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := Add(tt.a, tt.b)
            assert.Equal(t, tt.expected, got)
        })
    }
}
```

## 检查清单

- [ ] 所有导出函数都有 godoc 注释
- [ ] 错误使用 `%w` 包装并提供上下文信息
- [ ] 接口定义在消费方包中，保持小接口（1-3 个方法）
- [ ] goroutine 有明确的退出机制（context 取消或 channel 关闭）
- [ ] 所有 I/O 操作接受 `context.Context` 作为第一个参数
- [ ] 使用 `defer` 确保资源释放
- [ ] 项目遵循 `cmd/internal/pkg` 布局
- [ ] 并发访问共享状态使用 `sync.Mutex` 或 channel 保护
- [ ] 配置通过结构体加载，支持环境变量覆盖
- [ ] 依赖通过构造函数注入，不使用全局变量
- [ ] 命名遵循 Go 社区惯例（MixedCaps、短变量名、-er 接口）
- [ ] `go vet` 和 `golangci-lint` 无警告
