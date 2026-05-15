---
name: cpp-testing
type: capability
package: cpp
description: 使用 Google Test 和 Google Mock 进行 C++ 单元测试，涵盖测试夹具、参数化测试、死亡测试、CMake 集成与覆盖率收集。
---

# C++ 测试实践（Google Test / Google Mock）

## 核心原则

1. **快速反馈** — 单元测试应在毫秒级完成，隔离外部依赖
2. **Arrange-Act-Assert** — 每个测试三段式结构清晰
3. **测试行为而非实现** — 关注公共接口的契约
4. **失败信息可读** — 使用有意义的断言消息
5. **测试即文档** — 测试名称描述预期行为

## 基础测试（TEST 宏）

```cpp
#include <gtest/gtest.h>
#include "kq/math/calculator.h"

// TEST(测试套件名, 测试用例名)
TEST(CalculatorTest, AddPositiveNumbers) {
    Calculator calc;
    EXPECT_EQ(calc.add(2, 3), 5);
}

TEST(CalculatorTest, DivideByZeroThrows) {
    Calculator calc;
    EXPECT_THROW(calc.divide(10, 0), std::invalid_argument);
}

// EXPECT vs ASSERT：
// EXPECT_* — 失败后继续执行后续断言
// ASSERT_* — 失败后立即终止当前测试
TEST(StringUtilTest, SplitString) {
    auto parts = split("a,b,c", ',');
    ASSERT_EQ(parts.size(), 3u);  // 后续依赖 size，用 ASSERT
    EXPECT_EQ(parts[0], "a");
    EXPECT_EQ(parts[1], "b");
    EXPECT_EQ(parts[2], "c");
}
```

## 测试夹具（TEST_F）

```cpp
#include <gtest/gtest.h>
#include "kq/db/connection_pool.h"

// 夹具类：共享 setup/teardown 逻辑
class ConnectionPoolTest : public ::testing::Test {
protected:
    void SetUp() override {
        pool_ = std::make_unique<ConnectionPool>(config_);
        pool_->initialize();
    }

    void TearDown() override {
        pool_->shutdown();
    }

    // 辅助方法
    Connection& get_connection() {
        return pool_->acquire();
    }

    PoolConfig config_{.max_size = 5, .timeout = std::chrono::seconds{2}};
    std::unique_ptr<ConnectionPool> pool_;
};

TEST_F(ConnectionPoolTest, AcquireReturnsValidConnection) {
    auto& conn = get_connection();
    EXPECT_TRUE(conn.is_valid());
}

TEST_F(ConnectionPoolTest, ExceedMaxSizeTimesOut) {
    // 耗尽连接池
    std::vector<Connection*> conns;
    for (int i = 0; i < 5; ++i) {
        conns.push_back(&pool_->acquire());
    }
    EXPECT_THROW(pool_->acquire(), TimeoutError);
}
```

## Google Mock（模拟对象）

```cpp
#include <gmock/gmock.h>
#include "kq/net/http_client.h"
#include "kq/service/user_service.h"

// 定义 Mock 类
class MockHttpClient : public IHttpClient {
public:
    MOCK_METHOD(Response, get, (const std::string& url), (override));
    MOCK_METHOD(Response, post, (const std::string& url, const std::string& body), (override));
    MOCK_METHOD(void, set_timeout, (std::chrono::milliseconds ms), (override));
};

using ::testing::Return;
using ::testing::_;
using ::testing::HasSubstr;
using ::testing::Throw;

TEST(UserServiceTest, FetchUserReturnsProfile) {
    MockHttpClient mock_client;
    UserService service(&mock_client);

    // 设置期望：调用 get 时返回预设响应
    EXPECT_CALL(mock_client, get(HasSubstr("/users/42")))
        .Times(1)
        .WillOnce(Return(Response{200, R"({"name":"Alice"})"}));

    auto user = service.fetch_user(42);
    EXPECT_EQ(user.name, "Alice");
}

TEST(UserServiceTest, NetworkErrorRetriesThreeTimes) {
    MockHttpClient mock_client;
    UserService service(&mock_client);

    EXPECT_CALL(mock_client, get(_))
        .Times(3)
        .WillRepeatedly(Throw(NetworkError("timeout")));

    EXPECT_THROW(service.fetch_user(1), ServiceUnavailableError);
}
```

## 参数化测试

