---
name: code-tour
type: capability
package: documentation
description: 创建引导式代码导览（VS Code CodeTour 格式），涵盖导览结构设计、入口点与关键流程标注、面向不同受众的导览维护策略。
---

# 代码导览（Code Tour）指南

## 核心原则

1. **叙事驱动** — 导览是一个故事，有开头、发展和结尾
2. **受众明确** — 不同角色需要不同深度的导览
3. **聚焦流程** — 沿着数据/请求流动路径组织，而非文件结构
4. **可维护** — 导览与代码同步更新，过时导览及时删除
5. **渐进深入** — 从高层概览到实现细节，读者可选择深度

## VS Code CodeTour 格式

```json
// .tours/request-lifecycle.tour
{
  "$schema": "https://aka.ms/codetour-schema",
  "title": "请求生命周期",
  "description": "跟踪一个 HTTP 请求从进入到响应的完整流程",
  "isPrimary": true,
  "steps": [
    {
      "file": "src/main.ts",
      "line": 15,
      "title": "1. 应用入口",
      "description": "应用从这里启动，创建 Express 实例并注册中间件。\n\n注意中间件的注册顺序很重要：日志 → 认证 → 路由 → 错误处理。"
    },
    {
      "file": "src/middleware/auth.ts",
      "line": 23,
      "title": "2. 认证中间件",
      "description": "每个请求首先经过认证中间件。\n\n- 从 `Authorization` 头提取 JWT\n- 验证签名和过期时间\n- 将用户信息附加到 `req.user`\n\n公开路由通过 `@Public()` 装饰器跳过认证。"
    },
    {
      "file": "src/routes/orders.ts",
      "line": 45,
      "title": "3. 路由处理",
      "description": "路由将请求分发到对应的控制器方法。\n\n```\nPOST /api/orders → OrderController.create()\nGET  /api/orders → OrderController.list()\nGET  /api/orders/:id → OrderController.getById()\n```"
    },
    {
      "file": "src/services/order.service.ts",
      "line": 67,
      "title": "4. 业务逻辑",
      "description": "Service 层包含核心业务逻辑，不依赖 HTTP 框架。\n\n这里执行：\n1. 业务规则验证\n2. 调用外部服务（支付网关）\n3. 持久化数据\n4. 发布领域事件"
    },
    {
      "file": "src/repositories/order.repository.ts",
      "line": 30,
      "title": "5. 数据持久化",
      "description": "Repository 封装数据库操作，Service 层通过接口调用。\n\n使用 Prisma ORM，事务通过 `$transaction` 保证一致性。"
    },
    {
      "file": "src/events/order-created.handler.ts",
      "line": 12,
      "title": "6. 事件处理（异步）",
      "description": "订单创建后发布 `order.created` 事件。\n\n事件处理器异步执行：\n- 发送确认邮件\n- 更新库存\n- 通知仓库系统\n\n即使事件处理失败，订单创建仍然成功（最终一致性）。"
    }
  ]
}
```

## 导览类型设计

```json
// .tours/ 目录结构
{
  "tours": [
    {
      "file": "01-overview.tour",
      "audience": "所有人",
      "purpose": "项目全局概览，5分钟了解系统架构"
    },
    {
      "file": "02-request-lifecycle.tour",
      "audience": "新开发者",
      "purpose": "跟踪请求完整生命周期"
    },
    {
      "file": "03-add-new-feature.tour",
      "audience": "新开发者",
      "purpose": "手把手教如何添加新功能"
    },
    {
      "file": "04-auth-system.tour",
      "audience": "安全审查者",
      "purpose": "认证授权系统深度解析"
    },
    {
      "file": "05-data-model.tour",
      "audience": "领域专家",
      "purpose": "核心数据模型和业务规则"
    },
    {
      "file": "06-deployment.tour",
      "audience": "DevOps",
      "purpose": "部署流程和基础设施"
    }
  ]
}
```

## 面向不同受众

