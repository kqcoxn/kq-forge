---
name: rust-testing
type: capability
package: rust
description: Rust 测试全流程指南，涵盖单元测试、集成测试、Mock、异步测试、属性测试与覆盖率。
---
# Rust 测试实践指南

## 核心原则

1. **编译器是第一道防线** — 测试补充类型系统无法覆盖的业务逻辑
2. **测试即规格说明** — 测试用例描述模块的行为契约
3. **快速且确定** — 单元测试不依赖外部服务，毫秒级完成
4. **分层测试** — 单元测试验证逻辑，集成测试验证交互

## 单元测试

```rust
// 在同一文件底部定义测试模块
pub fn divide(a: f64, b: f64) -> Result<f64, MathError> {
    if b == 0.0 {
        return Err(MathError::DivisionByZero);
    }
    Ok(a / b)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_divide_normal() {
        let result = divide(10.0, 2.0).unwrap();
        assert!((result - 5.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_divide_by_zero() {
        let result = divide(10.0, 0.0);
        assert!(matches!(result, Err(MathError::DivisionByZero)));
    }

    #[test]
    #[should_panic(expected = "索引越界")]
    fn test_out_of_bounds() {
        let v = vec![1, 2, 3];
        let _ = v[10]; // panic
    }

    #[test]
    fn test_result_based() -> Result<(), Box<dyn std::error::Error>> {
        let config = parse_config("valid = true")?;
        assert_eq!(config.valid, true);
        Ok(())
    }
}
```

## 集成测试

```
project/
├── src/
│   └── lib.rs
├── tests/              # 集成测试目录
│   ├── common/         # 共享辅助模块
│   │   └── mod.rs
│   ├── api_test.rs     # 每个文件是独立的 crate
│   └── db_test.rs
```

```rust
// tests/api_test.rs
use myapp::{Config, App};

mod common;

#[test]
fn test_full_workflow() {
    let app = common::setup_test_app();

    let user = app.create_user("test@example.com").unwrap();
    let fetched = app.get_user(&user.id).unwrap();

    assert_eq!(user.email, fetched.email);
}
```

```rust
// tests/common/mod.rs
use myapp::{App, Config};

pub fn setup_test_app() -> App {
    let config = Config {
        database_url: "sqlite::memory:".into(),
        ..Config::default()
    };
    App::new(config).unwrap()
}
```

## 断言技巧

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_assertions() {
        // 基本断言
        assert_eq!(add(1, 2), 3);
        assert_ne!(add(1, 2), 4);

        // 带自定义消息
        assert_eq!(result, expected, "用户 {} 的余额不正确", user_id);

        // 模式匹配断言
        assert!(matches!(status, Status::Active | Status::Pending));

        // 浮点比较
        assert!((result - 3.14).abs() < 1e-10);

        // 集合断言
        let items = vec![1, 2, 3];
        assert!(items.contains(&2));
        assert_eq!(items.len(), 3);
    }

    // 使用 assert_matches!（nightly 或 assert_matches crate）
    #[test]
    fn test_pattern_matching() {
        let result = parse("hello");
        assert_matches!(result, Ok(Token::Word(w)) if w == "hello");
    }
}
```

## Mock（mockall）

```rust
use mockall::automock;

// 为 trait 生成 mock
#[automock]
pub trait UserRepository {
    fn find_by_id(&self, id: &str) -> Result<User, RepoError>;
    fn save(&self, user: &User) -> Result<(), RepoError>;
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockall::predicate::*;

    #[test]
    fn test_user_service_get() {
        let mut mock_repo = MockUserRepository::new();

        // 设置期望
        mock_repo
            .expect_find_by_id()
            .with(eq("user-123"))
            .times(1)
            .returning(|_| Ok(User {
                id: "user-123".into(),
                name: "张三".into(),
            }));

        let service = UserService::new(Box::new(mock_repo));
        let user = service.get_user("user-123").unwrap();

        assert_eq!(user.name, "张三");
    }

    #[test]
    fn test_save_called_with_correct_data() {
        let mut mock_repo = MockUserRepository::new();

        mock_repo
            .expect_save()
            .withf(|user| user.name == "李四" && !user.id.is_empty())
            .times(1)
            .returning(|_| Ok(()));

        let service = UserService::new(Box::new(mock_repo));
        service.create_user("李四").unwrap();
    }
}
```

## 异步测试

```rust
// 使用 tokio::test 宏
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_async_fetch() {
        let client = HttpClient::new();
        let response = client.get("https://httpbin.org/get").await.unwrap();
        assert_eq!(response.status(), 200);
    }

    // 带超时的异步测试
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn test_concurrent_operations() {
        let (tx, mut rx) = tokio::sync::mpsc::channel(10);

        tokio::spawn(async move {
            tx.send(42).await.unwrap();
        });

        let value = tokio::time::timeout(
            Duration::from_secs(1),
            rx.recv(),
        ).await.unwrap().unwrap();

        assert_eq!(value, 42);
    }
}
```

## 属性测试（proptest）

```rust
use proptest::prelude::*;

