---
name: python
description: Python 全栈开发技能集——编码规范、测试策略、Web 框架最佳实践
type: capability
---

## 概述

覆盖 Python 生态的编码规范（PEP 8）、类型提示、测试策略（pytest）以及主流 Web 框架（Django / FastAPI）的最佳实践。

## 包含内容

| 文件 | 说明 |
|------|------|
| [python-patterns.md](python-patterns.md) | Python 惯用法与编码规范 |
| [python-testing.md](python-testing.md) | pytest 测试策略（fixture、mock、参数化） |
| [django-patterns.md](django-patterns.md) | Django 框架最佳实践 |
| [django-tdd.md](django-tdd.md) | Django TDD 工作流 |
| [fastapi-patterns.md](fastapi-patterns.md) | FastAPI 框架模式 |

## 使用方式

```yaml
required_skills:
  - python                    # 引用整个技能集
  - python/fastapi-patterns   # 仅引用特定子文件
```
