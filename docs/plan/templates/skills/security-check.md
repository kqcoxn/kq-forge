---
name: security-check
description: 安全检查清单——在提交前确保代码不引入安全漏洞
type: constraint
priority: 75
depends_on: []
---

## 概述

安全不是事后补救，是编码时的底线。每次提交前都应确认不引入安全漏洞。

> 本 skill 参考了 [ECC](https://github.com/affaan-m/everything-claude-code) 的 security rules。

## 强制检查清单

每次提交前，以下每一项都必须确认：

### 1. 敏感信息

- [ ] 代码中没有硬编码的密钥、密码、token
- [ ] 没有将 `.env` 文件或凭证文件加入版本控制
- [ ] 错误信息不泄露内部结构（堆栈、路径、SQL 语句等）
- [ ] 日志中不打印敏感数据

**如果发现硬编码的密钥：**
1. 立即从代码中移除
2. 将密钥移至环境变量或密钥管理服务
3. 轮换已暴露的密钥（即使只在本地暴露）

### 2. 输入校验

- [ ] 所有用户输入在系统边界处经过校验
- [ ] 使用参数化查询防止 SQL 注入
- [ ] HTML 输出经过转义防止 XSS
- [ ] 文件路径经过校验防止路径遍历
- [ ] 命令拼接经过转义防止命令注入

### 3. 认证与授权

- [ ] 认证检查到位（未登录用户无法访问受保护资源）
- [ ] 授权检查到位（用户只能访问自己有权限的资源）
- [ ] 水平越权防护（用户 A 不能访问用户 B 的数据）
- [ ] CSRF 防护已启用（状态变更操作）

### 4. 数据安全

- [ ] 密码使用安全哈希算法存储（bcrypt/argon2，非 MD5/SHA1）
- [ ] 敏感数据传输使用加密（HTTPS）
- [ ] 数据库连接使用最小权限原则
- [ ] 资源访问有速率限制

## 常见漏洞模式

### SQL 注入

```
❌ 危险：
query = f"SELECT * FROM users WHERE id = {user_input}"

✅ 安全：
query = "SELECT * FROM users WHERE id = ?"
cursor.execute(query, [user_input])
```

### XSS

```
❌ 危险：
element.innerHTML = userInput

✅ 安全：
element.textContent = userInput
// 或使用框架的自动转义机制
```

### 路径遍历

```
❌ 危险：
file_path = os.path.join(base_dir, user_input)

✅ 安全：
file_path = os.path.join(base_dir, user_input)
if not os.path.realpath(file_path).startswith(os.path.realpath(base_dir)):
    raise SecurityError("路径越界")
```

### 命令注入

```
❌ 危险：
os.system(f"ping {user_input}")

✅ 安全：
subprocess.run(["ping", user_input], shell=False)
```

## 安全响应协议

如果在审查中发现安全问题：

1. **停止**——不继续其他工作
2. **评估严重程度**——是否已暴露？影响范围？
3. **修复**——优先修复 CRITICAL 级别问题
4. **轮换**——如有密钥暴露，立即轮换
5. **排查**——检查代码库中是否有类似问题

## 严重程度分级

| 级别 | 定义 | 示例 | 处理 |
|------|------|------|------|
| **CRITICAL** | 可被远程利用，无需认证 | SQL 注入、RCE、硬编码密钥 | 立即修复，阻塞提交 |
| **HIGH** | 可被利用但需要一定条件 | XSS、CSRF、越权访问 | 当前任务内修复 |
| **MEDIUM** | 潜在风险但利用难度高 | 信息泄露、弱加密 | 记录到 memory，计划修复 |
| **LOW** | 最佳实践偏差 | 缺少速率限制、日志不足 | 建议改进 |

## 适用范围

此 skill 适用于所有涉及以下内容的代码变更：
- 用户输入处理
- 数据库操作
- 文件系统操作
- 网络请求
- 认证/授权逻辑
- 密钥/凭证管理
- 第三方 API 集成

对于纯内部逻辑（如算法实现、UI 布局）可以降低检查强度，但敏感信息检查始终生效。