proptest! {
    // 自动生成随机输入验证不变量
    #[test]
    fn test_serialize_roundtrip(input in "\\PC{1,100}") {
        let serialized = serde_json::to_string(&input).unwrap();
        let deserialized: String = serde_json::from_str(&serialized).unwrap();
        prop_assert_eq!(&input, &deserialized);
    }

    #[test]
    fn test_sort_preserves_length(mut vec in prop::collection::vec(any::<i32>(), 0..100)) {
        let original_len = vec.len();
        vec.sort();
        prop_assert_eq!(vec.len(), original_len);
    }

    #[test]
    fn test_parse_never_panics(input in ".*") {
        // 仅验证不 panic，不关心结果
        let _ = parse_config(&input);
    }
}

// 自定义策略
fn valid_email_strategy() -> impl Strategy<Value = String> {
    ("[a-z]{1,10}", "[a-z]{1,5}")
        .prop_map(|(user, domain)| format!("{}@{}.com", user, domain))
}

proptest! {
    #[test]
    fn test_email_validation(email in valid_email_strategy()) {
        assert!(validate_email(&email).is_ok());
    }
}
```

## 测试 Fixtures

```rust
// 使用 rstest 提供 fixtures
use rstest::*;

#[fixture]
fn test_db() -> TestDatabase {
    TestDatabase::new_in_memory()
}

#[fixture]
fn sample_user() -> User {
    User {
        id: Uuid::new_v4().to_string(),
        name: "测试用户".into(),
        email: "test@example.com".into(),
    }
}

#[rstest]
fn test_insert_user(test_db: TestDatabase, sample_user: User) {
    test_db.insert(&sample_user).unwrap();
    let found = test_db.find_by_id(&sample_user.id).unwrap();
    assert_eq!(found.name, sample_user.name);
}

// 参数化测试
#[rstest]
#[case("hello", 5)]
#[case("", 0)]
#[case("你好世界", 12)] // UTF-8 字节长度
fn test_byte_length(#[case] input: &str, #[case] expected: usize) {
    assert_eq!(input.len(), expected);
}
```

## 文档测试

```rust
/// 将两个数相加。
///
/// # 示例
///
/// ```
/// use mylib::add;
///
/// assert_eq!(add(1, 2), 3);
/// assert_eq!(add(-1, 1), 0);
/// ```
///
/// # Panics
///
/// 当结果溢出时 panic（debug 模式）。
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

/// 解析配置字符串。
///
/// ```
/// # use mylib::parse_config;
/// # use mylib::error::ConfigError;
/// let config = parse_config("port = 8080")?;
/// assert_eq!(config.port, 8080);
/// # Ok::<(), ConfigError>(())
/// ```
pub fn parse_config(input: &str) -> Result<Config, ConfigError> {
    // ...
}
```

## 覆盖率（cargo-tarpaulin）

```bash
# 安装
cargo install cargo-tarpaulin

# 运行覆盖率分析
cargo tarpaulin --out Html --output-dir coverage/

# 排除测试代码本身
cargo tarpaulin --ignore-tests

# 设置最低覆盖率阈值（CI 使用）
cargo tarpaulin --fail-under 80

# 仅分析特定包
cargo tarpaulin -p mylib --out Lcov
```

## 测试组织最佳实践

```rust
// 使用 cfg 属性控制测试编译
#[cfg(test)]
mod tests {
    use super::*;

    // 辅助函数不需要 #[test] 标注
    fn create_test_context() -> TestContext {
        TestContext::default()
    }

    // 按功能分组
    mod creation {
        use super::*;

        #[test]
        fn test_create_with_valid_input() { /* ... */ }

        #[test]
        fn test_create_with_empty_name_fails() { /* ... */ }
    }

    mod deletion {
        use super::*;

        #[test]
        fn test_delete_existing() { /* ... */ }

        #[test]
        fn test_delete_nonexistent_returns_not_found() { /* ... */ }
    }
}
```

## 检查清单

- [ ] 每个公开函数都有单元测试覆盖正常和错误路径
- [ ] `#[should_panic]` 仅用于验证 panic 行为，业务逻辑用 `Result`
- [ ] 集成测试放在 `tests/` 目录，共享代码放 `tests/common/mod.rs`
- [ ] Mock 仅用于外部依赖的 trait，不 mock 内部实现
- [ ] 异步测试使用 `#[tokio::test]`，设置合理超时
- [ ] 解析/反序列化函数有 proptest 属性测试
- [ ] 公开 API 的文档注释包含可运行的示例（doc test）
- [ ] CI 运行 `cargo tarpaulin --fail-under 80`
- [ ] 测试命名清晰描述被测行为：`test_<行为>_when_<条件>_then_<结果>`
- [ ] 使用 `rstest` fixtures 避免重复的测试设置代码
- [ ] 不在测试中使用 `unwrap()` 的地方都有 `?` 或明确的错误断言
