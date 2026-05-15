---
name: rust-patterns
type: constraint
package: rust
description: Rust 所有权、错误处理、trait 设计、并发模式与常用设计模式的最佳实践。
---
# Rust 惯用模式与最佳实践

## 核心原则

1. **所有权即设计** — 数据的所有权关系决定了系统架构
2. **零成本抽象** — 利用类型系统在编译期消除运行时开销
3. **使错误不可忽略** — 通过 `Result` 强制调用方处理错误
4. **fearless concurrency** — 编译器保证线程安全

## 所有权与借用

```rust
// 优先使用借用，避免不必要的克隆
fn process_name(name: &str) -> String {
    name.to_uppercase()
}

// 需要所有权时明确转移
fn consume_buffer(buf: Vec<u8>) -> Result<(), Error> {
    // buf 在此函数结束后被释放
    Ok(())
}

// 使用 Cow 延迟克隆决策
use std::borrow::Cow;

fn normalize(input: &str) -> Cow<'_, str> {
    if input.contains(' ') {
        Cow::Owned(input.replace(' ', "_"))
    } else {
        Cow::Borrowed(input) // 无需分配
    }
}

// 结构体中优先使用引用或智能指针，避免过度 Clone
struct Parser<'a> {
    input: &'a str,
    position: usize,
}
```

## 错误处理

```rust
// 库代码使用 thiserror 定义错误类型
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ServiceError {
    #[error("用户 {id} 未找到")]
    NotFound { id: String },

    #[error("数据库错误: {0}")]
    Database(#[from] sqlx::Error),

    #[error("校验失败: {field} - {message}")]
    Validation { field: String, message: String },
}

// 应用代码使用 anyhow 简化错误传播
use anyhow::{Context, Result};

fn load_config(path: &str) -> Result<Config> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("读取配置文件失败: {}", path))?;

    let config: Config = toml::from_str(&content)
        .context("解析 TOML 配置失败")?;

    Ok(config)
}

// 使用 ? 操作符链式传播
async fn create_user(db: &Pool, req: CreateUserReq) -> Result<User, ServiceError> {
    validate_email(&req.email)?;
    let user = db.insert_user(&req).await?;
    Ok(user)
}
```

## Trait 设计

```rust
// 扩展 trait：为外部类型添加方法
trait StringExt {
    fn truncate_safe(&self, max_len: usize) -> &str;
}

impl StringExt for str {
    fn truncate_safe(&self, max_len: usize) -> &str {
        if self.len() <= max_len {
            return self;
        }
        // 确保不在 UTF-8 字符中间截断
        let mut end = max_len;
        while !self.is_char_boundary(end) {
            end -= 1;
        }
        &self[..end]
    }
}

// 密封 trait：防止外部实现
mod private {
    pub trait Sealed {}
}

pub trait DatabaseDriver: private::Sealed {
    fn connect(&self) -> Result<Connection, Error>;
}

// 仅内部类型可实现
impl private::Sealed for PostgresDriver {}
impl DatabaseDriver for PostgresDriver {
    fn connect(&self) -> Result<Connection, Error> { /* ... */ }
}
```

## 模块组织

```
src/
├── lib.rs              // 公开 API 入口
├── error.rs            // 统一错误类型
├── config.rs           // 配置结构
├── domain/
│   ├── mod.rs
│   ├── user.rs         // 领域模型
│   └── order.rs
├── service/
│   ├── mod.rs
│   └── user_service.rs
├── repository/
│   ├── mod.rs
│   └── postgres.rs
└── api/
    ├── mod.rs
    └── handlers.rs
```

```rust
// lib.rs 中控制公开 API
pub mod config;
pub mod error;
pub mod domain;

// 重导出常用类型
pub use error::AppError;
pub use config::Config;
```

## 智能指针

```rust
// Box: 堆分配，用于递归类型或 trait 对象
enum Expr {
    Literal(i64),
    Add(Box<Expr>, Box<Expr>),
}

// Arc + Mutex: 多线程共享可变状态
use std::sync::{Arc, Mutex};

struct AppState {
    cache: Arc<Mutex<HashMap<String, String>>>,
}

// Arc + RwLock: 读多写少场景
use std::sync::RwLock;

struct ConfigStore {
    inner: Arc<RwLock<Config>>,
}

impl ConfigStore {
    fn get(&self) -> Config {
        self.inner.read().unwrap().clone()
    }

    fn update(&self, new_config: Config) {
        *self.inner.write().unwrap() = new_config;
    }
}
```

