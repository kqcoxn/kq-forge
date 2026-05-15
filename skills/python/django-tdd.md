---
name: django-tdd
type: capability
package: python
description: Django TDD 工作流，涵盖 pytest-django 配置、工厂模式、模型/视图/API 测试、任务测试与 CI 集成。
---

# Django TDD 工作流

## 核心原则

1. **测试先行** — 先写失败测试定义期望行为，再写实现代码
2. **工厂优于 Fixture** — 使用 factory_boy 动态生成测试数据，避免静态 JSON fixture
3. **隔离性** — 每个测试独立，不依赖数据库状态或执行顺序
4. **快速反馈** — 单元测试秒级完成，集成测试分离运行
5. **真实场景** — 测试覆盖真实用户行为路径，而非仅测试代码分支

## 测试环境配置

```ini
# pyproject.toml
[tool.pytest.ini_options]
DJANGO_SETTINGS_MODULE = "config.settings.testing"
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
addopts = "-ra --strict-markers --reuse-db"
markers = [
    "slow: 运行缓慢的测试",
    "integration: 集成测试",
]

[tool.coverage.run]
source = ["apps"]
branch = true
omit = ["*/migrations/*", "*/tests/*"]

[tool.coverage.report]
fail_under = 80
show_missing = true
```

```python
# config/settings/testing.py
from .base import *  # noqa

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# 加速密码哈希
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# 禁用不必要的中间件
MIDDLEWARE = [m for m in MIDDLEWARE if "debug" not in m.lower()]

# Celery 同步执行
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
```

## 工厂模式（factory_boy + faker）

```python
import factory
from factory.django import DjangoModelFactory
from faker import Faker

fake = Faker("zh_CN")

class UserFactory(DjangoModelFactory):
    class Meta:
        model = "users.User"
        skip_postgeneration_save = True

    username = factory.LazyFunction(lambda: fake.user_name())
    email = factory.LazyAttribute(lambda obj: f"{obj.username}@example.com")
    is_active = True

    @factory.post_generation
    def password(self, create, extracted, **kwargs):
        password = extracted or "TestPass123!"
        self.set_password(password)
        if create:
            self.save()

class OrderFactory(DjangoModelFactory):
    class Meta:
        model = "orders.Order"

    user = factory.SubFactory(UserFactory)
    status = "pending"
    total_amount = factory.LazyFunction(lambda: fake.pydecimal(min_value=10, max_value=9999, right_digits=2))

# 批量创建
class OrderWithItemsFactory(OrderFactory):
    @factory.post_generation
    def items(self, create, extracted, **kwargs):
        if not create:
            return
        if extracted:
            for item in extracted:
                self.items.add(item)
        else:
            OrderItemFactory.create_batch(3, order=self)
```

## 模型测试

```python
import pytest
from django.core.exceptions import ValidationError

pytestmark = pytest.mark.django_db

class TestOrderModel:
    def test_create_order(self):
        order = OrderFactory()
        assert order.id is not None
        assert order.status == "pending"

    def test_confirm_pending_order(self):
        order = OrderFactory(status="pending")
        order.confirm()
        order.refresh_from_db()
        assert order.status == "confirmed"

    def test_confirm_non_pending_raises(self):
        order = OrderFactory(status="shipped")
        with pytest.raises(ValueError, match="只有待处理订单"):
            order.confirm()

    def test_total_amount_must_be_positive(self):
        order = OrderFactory.build(total_amount=-10)
        with pytest.raises(ValidationError):
            order.full_clean()

    def test_queryset_active_filter(self):
        OrderFactory(is_active=True)
        OrderFactory(is_active=False)
        assert Order.objects.active().count() == 1
```

## 视图与 API 测试

```python
import pytest
from rest_framework.test import APIClient
from rest_framework import status

pytestmark = pytest.mark.django_db

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def authenticated_client(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    api_client.user = user
    return api_client

class TestOrderAPI:
    def test_list_orders_requires_auth(self, api_client):
        response = api_client.get("/api/v1/orders/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_own_orders(self, authenticated_client):
        # 创建当前用户的订单
        OrderFactory.create_batch(3, user=authenticated_client.user)
        # 创建其他用户的订单（不应返回）
        OrderFactory()

        response = authenticated_client.get("/api/v1/orders/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 3

    def test_create_order(self, authenticated_client):
        payload = {"total_amount": "99.99"}
        response = authenticated_client.post("/api/v1/orders/", payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["status"] == "pending"

    def test_confirm_order_action(self, authenticated_client):
        order = OrderFactory(user=authenticated_client.user, status="pending")
        response = authenticated_client.post(f"/api/v1/orders/{order.id}/confirm/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "confirmed"

    def test_cannot_confirm_others_order(self, authenticated_client):
        order = OrderFactory()  # 其他用户的订单
        response = authenticated_client.post(f"/api/v1/orders/{order.id}/confirm/")
        assert response.status_code == status.HTTP_404_NOT_FOUND
```

