---
name: cpp-coding-standards
type: constraint
package: cpp
description: 现代 C++（17/20）编码规范，涵盖 RAII、智能指针、移动语义、const 正确性、命名约定、头文件组织与 CMake 基础。
---

# C++ 编码规范与最佳实践

## 核心原则

1. **RAII 管理资源** — 资源获取即初始化，析构即释放，杜绝手动 new/delete
2. **值语义优先** — 优先使用值类型和移动语义，减少堆分配
3. **const 正确性** — 能加 const 就加 const，编译器帮你守护不变性
4. **零成本抽象** — 利用模板和 constexpr 在编译期完成计算
5. **最小暴露原则** — 头文件只暴露必要接口，实现细节留在 .cpp

## 命名约定

```cpp
// 命名空间：小写下划线
namespace kq_forge::core {

// 类型：PascalCase
class HttpClient {};
struct RequestConfig {};
enum class LogLevel { kDebug, kInfo, kWarning, kError };

// 函数与方法：snake_case 或 camelCase（项目统一即可）
void process_request(const Request& req);
int calculate_checksum(std::span<const std::byte> data);

// 成员变量：尾部下划线
class Connection {
private:
    std::string host_;
    int port_;
    bool connected_ = false;
};

// 常量与枚举值：k 前缀 + PascalCase
constexpr int kMaxRetries = 3;
constexpr auto kDefaultTimeout = std::chrono::seconds{30};

} // namespace kq_forge::core
```

## 智能指针使用

```cpp
#include <memory>

// unique_ptr：独占所有权，零开销
auto widget = std::make_unique<Widget>("button", Size{100, 50});

// shared_ptr：共享所有权，引用计数
auto config = std::make_shared<AppConfig>();

// weak_ptr：打破循环引用，观察但不拥有
class Observer {
    std::weak_ptr<Subject> subject_;
public:
    void notify() {
        if (auto s = subject_.lock()) {
            s->update();
        }
    }
};

// 工厂函数返回 unique_ptr
std::unique_ptr<Transport> create_transport(Protocol proto) {
    switch (proto) {
        case Protocol::kTcp: return std::make_unique<TcpTransport>();
        case Protocol::kUdp: return std::make_unique<UdpTransport>();
    }
}

// 禁止：裸 new/delete、auto_ptr、void* 管理生命周期
```

## 移动语义

```cpp
class Buffer {
    std::vector<std::byte> data_;
public:
    // 移动构造：窃取资源，源对象置空
    Buffer(Buffer&& other) noexcept
        : data_(std::move(other.data_)) {}

    // 移动赋值
    Buffer& operator=(Buffer&& other) noexcept {
        if (this != &other) {
            data_ = std::move(other.data_);
        }
        return *this;
    }

    // 按值传入 + move：兼顾左值拷贝和右值移动
    void set_data(std::vector<std::byte> new_data) {
        data_ = std::move(new_data);
    }
};

// 返回值优化（RVO）：直接返回局部对象，不要 std::move
std::string build_message(std::string_view prefix, int code) {
    std::string result{prefix};
    result += ": " + std::to_string(code);
    return result;  // RVO，不要写 return std::move(result)
}
```

## const 正确性

```cpp
class DataStore {
    std::vector<Record> records_;
public:
    // const 方法：不修改对象状态
    [[nodiscard]] size_t size() const noexcept { return records_.size(); }

    // 返回 const 引用：防止外部修改内部数据
    [[nodiscard]] const Record& at(size_t idx) const { return records_.at(idx); }

    // const 参数：表明不会修改传入对象
    void insert(const Record& record) { records_.push_back(record); }

    // string_view 替代 const string&：避免不必要的分配
    [[nodiscard]] std::optional<Record> find(std::string_view key) const;
};

// constexpr：编译期计算
constexpr int factorial(int n) {
    return n <= 1 ? 1 : n * factorial(n - 1);
}
static_assert(factorial(5) == 120);
```

## 头文件组织

```cpp
// widget.h — 公共接口头文件
#pragma once  // 或传统 include guard

#include <string>       // 标准库头文件
#include <memory>

#include "kq/core/types.h"  // 项目内部头文件

// 前向声明减少编译依赖
namespace kq::render { class Canvas; }

namespace kq::ui {

class Widget {
public:
    explicit Widget(std::string name);  // explicit 防止隐式转换
    ~Widget();

    void draw(render::Canvas& canvas) const;
    [[nodiscard]] std::string_view name() const noexcept;

private:
    struct Impl;                    // Pimpl 隐藏实现
    std::unique_ptr<Impl> impl_;
};

} // namespace kq::ui
```

## CMake 基础

```cmake
cmake_minimum_required(VERSION 3.20)
project(kq-forge LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# 库目标
add_library(kq_core
    src/core/engine.cpp
    src/core/config.cpp
)
target_include_directories(kq_core PUBLIC include)
target_compile_options(kq_core PRIVATE
    $<$<CXX_COMPILER_ID:GNU,Clang>:-Wall -Wextra -Wpedantic>
    $<$<CXX_COMPILER_ID:MSVC>:/W4>
)

# 依赖管理（FetchContent）
include(FetchContent)
FetchContent_Declare(fmt
    GIT_REPOSITORY https://github.com/fmtlib/fmt.git
    GIT_TAG 10.1.1
)
FetchContent_MakeAvailable(fmt)
target_link_libraries(kq_core PRIVATE fmt::fmt)
```

## 常见陷阱

```cpp
// 陷阱1：悬垂引用 — string_view 指向临时对象
std::string_view bad_view() {
    std::string temp = "hello";
    return temp;  // 错误！temp 析构后 view 悬垂
}

// 陷阱2：切片问题 — 按值传递多态对象
void process(Base obj);  // 错误：派生类信息丢失
void process(const Base& obj);  // 正确：保留多态

// 陷阱3：未标记 noexcept 的移动操作
// vector 扩容时不会使用可能抛异常的移动构造
Buffer(Buffer&&) noexcept;  // 务必加 noexcept

// 陷阱4：头文件中 using namespace
// 永远不要在头文件中写 using namespace std;

// 陷阱5：忘记虚析构函数
class Base {
public:
    virtual ~Base() = default;  // 有虚函数就要虚析构
    virtual void execute() = 0;
};
```

## 检查清单

- [ ] 所有资源通过 RAII 管理，无裸 new/delete
- [ ] 使用 `unique_ptr` 表达独占所有权，`shared_ptr` 仅在真正共享时使用
- [ ] 移动构造/赋值标记 `noexcept`
- [ ] 所有不修改状态的方法标记 `const`
- [ ] 使用 `[[nodiscard]]` 标记不应忽略返回值的函数
- [ ] 头文件使用 `#pragma once`，最小化 include
- [ ] 使用前向声明减少编译依赖
- [ ] 单参数构造函数标记 `explicit`
- [ ] CMake 目标设置 C++17/20 标准，开启高警告级别
- [ ] 编译通过 `-Wall -Wextra -Wpedantic`（GCC/Clang）或 `/W4`（MSVC）
