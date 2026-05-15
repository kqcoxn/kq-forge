---
name: python-testing
type: capability
package: python
description: 使用 pytest 的 Python 测试策略，包括 TDD 方法、夹具、模拟、参数化和覆盖率要求。
---

# Python 测试策略（pytest）

## 核心原则

1. **TDD 驱动** — 先写失败测试，再写最小实现，最后重构
2. **测试隔离** — 每个测试独立运行，无顺序依赖
3. **快速反馈** — 单元测试毫秒级完成，慢测试标记分离
4. **行为验证** — 测试行为而非实现细节
5. **覆盖率目标** — 核心逻辑 80%+ 覆盖率

## TDD 循环

```
红 → 绿 → 重构

1. 红：编写一个失败的测试，明确期望行为
2. 绿：编写最少代码使测试通过
3. 重构：消除重复，改善设计，保持测试绿色
```

### TDD 示例

```python
# 第一步：红 — 写失败测试
def test_calculate_discount_for_vip():
    customer = Customer(tier="vip", total_spent=10000)
    assert calculate_discount(customer, 100) == 20.0  # VIP 享 20% 折扣

# 第二步：绿 — 最小实现
def calculate_discount(customer: Customer, amount: float) -> float:
    if customer.tier == "vip":
        return amount * 0.2
    return 0.0

# 第三步：重构 — 提取策略模式
DISCOUNT_RATES = {"vip": 0.2, "gold": 0.1, "standard": 0.0}

def calculate_discount(customer: Customer, amount: float) -> float:
    rate = DISCOUNT_RATES.get(customer.tier, 0.0)
    return amount * rate
```

## pytest 基础

```python
import pytest

# 基本断言 — pytest 自动提供详细失败信息
def test_string_operations():
    result = format_name("john", "doe")
    assert result == "John Doe"
    assert "John" in result
    assert result.startswith("John")

# 异常测试
def test_invalid_input_raises():
    with pytest.raises(ValueError, match="不能为空"):
        validate_email("")

# 标记
@pytest.mark.slow
def test_large_dataset_processing():
    ...

@pytest.mark.parametrize("input,expected", [
    ("hello", "HELLO"),
    ("world", "WORLD"),
])
def test_uppercase(input, expected):
    assert input.upper() == expected
```

## Fixtures（夹具）

```python
import pytest
from pathlib import Path

# 基本 fixture
@pytest.fixture
def sample_user():
    return User(name="测试用户", email="test@example.com")

# 带清理的 fixture
@pytest.fixture
def temp_database(tmp_path):
    db_path = tmp_path / "test.db"
    db = Database(db_path)
    db.initialize()
    yield db  # yield 之后执行清理
    db.close()

# fixture 作用域
@pytest.fixture(scope="session")
def docker_service():
    """整个测试会话只启动一次"""
    container = start_container()
    yield container
    container.stop()

@pytest.fixture(scope="module")
def db_connection(docker_service):
    """每个测试模块创建一次连接"""
    conn = connect(docker_service.url)
    yield conn
    conn.close()

# autouse：自动应用到所有测试
@pytest.fixture(autouse=True)
def reset_environment(monkeypatch):
    monkeypatch.setenv("APP_ENV", "testing")

# conftest.py 中共享 fixture
# tests/conftest.py
@pytest.fixture
def api_client():
    """所有测试模块可用"""
    return TestClient(app)
```

## 参数化测试

```python
import pytest

# 基本参数化
@pytest.mark.parametrize("input_val,expected", [
    (1, "1"),
    (0, "0"),
    (-1, "-1"),
    (None, "None"),
])
def test_to_string(input_val, expected):
    assert to_string(input_val) == expected

# 带 ID 的参数化（改善测试输出可读性）
@pytest.mark.parametrize("email,is_valid", [
    pytest.param("user@example.com", True, id="正常邮箱"),
    pytest.param("invalid", False, id="缺少@符号"),
    pytest.param("@domain.com", False, id="缺少用户名"),
    pytest.param("user@.com", False, id="域名无效"),
], ids=str)
def test_email_validation(email, is_valid):
    assert validate_email(email) == is_valid

# fixture 参数化
@pytest.fixture(params=["sqlite", "postgres"])
def database(request):
    db = create_database(backend=request.param)
    yield db
    db.drop()

def test_crud_operations(database):
    """自动对每种数据库后端运行"""
    database.insert({"key": "value"})
    assert database.get("key") == "value"
```

