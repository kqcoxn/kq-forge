---
name: codebase-onboarding
type: capability
package: documentation
description: 从代码库分析自动生成新人入职文档，涵盖架构概览、核心模块、数据流、开发环境搭建、常见任务与术语表，以及文档与代码同步策略。
---

# 代码库入职文档生成

## 核心原则

1. **自动化优先** — 从代码结构和注释中提取信息，减少手动维护
2. **渐进深入** — 从全局概览到模块细节，分层组织
3. **任务导向** — 围绕"新人需要做什么"组织内容，而非代码结构
4. **保持同步** — 文档与代码变更联动，过时文档比没有文档更有害
5. **可验证** — 文档中的命令和步骤可直接执行验证

## 文档结构模板

```markdown
# [项目名] 开发者入职指南

## 1. 项目概览
- 项目目标与核心价值
- 技术栈摘要
- 系统架构图（高层）

## 2. 快速开始
- 环境要求
- 一键启动命令
- 验证运行成功

## 3. 架构概览
- 分层架构说明
- 核心模块职责
- 模块间依赖关系

## 4. 数据流
- 请求处理流程
- 核心业务流程图
- 数据存储方案

## 5. 开发工作流
- 分支策略
- 提交规范
- CI/CD 流程
- 代码审查要求

## 6. 常见任务
- 添加新 API 端点
- 添加数据库迁移
- 编写和运行测试
- 调试技巧

## 7. 术语表
- 业务术语
- 技术术语
- 缩写对照
```

## 架构概览生成

```python
"""从代码结构自动生成架构概览"""

import ast
from pathlib import Path
from dataclasses import dataclass

@dataclass
class ModuleInfo:
    name: str
    path: str
    description: str
    dependencies: list[str]
    exports: list[str]
    line_count: int

def analyze_project_structure(root: Path) -> dict:
    """分析项目结构，提取模块信息"""
    structure = {
        "modules": [],
        "entry_points": [],
        "config_files": [],
        "test_coverage": {},
    }

    # 识别入口点
    entry_patterns = ["main.py", "app.py", "server.py", "index.ts", "main.go"]
    for pattern in entry_patterns:
        for entry in root.rglob(pattern):
            structure["entry_points"].append(str(entry.relative_to(root)))

    # 分析模块
    for module_dir in find_module_directories(root):
        info = analyze_module(module_dir)
        structure["modules"].append(info)

    return structure

def generate_architecture_doc(structure: dict) -> str:
    """生成架构文档 Markdown"""
    doc = "## 架构概览\n\n"
    doc += "### 模块职责\n\n"
    doc += "| 模块 | 职责 | 依赖 | 代码行数 |\n"
    doc += "|------|------|------|----------|\n"
    for mod in structure["modules"]:
        deps = ", ".join(mod.dependencies[:3])
        doc += f"| `{mod.name}` | {mod.description} | {deps} | {mod.line_count} |\n"
    return doc
```

## 数据流文档

```python
def trace_request_flow(entry_point: str) -> list[str]:
    """追踪请求处理流程，生成数据流文档"""
    # 从路由/控制器开始，追踪调用链
    flow_steps = []

    # 示例输出格式
    return [
        "1. 客户端发送 POST /api/orders",
        "2. AuthMiddleware 验证 JWT Token",
        "3. ValidationMiddleware 校验请求体",
        "4. OrderController.create() 处理请求",
        "5. OrderService.createOrder() 执行业务逻辑",
        "6. PaymentGateway.charge() 调用支付接口",
        "7. OrderRepository.save() 持久化到 PostgreSQL",
        "8. EventBus.publish('order.created') 发布事件",
        "9. 返回 201 Created + 订单详情",
    ]

# 生成 Mermaid 流程图
def generate_flow_diagram(steps: list[str]) -> str:
    """生成 Mermaid 序列图"""
    diagram = "```mermaid\nsequenceDiagram\n"
    diagram += "    Client->>+API Gateway: POST /api/orders\n"
    diagram += "    API Gateway->>+Auth: 验证 Token\n"
    diagram += "    Auth-->>-API Gateway: 验证通过\n"
    diagram += "    API Gateway->>+OrderService: createOrder()\n"
    diagram += "    OrderService->>+PaymentGateway: charge()\n"
    diagram += "    PaymentGateway-->>-OrderService: 支付成功\n"
    diagram += "    OrderService->>+Database: save(order)\n"
    diagram += "    Database-->>-OrderService: 保存成功\n"
    diagram += "    OrderService-->>-API Gateway: 订单创建成功\n"
    diagram += "    API Gateway-->>-Client: 201 Created\n"
    diagram += "```"
    return diagram