## 并发模式（Tokio）

```rust
use tokio::sync::mpsc;

// 使用 channel 通信
async fn worker_pool(tasks: Vec<Task>) -> Vec<Result<Output, Error>> {
    let (tx, mut rx) = mpsc::channel(100);

    for task in tasks {
        let tx = tx.clone();
        tokio::spawn(async move {
            let result = process(task).await;
            let _ = tx.send(result).await;
        });
    }
    drop(tx); // 关闭发送端

    let mut results = Vec::new();
    while let Some(result) = rx.recv().await {
        results.push(result);
    }
    results
}

// 使用 JoinSet 管理并发任务
use tokio::task::JoinSet;

async fn fetch_all(urls: Vec<String>) -> Vec<String> {
    let mut set = JoinSet::new();

    for url in urls {
        set.spawn(async move {
            reqwest::get(&url).await?.text().await
        });
    }

    let mut results = Vec::new();
    while let Some(res) = set.join_next().await {
        if let Ok(Ok(body)) = res {
            results.push(body);
        }
    }
    results
}

// Send + Sync 约束
// Send: 可安全跨线程转移所有权
// Sync: 可安全跨线程共享引用（&T 是 Send）
fn spawn_task<F>(f: F)
where
    F: Future<Output = ()> + Send + 'static,
{
    tokio::spawn(f);
}
```

## Builder 模式

```rust
#[derive(Debug)]
pub struct HttpClient {
    base_url: String,
    timeout: Duration,
    headers: HeaderMap,
}

pub struct HttpClientBuilder {
    base_url: String,
    timeout: Duration,
    headers: HeaderMap,
}

impl HttpClientBuilder {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            timeout: Duration::from_secs(30),
            headers: HeaderMap::new(),
        }
    }

    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    pub fn header(mut self, key: &str, value: &str) -> Self {
        self.headers.insert(
            HeaderName::from_str(key).unwrap(),
            HeaderValue::from_str(value).unwrap(),
        );
        self
    }

    pub fn build(self) -> HttpClient {
        HttpClient {
            base_url: self.base_url,
            timeout: self.timeout,
            headers: self.headers,
        }
    }
}
```

## Newtype 模式

```rust
// 为基础类型添加语义和类型安全
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct UserId(String);

impl UserId {
    pub fn new(id: impl Into<String>) -> Result<Self, ValidationError> {
        let id = id.into();
        if id.is_empty() {
            return Err(ValidationError::new("用户ID不能为空"));
        }
        Ok(Self(id))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

// 使用 derive_more 减少样板代码
use derive_more::{Display, From, Into};

#[derive(Debug, Display, From, Into, Clone, PartialEq)]
pub struct Email(String);
```

## Derive 宏使用

```rust
// 常用 derive 组合
#[derive(Debug, Clone, PartialEq, Eq, Hash)]  // 值对象
pub struct OrderId(Uuid);

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]  // DTO
pub struct CreateOrderRequest {
    pub product_id: String,
    pub quantity: u32,
}

// 条件 derive
#[derive(Debug)]
#[cfg_attr(test, derive(PartialEq))]  // 仅测试时派生 PartialEq
pub struct InternalState {
    counter: u64,
}
```

## 检查清单

- [ ] 优先借用而非克隆，仅在必要时转移所有权
- [ ] 库代码使用 `thiserror`，应用代码使用 `anyhow`
- [ ] 所有 `unwrap()` 都有注释说明为何不会 panic，或替换为 `?`
- [ ] Trait 保持小而聚焦，使用扩展 trait 添加便利方法
- [ ] 公开 API 使用密封 trait 防止下游破坏性实现
- [ ] 并发代码明确 `Send`/`Sync` 约束
- [ ] 使用 `Arc` 共享所有权，`Mutex`/`RwLock` 保护可变状态
- [ ] Builder 模式用于超过 3 个参数的构造
- [ ] Newtype 为原始类型提供类型安全
- [ ] 模块层次清晰，`lib.rs` 仅做重导出
- [ ] `clippy` 无警告（`cargo clippy -- -D warnings`）
- [ ] 文档注释覆盖所有公开 API（`cargo doc --no-deps`）
