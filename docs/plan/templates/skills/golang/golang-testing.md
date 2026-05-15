---
name: golang-testing
type: capability
package: golang
description: Go 测试全流程指南，涵盖表驱动测试、Mock、HTTP 测试、集成测试、基准测试与模糊测试。
---
# Go 测试实践指南

## 核心原则

1. **测试是文档** — 测试用例应清晰表达被测行为的预期
2. **快速反馈** — 单元测试必须毫秒级完成，慢测试用 `testing.Short()` 跳过
3. **隔离性** — 每个测试独立运行，不依赖执行顺序或共享状态
4. **可重复性** — 测试结果不受时间、网络、文件系统等外部因素影响

## 表驱动测试

```go
func TestParseURL(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        want    *URL
        wantErr bool
    }{
        {
            name:  "完整URL",
            input: "https://example.com/path?q=1",
            want:  &URL{Scheme: "https", Host: "example.com", Path: "/path"},
        },
        {
            name:    "空字符串",
            input:   "",
            wantErr: true,
        },
        {
            name:    "无效格式",
            input:   "://broken",
            wantErr: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := ParseURL(tt.input)
            if tt.wantErr {
                require.Error(t, err)
                return
            }
            require.NoError(t, err)
            assert.Equal(t, tt.want.Scheme, got.Scheme)
            assert.Equal(t, tt.want.Host, got.Host)
        })
    }
}
```

## 子测试与并行

```go
func TestUserService(t *testing.T) {
    // 子测试分组
    t.Run("Create", func(t *testing.T) {
        t.Parallel() // 标记可并行执行

        t.Run("成功创建", func(t *testing.T) {
            t.Parallel()
            // ...
        })

        t.Run("邮箱重复", func(t *testing.T) {
            t.Parallel()
            // ...
        })
    })
}
```

## 测试辅助函数

```go
// 辅助函数使用 t.Helper() 标记，错误堆栈指向调用方
func newTestDB(t *testing.T) *sql.DB {
    t.Helper()
    db, err := sql.Open("sqlite3", ":memory:")
    require.NoError(t, err)
    t.Cleanup(func() { db.Close() }) // 自动清理
    return db
}

func mustLoadFixture(t *testing.T, path string) []byte {
    t.Helper()
    data, err := os.ReadFile(filepath.Join("testdata", path))
    require.NoError(t, err)
    return data
}
```

## testify 断言

```go
import (
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestAssertions(t *testing.T) {
    // assert: 失败后继续执行
    assert.Equal(t, expected, actual)
    assert.Contains(t, "hello world", "world")
    assert.Len(t, slice, 3)
    assert.ErrorIs(t, err, ErrNotFound)
    assert.ErrorAs(t, err, &validationErr)

    // require: 失败后立即终止当前测试
    require.NoError(t, err) // 后续代码依赖 err == nil 时使用
    require.NotNil(t, result)
}
```

## Mock（接口 + testify/mock）

```go
// 定义接口
type EmailSender interface {
    Send(ctx context.Context, to, subject, body string) error
}

// 生成 Mock（或手写）
type MockEmailSender struct {
    mock.Mock
}

func (m *MockEmailSender) Send(ctx context.Context, to, subject, body string) error {
    args := m.Called(ctx, to, subject, body)
    return args.Error(0)
}

// 在测试中使用
func TestNotifyUser(t *testing.T) {
    sender := new(MockEmailSender)
    sender.On("Send", mock.Anything, "user@test.com", "欢迎", mock.Anything).
        Return(nil)

    svc := NewNotificationService(sender)
    err := svc.NotifyUser(context.Background(), "user@test.com")

    require.NoError(t, err)
    sender.AssertExpectations(t) // 验证 Mock 被正确调用
}
```

## HTTP 处理器测试

```go
func TestGetUserHandler(t *testing.T) {
    // 准备
    svc := &MockUserService{}
    svc.On("GetByID", mock.Anything, "123").
        Return(&User{ID: "123", Name: "张三"}, nil)

    handler := NewUserHandler(svc)

    // 构造请求
    req := httptest.NewRequest(http.MethodGet, "/users/123", nil)
    req.SetPathValue("id", "123") // Go 1.22+ 路由参数
    rec := httptest.NewRecorder()

    // 执行
    handler.GetUser(rec, req)

    // 断言
    assert.Equal(t, http.StatusOK, rec.Code)

    var resp User
    err := json.NewDecoder(rec.Body).Decode(&resp)
    require.NoError(t, err)
    assert.Equal(t, "张三", resp.Name)
}
```