```json
// 新人导览：侧重"怎么做"
{
  "title": "新功能开发指南",
  "description": "跟随这个导览，你将学会如何添加一个完整的 CRUD 功能",
  "steps": [
    {
      "title": "Step 1: 创建数据模型",
      "file": "prisma/schema.prisma",
      "line": 45,
      "description": "首先在 Prisma schema 中定义数据模型。\n\n**你的任务：** 参考 `Order` 模型的结构，添加你的新模型。\n\n完成后运行：\n```bash\npnpm prisma migrate dev --name add_your_model\n```"
    }
  ]
}

// 审查者导览：侧重"为什么"和"风险点"
{
  "title": "安全审查导览",
  "description": "关键安全决策点和潜在风险区域",
  "steps": [
    {
      "title": "认证 Token 生成",
      "file": "src/auth/token.service.ts",
      "line": 28,
      "description": "## 安全决策\n\n- 使用 RS256 算法（非对称签名）\n- Token 有效期 15 分钟\n- Refresh Token 有效期 7 天，存储在 HttpOnly Cookie\n\n## 风险点\n- 密钥轮换策略见 `docs/security/key-rotation.md`\n- Token 撤销通过 Redis 黑名单实现"
    }
  ]
}
```

## 导览编写最佳实践

```json
// 好的 step 描述
{
  "title": "错误处理策略",
  "file": "src/middleware/error-handler.ts",
  "line": 15,
  "description": "## 全局错误处理\n\n所有未捕获的异常最终到达这里。\n\n### 处理策略\n- `ValidationError` → 400 + 字段级错误详情\n- `NotFoundError` → 404\n- `UnauthorizedError` → 401 + 清除 Cookie\n- 其他异常 → 500 + 通用错误消息（不暴露内部细节）\n\n### 关键设计决策\n生产环境不返回堆栈信息，但会记录到 Sentry。\n\n### 相关文件\n- 自定义异常定义：`src/errors/`\n- 错误响应格式：`src/types/error-response.ts`"
}

// 避免的写法
{
  "description": "这是错误处理中间件。"  // 太简短，没有价值
}
```

## 维护策略

```yaml
# 导览维护自动化

# 1. CI 检查导览引用的文件和行号是否仍然有效
# .github/workflows/tour-check.yml
name: 验证 Code Tour
on:
  push:
    paths: ['src/**', '.tours/**']
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: 验证导览步骤
        run: |
          python scripts/validate_tours.py .tours/
          # 检查：文件是否存在、行号是否在范围内、
          # 引用的函数/类是否仍然存在
```

```python
# scripts/validate_tours.py
import json
from pathlib import Path

def validate_tour(tour_path: Path, repo_root: Path) -> list[str]:
    """验证导览文件中的引用是否有效"""
    errors = []
    tour = json.loads(tour_path.read_text())

    for i, step in enumerate(tour.get("steps", [])):
        file_path = repo_root / step["file"]

        # 检查文件存在
        if not file_path.exists():
            errors.append(f"Step {i+1}: 文件不存在 {step['file']}")
            continue

        # 检查行号有效
        lines = file_path.read_text().splitlines()
        if step.get("line", 0) > len(lines):
            errors.append(f"Step {i+1}: 行号 {step['line']} 超出文件范围 "
                         f"({len(lines)} 行)")

    return errors
```

## 导览模板

```json
{
  "$schema": "https://aka.ms/codetour-schema",
  "title": "[导览标题]",
  "description": "[一句话描述导览目的和目标受众]",
  "steps": [
    {
      "title": "1. [步骤标题]",
      "file": "[相对路径]",
      "line": 0,
      "description": "## [小节标题]\n\n[解释这段代码做什么、为什么这样做]\n\n### 关键点\n- [要点1]\n- [要点2]\n\n### 下一步\n[引导读者关注什么]"
    }
  ]
}
```

## 检查清单

- [ ] 项目至少有一个"全局概览"导览（5-10 步）
- [ ] 核心业务流程有对应的导览（请求生命周期、数据流）
- [ ] 新人入职导览包含"动手做"的步骤
- [ ] 每个 step 的 description 解释"为什么"而非仅"是什么"
- [ ] 导览按受众分类：新人、审查者、领域专家
- [ ] CI 中验证导览引用的文件和行号有效
- [ ] 代码重构后同步更新相关导览
- [ ] 导览总步数控制在 5-15 步（太长则拆分）
- [ ] 使用 Markdown 格式化 description，提升可读性
- [ ] 定期（每月）检查导览是否过时，删除无效导览