```

## 开发环境搭建

```markdown
## 快速开始

### 环境要求

| 工具 | 最低版本 | 安装方式 |
|------|---------|---------|
| Node.js | 20.x | `nvm install 20` |
| pnpm | 8.x | `corepack enable` |
| Docker | 24.x | [官方安装](https://docs.docker.com/install) |
| PostgreSQL | 16.x | 通过 Docker 提供 |

### 一键启动

```bash
# 1. 克隆仓库
git clone <repo-url> && cd <project>

# 2. 安装依赖
pnpm install

# 3. 启动基础设施（数据库、Redis）
docker compose up -d

# 4. 初始化数据库
pnpm db:migrate
pnpm db:seed

# 5. 启动开发服务器
pnpm dev

# 6. 验证：访问 http://localhost:3000/health
```

### 验证清单
- [ ] `pnpm dev` 启动无报错
- [ ] 访问 http://localhost:3000 看到首页
- [ ] 运行 `pnpm test` 全部通过
- [ ] 能成功登录测试账号 (test@example.com / password)
```

## 常见任务指南

```markdown
## 常见任务

### 添加新 API 端点

1. 在 `src/routes/` 下创建路由文件
2. 在 `src/services/` 下实现业务逻辑
3. 在 `src/validators/` 下添加请求校验
4. 编写测试：`tests/api/your-endpoint.test.ts`
5. 运行 `pnpm test:api` 验证

参考示例：`src/routes/users.ts`（最简单的 CRUD 端点）

### 添加数据库迁移

```bash
# 创建迁移文件
pnpm db:migration:create add_column_to_users

# 编辑迁移文件：migrations/YYYYMMDD_add_column_to_users.sql

# 执行迁移
pnpm db:migrate

# 回滚（如果需要）
pnpm db:migrate:rollback
```
```

## 文档同步策略

```yaml
# .github/workflows/docs-sync.yml
name: 文档同步检查

on:
  pull_request:
    paths:
      - 'src/**'
      - 'docs/**'

jobs:
  check-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: 检查 API 文档是否同步
        run: |
          # 如果 src/routes/ 有变更但 docs/api/ 没有变更，提醒更新
          if git diff --name-only origin/main | grep -q "src/routes/"; then
            if ! git diff --name-only origin/main | grep -q "docs/api/"; then
              echo "::warning::API 路由有变更，请检查是否需要更新 API 文档"
            fi
          fi

      - name: 验证文档中的命令可执行
        run: |
          # 提取文档中的 bash 代码块并验证语法
          python scripts/validate_doc_commands.py docs/
```

## 术语表生成

```python
def extract_glossary(codebase_path: Path) -> dict[str, str]:
    """从代码注释和文档中提取术语定义"""
    glossary = {}

    # 从 README 和文档中提取
    for doc_file in codebase_path.rglob("*.md"):
        # 查找定义模式："**术语** — 解释" 或 "术语：解释"
        ...

    # 从代码注释中提取领域术语
    for source_file in codebase_path.rglob("*.py"):
        tree = ast.parse(source_file.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef) and node.body:
                docstring = ast.get_docstring(node)
                if docstring:
                    glossary[node.name] = docstring.split('\n')[0]

    return glossary
```

## 检查清单

- [ ] 入职文档包含一键启动命令，新人 30 分钟内可运行项目
- [ ] 架构概览图反映当前系统结构（非历史版本）
- [ ] 数据流文档覆盖核心业务流程（≥ 3 个关键流程）
- [ ] 常见任务指南包含具体步骤和参考示例
- [ ] 术语表覆盖所有业务领域特定词汇
- [ ] 文档中的命令和路径经过验证可执行
- [ ] CI 中有文档同步检查（代码变更提醒更新文档）
- [ ] 文档使用 Mermaid 图表而非外部图片（易于维护）
- [ ] 每季度审查文档准确性，标记过时内容
- [ ] 新人入职后收集反馈，持续改进文档