## 表单测试

```python
pytestmark = pytest.mark.django_db

class TestUserRegistrationForm:
    def test_valid_form(self):
        form = RegistrationForm(data={
            "username": "newuser",
            "email": "new@example.com",
            "password1": "StrongPass123!",
            "password2": "StrongPass123!",
        })
        assert form.is_valid()

    def test_password_mismatch(self):
        form = RegistrationForm(data={
            "username": "newuser",
            "email": "new@example.com",
            "password1": "StrongPass123!",
            "password2": "DifferentPass!",
        })
        assert not form.is_valid()
        assert "password2" in form.errors

    def test_duplicate_email(self):
        UserFactory(email="existing@example.com")
        form = RegistrationForm(data={
            "username": "another",
            "email": "existing@example.com",
            "password1": "StrongPass123!",
            "password2": "StrongPass123!",
        })
        assert not form.is_valid()
```

## 信号测试

```python
from unittest.mock import patch

pytestmark = pytest.mark.django_db

class TestOrderSignals:
    @patch("apps.orders.signals.send_notification.delay")
    def test_notification_sent_on_create(self, mock_notify):
        order = OrderFactory()
        mock_notify.assert_called_once_with(
            order.user_id,
            f"订单 {order.id} 已创建",
        )

    @patch("apps.orders.signals.send_notification.delay")
    def test_notification_not_sent_on_update(self, mock_notify):
        order = OrderFactory()
        mock_notify.reset_mock()
        order.status = "confirmed"
        order.save()
        mock_notify.assert_not_called()
```

## Celery 任务测试

```python
import pytest
from unittest.mock import patch, MagicMock

pytestmark = pytest.mark.django_db

class TestSendNotificationTask:
    def test_sends_to_existing_user(self):
        user = UserFactory()
        with patch("apps.notifications.tasks.deliver_message") as mock_deliver:
            send_notification(user.id, "测试消息")
            mock_deliver.assert_called_once_with(user.email, "测试消息")

    def test_skips_nonexistent_user(self):
        with patch("apps.notifications.tasks.deliver_message") as mock_deliver:
            send_notification(99999, "测试消息")  # 不存在的用户
            mock_deliver.assert_not_called()

    def test_retries_on_delivery_error(self):
        user = UserFactory()
        with patch("apps.notifications.tasks.deliver_message") as mock_deliver:
            mock_deliver.side_effect = DeliveryError("服务不可用")
            with pytest.raises(DeliveryError):
                send_notification(user.id, "测试消息")
```

## 测试隔离

```python
import pytest
from django.test import TestCase, TransactionTestCase

# TestCase（默认）：使用事务回滚，速度快
# 适用于大多数测试
class TestOrderService(TestCase):
    def test_create_order(self):
        ...

# TransactionTestCase：真实提交事务
# 适用于测试事务行为、信号、select_for_update
class TestConcurrentOrders(TransactionTestCase):
    def test_concurrent_stock_deduction(self):
        """测试并发扣库存的正确性"""
        ...

# pytest-django 中使用 transaction=True
@pytest.mark.django_db(transaction=True)
def test_deadlock_handling():
    ...
```

## 覆盖率与 CI 集成

```yaml
# .github/workflows/test.yml
name: Django Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: test_db
          POSTGRES_PASSWORD: postgres
        ports: ["5432:5432"]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: 安装依赖
        run: pip install -e ".[test]"

      - name: 运行测试
        run: pytest --cov --cov-report=xml
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/test_db

      - name: 上传覆盖率
        uses: codecov/codecov-action@v4
```

## 检查清单

- [ ] pytest-django 配置 `DJANGO_SETTINGS_MODULE` 指向测试设置
- [ ] 使用 factory_boy 替代 JSON fixtures 生成测试数据
- [ ] 测试密码哈希使用 MD5 加速
- [ ] API 测试覆盖认证、权限和边界条件
- [ ] 信号测试使用 mock 验证触发行为
- [ ] Celery 任务配置 `ALWAYS_EAGER` 同步执行
- [ ] 需要真实事务的测试使用 `TransactionTestCase`
- [ ] 覆盖率排除 migrations 和 tests 目录
- [ ] CI 中运行完整测试套件并上传覆盖率报告
- [ ] 工厂类支持 `build()`（不写库）和 `create()`（写库）两种模式
