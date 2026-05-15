---
name: python-patterns
type: constraint
package: python
description: Pythonic 惯用法、PEP 8 标准、类型提示以及构建稳健、高效且可维护的 Python 应用程序的最佳实践。
---

# Python 编码模式与最佳实践

## 核心原则

1. **显式优于隐式** — 代码意图应一目了然，避免魔法行为
2. **EAFP 优于 LBYL** — 请求宽恕比请求许可更 Pythonic
3. **组合优于继承** — 优先使用协议和混入而非深层继承
4. **不可变优先** — 默认使用不可变数据结构，仅在必要时使用可变对象
5. **类型安全** — 利用现代类型系统提升代码可靠性

## 代码风格与可读性

### PEP 8 基础

```python
# 命名规范
module_name = "snake_case"
ClassName = "PascalCase"
CONSTANT_VALUE = "UPPER_SNAKE_CASE"
_private_var = "前导下划线表示私有"

# 导入顺序：标准库 → 第三方 → 本地
import os
import sys
from pathlib import Path

import httpx
from pydantic import BaseModel

from myapp.core import config
from myapp.utils import helpers
```

### EAFP 风格

```python
# 反模式：LBYL（三思而后行）
if key in dictionary:
    value = dictionary[key]
else:
    value = default

# 正确：EAFP（请求宽恕）
try:
    value = dictionary[key]
except KeyError:
    value = default

# 更简洁：使用内置方法
value = dictionary.get(key, default)
```

## 现代类型提示（3.10+）

```python
from typing import Protocol, TypeVar, Self
from collections.abc import Callable, Sequence, Iterator

# 使用内置泛型语法（3.10+）
def process_items(items: list[str]) -> dict[str, int]:
    return {item: len(item) for item in items}

# 联合类型使用 | 语法
def parse_input(value: str | int | None) -> str:
    if value is None:
        return ""
    return str(value)

# Protocol 定义结构化子类型
class Renderable(Protocol):
    def render(self) -> str: ...

# TypeVar 与约束
T = TypeVar("T", bound="Comparable")

class Comparable(Protocol):
    def __lt__(self, other: Self) -> bool: ...

def find_min(items: Sequence[T]) -> T:
    return min(items)
```

## 错误处理

```python
# 自定义异常层次结构
class AppError(Exception):
    """应用程序基础异常"""
    def __init__(self, message: str, code: str | None = None):
        self.code = code
        super().__init__(message)

class ValidationError(AppError):
    """数据验证错误"""
    pass

class NotFoundError(AppError):
    """资源未找到"""
    pass

# 异常链：保留原始上下文
def load_config(path: Path) -> dict:
    try:
        content = path.read_text()
    except OSError as e:
        raise AppError(f"无法读取配置文件: {path}") from e
    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        raise ValidationError(f"配置文件格式错误: {path}") from e

# 捕获特定异常，避免裸 except
try:
    result = perform_operation()
except (ConnectionError, TimeoutError) as e:
    logger.warning("操作失败，正在重试: %s", e)
    result = retry_operation()
```

## 上下文管理器

```python
from contextlib import contextmanager, asynccontextmanager
from typing import Generator

# 基于类的上下文管理器
class DatabaseConnection:
    def __init__(self, url: str):
        self.url = url
        self._conn = None

    def __enter__(self) -> "DatabaseConnection":
        self._conn = create_connection(self.url)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        if self._conn:
            self._conn.close()
        return False  # 不抑制异常

# 基于生成器的上下文管理器
@contextmanager
def temporary_directory() -> Generator[Path, None, None]:
    path = Path(tempfile.mkdtemp())
    try:
        yield path
    finally:
        shutil.rmtree(path, ignore_errors=True)

# 异步上下文管理器
@asynccontextmanager
async def http_session():
    async with httpx.AsyncClient() as client:
        yield client
```

## 数据类与 NamedTuple