```cpp
#include <gtest/gtest.h>
#include "kq/codec/base64.h"

// 值参数化测试
struct Base64TestCase {
    std::string input;
    std::string expected;
};

class Base64EncodeTest : public ::testing::TestWithParam<Base64TestCase> {};

TEST_P(Base64EncodeTest, EncodesCorrectly) {
    auto [input, expected] = GetParam();
    EXPECT_EQ(base64_encode(input), expected);
}

INSTANTIATE_TEST_SUITE_P(
    CommonCases,
    Base64EncodeTest,
    ::testing::Values(
        Base64TestCase{"", ""},
        Base64TestCase{"f", "Zg=="},
        Base64TestCase{"fo", "Zm8="},
        Base64TestCase{"foo", "Zm9v"},
        Base64TestCase{"hello world", "aGVsbG8gd29ybGQ="}
    )
);

// 类型参数化测试：测试多种容器实现
template <typename T>
class ContainerTest : public ::testing::Test {
protected:
    T container_;
};

using ContainerTypes = ::testing::Types<std::vector<int>, std::deque<int>, std::list<int>>;
TYPED_TEST_SUITE(ContainerTest, ContainerTypes);

TYPED_TEST(ContainerTest, EmptyAfterConstruction) {
    EXPECT_TRUE(this->container_.empty());
}
```

## 死亡测试

```cpp
#include <gtest/gtest.h>

// 验证程序在非法输入时正确终止
TEST(SecurityTest, NullPointerCausesAbort) {
    EXPECT_DEATH(process_buffer(nullptr, 100), ".*assertion.*failed.*");
}

// 验证 exit code
TEST(ConfigTest, MissingConfigExitsWithError) {
    EXPECT_EXIT(
        load_config("/nonexistent/path"),
        ::testing::ExitedWithCode(1),
        "配置文件不存在"  // 匹配 stderr 输出
    );
}

// 注意：死亡测试在 Windows 上使用线程安全模式
// 测试套件名以 DeathTest 结尾可获得优先执行
TEST(CriticalDeathTest, StackOverflowDetected) {
    EXPECT_DEATH(infinite_recursion(), "stack overflow");
}
```

## CMake 集成

```cmake
# 引入 Google Test
include(FetchContent)
FetchContent_Declare(googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG v1.14.0
)
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)

enable_testing()

# 测试目标
add_executable(kq_tests
    tests/calculator_test.cpp
    tests/connection_pool_test.cpp
    tests/user_service_test.cpp
)
target_link_libraries(kq_tests PRIVATE
    kq_core
    GTest::gtest_main
    GTest::gmock
)

# 注册到 CTest
include(GoogleTest)
gtest_discover_tests(kq_tests)
```

## 覆盖率收集（gcov / lcov）

```cmake
# CMake 覆盖率配置
option(ENABLE_COVERAGE "启用代码覆盖率" OFF)

if(ENABLE_COVERAGE)
    target_compile_options(kq_core PRIVATE --coverage -fprofile-arcs -ftest-coverage)
    target_link_options(kq_core PRIVATE --coverage)
endif()
```

```bash
# 构建并运行测试
cmake -B build -DENABLE_COVERAGE=ON -DCMAKE_BUILD_TYPE=Debug
cmake --build build
cd build && ctest --output-on-failure

# 收集覆盖率
lcov --capture --directory . --output-file coverage.info
lcov --remove coverage.info '/usr/*' '*/test/*' --output-file coverage_filtered.info
genhtml coverage_filtered.info --output-directory coverage_report

# 设置覆盖率阈值（CI 中使用）
lcov --summary coverage_filtered.info | grep -q "lines.*: [8-9][0-9]\|100"
```

## 测试组织结构

```
project/
├── src/
│   ├── core/
│   │   ├── engine.h
│   │   └── engine.cpp
│   └── net/
│       ├── http_client.h
│       └── http_client.cpp
├── tests/
│   ├── CMakeLists.txt
│   ├── core/
│   │   └── engine_test.cpp      # 与源码目录镜像
│   ├── net/
│   │   └── http_client_test.cpp
│   ├── fixtures/                 # 共享测试数据
│   │   └── sample_config.json
│   └── mocks/                    # 共享 Mock 定义
│       └── mock_http_client.h
└── CMakeLists.txt
```

## 检查清单

- [ ] 每个公共类/函数都有对应的测试文件
- [ ] 使用 `TEST_F` 共享 setup/teardown，避免重复代码
- [ ] Mock 对象通过接口注入，不直接 mock 具体类
- [ ] `EXPECT_CALL` 设置明确的调用次数和参数匹配
- [ ] 参数化测试覆盖边界值和典型场景
- [ ] 测试名称格式：`套件名_行为描述`，可读性优先
- [ ] CMake 使用 `gtest_discover_tests` 自动注册
- [ ] CI 中开启覆盖率，行覆盖率 ≥ 80%
- [ ] 死亡测试验证关键断言和错误退出路径
- [ ] 测试运行时间 < 10 秒（排除集成测试）