## Mock 与猴子补丁

```python
from unittest.mock import patch, Mock, AsyncMock, MagicMock

# patch 装饰器
@patch("myapp.services.email.send_email")
def test_user_registration(mock_send):
    register_user("test@example.com", "password123")
    mock_send.assert_called_once_with(
        to="test@example.com",
        subject="欢迎注册",
    )

# autospec：确保 mock 签名与原函数一致
@patch("myapp.services.payment.charge", autospec=True)
def test_payment_processing(mock_charge):
    mock_charge.return_value = PaymentResult(success=True)
    result = process_order(order)
    assert result.paid is True

# side_effect：模拟异常或多次调用
@patch("myapp.client.fetch_data")
def test_retry_on_failure(mock_fetch):
    mock_fetch.side_effect = [
        ConnectionError("超时"),
        ConnectionError("超时"),
        {"data": "success"},
    ]
    result = fetch_with_retry(url, max_retries=3)
    assert result == {"data": "success"}
    assert mock_fetch.call_count == 3

# monkeypatch（pytest 内置，推荐用于简单场景）
def test_config_from_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite:///test.db")
    config = load_config()
    assert config.database_url == "sqlite:///test.db"
```

## 异步测试

```python
import pytest
import pytest_asyncio

# pytest-asyncio 配置（pyproject.toml）
# [tool.pytest.ini_options]
# asyncio_mode = "auto"

@pytest_asyncio.fixture
async def async_client():
    async with AsyncClient(app, base_url="http://test") as client:
        yield client

async def test_async_endpoint(async_client):
    response = await async_client.get("/api/users")
    assert response.status_code == 200
    assert len(response.json()) > 0

# mock 异步函数
@patch("myapp.services.fetch_user", new_callable=AsyncMock)
async def test_async_service(mock_fetch):
    mock_fetch.return_value = User(name="测试")
    result = await get_user_profile(user_id=1)
    assert result.name == "测试"
```

## 测试组织

```
tests/
├── conftest.py              # 共享 fixtures
├── unit/                    # 单元测试（快速，无外部依赖）
│   ├── test_models.py
│   ├── test_services.py
│   └── test_utils.py
├── integration/             # 集成测试（涉及数据库、API）
│   ├── conftest.py          # 集成测试专用 fixtures
│   ├── test_api.py
│   └── test_database.py
└── e2e/                     # 端到端测试
    └── test_workflows.py
```

```ini
# pyproject.toml 配置
[tool.pytest.ini_options]
testpaths = ["tests"]
markers = [
    "slow: 运行缓慢的测试",
    "integration: 集成测试",
    "e2e: 端到端测试",
]
addopts = "-ra --strict-markers"

[tool.coverage.run]
source = ["src"]
branch = true

[tool.coverage.report]
fail_under = 80
show_missing = true
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
    "raise NotImplementedError",
]
```

## 属性测试（Hypothesis）

```python
from hypothesis import given, strategies as st, assume

@given(st.lists(st.integers()))
def test_sort_is_idempotent(lst):
    """排序两次结果相同"""
    sorted_once = sorted(lst)
    sorted_twice = sorted(sorted_once)
    assert sorted_once == sorted_twice

@given(st.text(min_size=1, max_size=100))
def test_encode_decode_roundtrip(text):
    """编码后解码应还原原始数据"""
    encoded = encode(text)
    decoded = decode(encoded)
    assert decoded == text

@given(st.integers(min_value=1, max_value=1000))
def test_discount_never_exceeds_amount(amount):
    """折扣不应超过原价"""
    discount = calculate_discount(amount)
    assert 0 <= discount <= amount
```

## 检查清单

- [ ] 遵循 TDD 循环：红 → 绿 → 重构
- [ ] 测试文件以 `test_` 前缀命名
- [ ] 使用 fixtures 消除测试间重复设置
- [ ] 慢测试标记 `@pytest.mark.slow` 并在 CI 中分离运行
- [ ] Mock 外部依赖，使用 `autospec=True` 保证签名正确
- [ ] 参数化覆盖边界条件和异常路径
- [ ] 异步代码使用 `pytest-asyncio` 测试
- [ ] 覆盖率配置 `fail_under = 80`
- [ ] conftest.py 按目录层级组织共享 fixtures
- [ ] CI 中运行 `pytest --cov --cov-report=term-missing`