```python
from dataclasses import dataclass, field
from typing import NamedTuple

# dataclass：可变数据容器，支持默认值和方法
@dataclass
class User:
    name: str
    email: str
    roles: list[str] = field(default_factory=list)
    active: bool = True

    @property
    def is_admin(self) -> bool:
        return "admin" in self.roles

# frozen dataclass：不可变数据
@dataclass(frozen=True)
class Point:
    x: float
    y: float

# NamedTuple：轻量不可变记录，适合简单数据
class Coordinate(NamedTuple):
    latitude: float
    longitude: float
    altitude: float = 0.0
```

## 装饰器模式

```python
import functools
import time
from typing import ParamSpec, TypeVar

P = ParamSpec("P")
R = TypeVar("R")

# 带参数的装饰器
def retry(max_attempts: int = 3, delay: float = 1.0):
    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        @functools.wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            last_error: Exception | None = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    if attempt < max_attempts - 1:
                        time.sleep(delay * (2 ** attempt))
            raise last_error  # type: ignore
        return wrapper
    return decorator

@retry(max_attempts=3, delay=0.5)
def fetch_data(url: str) -> dict:
    ...
```

## 推导式与生成器

```python
# 列表推导：结果需要多次使用时
squares = [x ** 2 for x in range(100) if x % 2 == 0]

# 生成器表达式：大数据集惰性求值
total = sum(x ** 2 for x in range(1_000_000))

# 字典推导
word_lengths = {word: len(word) for word in words}

# 生成器函数：复杂迭代逻辑
def read_chunks(file_path: Path, chunk_size: int = 8192) -> Iterator[bytes]:
    with open(file_path, "rb") as f:
        while chunk := f.read(chunk_size):
            yield chunk
```

## 并发模式

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor

# I/O 密集型：使用线程池或 async/await
async def fetch_all(urls: list[str]) -> list[str]:
    async with httpx.AsyncClient() as client:
        tasks = [client.get(url) for url in urls]
        responses = await asyncio.gather(*tasks)
        return [r.text for r in responses]

# CPU 密集型：使用进程池
def parallel_compute(data: list[int]) -> list[int]:
    with ProcessPoolExecutor() as executor:
        results = list(executor.map(heavy_computation, data))
    return results

# 线程池处理阻塞 I/O
async def read_files_async(paths: list[Path]) -> list[str]:
    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor() as pool:
        tasks = [loop.run_in_executor(pool, p.read_text) for p in paths]
        return await asyncio.gather(*tasks)
```

## 包组织结构

```
my-project/
├── pyproject.toml          # 项目元数据与依赖
├── src/
│   └── mypackage/
│       ├── __init__.py
│       ├── core/           # 核心业务逻辑
│       ├── models/         # 数据模型
│       ├── services/       # 外部服务集成
│       └── utils/          # 工具函数
├── tests/
│   ├── conftest.py
│   ├── unit/
│   └── integration/
└── docs/
```

## 内存优化

```python
# __slots__：减少实例内存占用
class Vector:
    __slots__ = ("x", "y", "z")

    def __init__(self, x: float, y: float, z: float):
        self.x = x
        self.y = y
        self.z = z

# 生成器避免大列表驻留内存
def process_large_file(path: Path) -> Iterator[dict]:
    with open(path) as f:
        for line in f:
            yield json.loads(line)
```

## 检查清单

- [ ] 遵循 PEP 8 命名规范和导入顺序
- [ ] 使用 3.10+ 类型提示语法（`X | Y`、内置泛型）
- [ ] 异常处理捕获特定类型，使用 `from` 保留链
- [ ] 优先使用 EAFP 风格而非 LBYL
- [ ] 大数据集使用生成器而非列表
- [ ] 使用 `dataclass` 或 `NamedTuple` 替代普通字典
- [ ] 装饰器使用 `functools.wraps` 保留元信息
- [ ] I/O 密集用 async/线程，CPU 密集用多进程
- [ ] 项目使用 src layout + pyproject.toml
- [ ] 运行 `ruff check` 和 `mypy --strict` 通过