## 集成测试（testcontainers）

```go
//go:build integration

func TestPostgresRepository(t *testing.T) {
    ctx := context.Background()

    // 启动 PostgreSQL 容器
    container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
        ContainerRequest: testcontainers.ContainerRequest{
            Image:        "postgres:16-alpine",
            ExposedPorts: []string{"5432/tcp"},
            Env: map[string]string{
                "POSTGRES_PASSWORD": "test",
                "POSTGRES_DB":       "testdb",
            },
            WaitingFor: wait.ForListeningPort("5432/tcp"),
        },
        Started: true,
    })
    require.NoError(t, err)
    t.Cleanup(func() { container.Terminate(ctx) })

    // 获取连接地址
    host, _ := container.Host(ctx)
    port, _ := container.MappedPort(ctx, "5432")
    dsn := fmt.Sprintf("postgres://postgres:test@%s:%s/testdb?sslmode=disable", host, port.Port())

    // 执行测试
    db, err := sql.Open("pgx", dsn)
    require.NoError(t, err)

    repo := NewPostgresUserRepo(db)
    // ... 测试 CRUD 操作
}
```

## 基准测试

```go
func BenchmarkJSONMarshal(b *testing.B) {
    data := &LargeStruct{/* ... */}

    b.ResetTimer() // 排除初始化时间
    b.ReportAllocs() // 报告内存分配

    for i := 0; i < b.N; i++ {
        _, err := json.Marshal(data)
        if err != nil {
            b.Fatal(err)
        }
    }
}

// 运行: go test -bench=BenchmarkJSONMarshal -benchmem ./...
```

## 模糊测试

```go
func FuzzParseConfig(f *testing.F) {
    // 提供种子语料
    f.Add([]byte(`{"port": 8080}`))
    f.Add([]byte(`{}`))
    f.Add([]byte(`invalid`))

    f.Fuzz(func(t *testing.T, data []byte) {
        cfg, err := ParseConfig(data)
        if err != nil {
            return // 解析失败是合法的
        }
        // 不变量检查：解析成功后端口必须合法
        if cfg.Port < 0 || cfg.Port > 65535 {
            t.Errorf("非法端口: %d", cfg.Port)
        }
    })
}

// 运行: go test -fuzz=FuzzParseConfig -fuzztime=30s
```

## 测试覆盖率

```bash
# 生成覆盖率报告
go test -coverprofile=coverage.out ./...

# 查看 HTML 报告
go tool cover -html=coverage.out -o coverage.html

# 按函数查看覆盖率
go tool cover -func=coverage.out
```

## Golden Files 模式

```go
var update = flag.Bool("update", false, "更新 golden files")

func TestRenderTemplate(t *testing.T) {
    result := RenderTemplate(inputData)

    golden := filepath.Join("testdata", t.Name()+".golden")

    if *update {
        os.WriteFile(golden, []byte(result), 0644)
        return
    }

    expected, err := os.ReadFile(golden)
    require.NoError(t, err)
    assert.Equal(t, string(expected), result)
}

// 更新: go test -run TestRenderTemplate -update
```

## 检查清单

- [ ] 每个公开函数都有对应的表驱动测试
- [ ] 测试用例覆盖正常路径、边界条件和错误路径
- [ ] Mock 仅用于外部依赖（数据库、HTTP、消息队列），不 Mock 内部逻辑
- [ ] 辅助函数使用 `t.Helper()` 标记
- [ ] 资源清理使用 `t.Cleanup()` 而非手动 defer
- [ ] 集成测试使用 build tag 隔离（`//go:build integration`）
- [ ] HTTP 测试使用 `httptest.NewServer` 或 `httptest.NewRecorder`
- [ ] 基准测试使用 `b.ResetTimer()` 排除初始化开销
- [ ] 覆盖率达到 80% 以上（核心业务逻辑 90%+）
- [ ] CI 中运行 `go test -race ./...` 检测数据竞争
- [ ] 测试数据放在 `testdata/` 目录下
- [ ] 模糊测试覆盖所有解析/反序列化入口
