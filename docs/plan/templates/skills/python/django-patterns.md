---
name: django-patterns
type: capability
package: python
description: Django 框架最佳实践，涵盖项目结构、模型设计、视图模式、DRF 集成、缓存策略与安全配置。
---

# Django 框架模式

## 核心原则

1. **约定优于配置** — 遵循 Django 惯例，减少不必要的自定义
2. **Fat Models, Thin Views** — 业务逻辑放在模型层，视图保持简洁
3. **DRY 原则** — 通过抽象基类、Mixin 和管理器消除重复
4. **安全默认** — 利用 Django 内置安全机制，不重复造轮子
5. **可测试性** — 每个组件可独立测试

## 项目结构

```
project/
├── config/                  # 项目配置（替代默认项目名目录）
│   ├── __init__.py
│   ├── settings/
│   │   ├── __init__.py
│   │   ├── base.py         # 共享配置
│   │   ├── development.py  # 开发环境
│   │   ├── production.py   # 生产环境
│   │   └── testing.py      # 测试环境
│   ├── urls.py
│   └── wsgi.py
├── apps/
│   ├── users/
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   ├── admin.py
│   │   ├── signals.py
│   │   ├── managers.py
│   │   ├── services.py     # 复杂业务逻辑
│   │   └── tests/
│   │       ├── test_models.py
│   │       └── test_views.py
│   └── orders/
│       └── ...
├── common/                  # 跨应用共享代码
│   ├── models.py           # 抽象基类
│   ├── permissions.py
│   └── pagination.py
├── manage.py
└── pyproject.toml
```

## 模型设计

```python
from django.db import models
from django.utils import timezone

# 抽象基类：提供通用字段
class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

# 自定义 Manager 和 QuerySet
class ActiveQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)

    def recent(self, days: int = 7):
        cutoff = timezone.now() - timezone.timedelta(days=days)
        return self.filter(created_at__gte=cutoff)

class ActiveManager(models.Manager):
    def get_queryset(self):
        return ActiveQuerySet(self.model, using=self._db)

    def active(self):
        return self.get_queryset().active()

# 模型示例
class Order(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "待处理"
        CONFIRMED = "confirmed", "已确认"
        SHIPPED = "shipped", "已发货"
        COMPLETED = "completed", "已完成"

    user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="orders")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)

    objects = ActiveManager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["-created_at"]),
        ]

    def confirm(self):
        """业务逻辑放在模型方法中"""
        if self.status != self.Status.PENDING:
            raise ValueError("只有待处理订单可以确认")
        self.status = self.Status.CONFIRMED
        self.save(update_fields=["status", "updated_at"])
```

## 信号

```python
from django.db.models.signals import post_save
from django.dispatch import receiver

# 使用 receiver 装饰器注册信号
@receiver(post_save, sender=Order)
def notify_order_created(sender, instance, created, **kwargs):
    if created:
        send_notification.delay(instance.user_id, f"订单 {instance.id} 已创建")

# 在 apps.py 中确保信号被加载
class OrdersConfig(AppConfig):
    name = "apps.orders"

    def ready(self):
        import apps.orders.signals  # noqa: F401
```

## 视图模式

```python
from django.views.generic import ListView, DetailView
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin

# CBV：适合 CRUD 操作
class OrderListView(LoginRequiredMixin, ListView):
    model = Order
    template_name = "orders/list.html"
    paginate_by = 20

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).active()

# FBV：适合简单或非标准逻辑
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

@require_http_methods(["POST"])
def cancel_order(request, order_id):
    order = get_object_or_404(Order, id=order_id, user=request.user)
    order.cancel()
    return JsonResponse({"status": "cancelled"})
```

## DRF 序列化器与视图集

```python
from rest_framework import serializers, viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

class OrderSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Order
        fields = ["id", "user_email", "status", "total_amount", "created_at"]
        read_only_fields = ["status"]

    def validate_total_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("金额必须大于零")
        return value

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        order = self.get_object()
        try:
            order.confirm()
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderSerializer(order).data)
```

## 中间件

```python
import time
import logging

logger = logging.getLogger(__name__)

class RequestTimingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.perf_counter()
        response = self.get_response(request)
        duration = time.perf_counter() - start
        logger.info(
            "%s %s 耗时 %.3fs",
            request.method, request.path, duration,
        )
        return response
```

## Admin 自定义

```python
from django.contrib import admin

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "status", "total_amount", "created_at"]
    list_filter = ["status", "created_at"]
    search_fields = ["user__email", "id"]
    readonly_fields = ["created_at", "updated_at"]
    actions = ["mark_as_shipped"]

    @admin.action(description="标记为已发货")
    def mark_as_shipped(self, request, queryset):
        updated = queryset.filter(status=Order.Status.CONFIRMED).update(
            status=Order.Status.SHIPPED
        )
        self.message_user(request, f"已更新 {updated} 个订单")
```

## Management Commands

```python
from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = "清理过期的未完成订单"

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=30, help="过期天数")
        parser.add_argument("--dry-run", action="store_true", help="仅预览不执行")

    def handle(self, *args, **options):
        days = options["days"]
        cutoff = timezone.now() - timezone.timedelta(days=days)
        qs = Order.objects.filter(status=Order.Status.PENDING, created_at__lt=cutoff)

        if options["dry_run"]:
            self.stdout.write(f"将删除 {qs.count()} 个过期订单")
            return

        deleted, _ = qs.delete()
        self.stdout.write(self.style.SUCCESS(f"已删除 {deleted} 个过期订单"))
```

## 缓存策略

```python
from django.views.decorators.cache import cache_page
from django.core.cache import cache

# 视图级缓存
@cache_page(60 * 15)  # 缓存 15 分钟
def product_list(request):
    ...

# 低级缓存 API
def get_user_stats(user_id: int) -> dict:
    cache_key = f"user_stats:{user_id}"
    stats = cache.get(cache_key)
    if stats is None:
        stats = compute_user_stats(user_id)
        cache.set(cache_key, stats, timeout=300)
    return stats

# 缓存失效
def update_user_profile(user_id: int, data: dict):
    user = User.objects.get(id=user_id)
    for key, value in data.items():
        setattr(user, key, value)
    user.save()
    cache.delete(f"user_stats:{user_id}")
```

## Celery 任务

```python
from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
)
def send_notification(self, user_id: int, message: str):
    try:
        user = User.objects.get(id=user_id)
        deliver_message(user.email, message)
    except User.DoesNotExist:
        logger.warning("用户 %d 不存在，跳过通知", user_id)
    except DeliveryError as exc:
        raise self.retry(exc=exc)
```

## 安全配置

```python
# config/settings/production.py
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = "DENY"
```

## 检查清单

- [ ] 设置文件按环境拆分（base/dev/prod/test）
- [ ] 模型使用抽象基类提供通用字段
- [ ] 自定义 QuerySet 封装常用查询逻辑
- [ ] DRF 序列化器分层（List/Detail/Create）
- [ ] 信号在 `AppConfig.ready()` 中加载
- [ ] Admin 配置 list_display、filter 和 search
- [ ] 缓存策略明确失效机制
- [ ] Celery 任务配置重试和幂等性
- [ ] 生产环境启用所有安全中间件
- [ ] Management commands 支持 `--dry-run` 参数
