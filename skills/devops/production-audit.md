---
name: production-audit
type: constraint
package: devops
description: 生产环境上线前审计清单，涵盖日志、监控、告警、备份、灾难恢复、安全头、限流、错误追踪、性能基线与运维手册。
---

# 生产环境审计清单

## 核心原则

1. **可观测性** — 系统行为必须可见、可查询、可追溯
2. **韧性设计** — 假设一切都会失败，确保优雅降级和快速恢复
3. **安全纵深** — 多层防御，不依赖单一安全措施
4. **自动化运维** — 常见故障有自动化响应，减少人工介入
5. **文档即代码** — 运维手册版本化管理，定期演练验证

## 日志

```yaml
# 结构化日志要求
logging:
  format: json
  fields:
    - timestamp (ISO 8601)
    - level (debug/info/warn/error)
    - message
    - service_name
    - trace_id        # 分布式追踪关联
    - user_id         # 脱敏处理
    - request_id
    - duration_ms

  # 日志级别策略
  levels:
    production: info   # 生产环境不开 debug
    staging: debug

  # 敏感信息过滤
  redact:
    - password
    - token
    - credit_card
    - ssn
```

审计项：
- [ ] 所有服务输出结构化 JSON 日志
- [ ] 日志包含 trace_id 支持分布式追踪
- [ ] 敏感信息（密码、token）已脱敏
- [ ] 日志保留策略：热存储 7 天，冷存储 90 天
- [ ] 日志聚合平台已配置（ELK/Loki/CloudWatch）
- [ ] 错误日志包含足够上下文用于复现问题

## 监控

```yaml
# 关键指标（RED 方法）
metrics:
  rate:     # 请求速率
    - http_requests_total
    - queue_messages_processed_total
  errors:   # 错误率
    - http_errors_total (按状态码分组)
    - unhandled_exceptions_total
  duration: # 延迟分布
    - http_request_duration_seconds (p50/p95/p99)
    - database_query_duration_seconds

  # 资源指标（USE 方法）
  resources:
    - cpu_usage_percent
    - memory_usage_bytes
    - disk_usage_percent
    - connection_pool_active
    - connection_pool_idle
```

审计项：
- [ ] 应用暴露 Prometheus 格式指标端点
- [ ] 仪表盘覆盖：请求量、错误率、延迟 P95/P99
- [ ] 资源监控：CPU、内存、磁盘、连接池
- [ ] 业务指标：注册量、订单量、支付成功率
- [ ] 依赖服务健康状态可见（数据库、缓存、第三方 API）

## 告警

```yaml
# 告警规则示例
alerts:
  - name: 高错误率
    condition: error_rate > 5% for 5m
    severity: critical
    channel: pagerduty
    runbook: docs/runbooks/high-error-rate.md

  - name: 延迟升高
    condition: p99_latency > 2s for 10m
    severity: warning
    channel: slack

  - name: 磁盘空间不足
    condition: disk_usage > 85%
    severity: warning
    channel: slack

  - name: 证书即将过期
    condition: cert_expiry < 14d
    severity: warning
    channel: email
```

审计项：
- [ ] Critical 告警接入 PagerDuty/电话通知
- [ ] 告警规则覆盖：可用性、延迟、错误率、资源
- [ ] 每条告警关联对应的 Runbook
- [ ] 告警抑制规则避免风暴（相同告警 5 分钟内不重复）
- [ ] 定期审查告警噪音，消除无效告警

## 备份与灾难恢复

```yaml
backup:
  database:
    frequency: 每日全量 + 每小时增量
    retention: 30 天
    location: 跨区域存储（不同 AZ）
    encryption: AES-256
    test_restore: 每月一次

  file_storage:
    frequency: 实时同步（跨区域复制）
    versioning: 启用（保留 30 天历史版本）

disaster_recovery:
  rpo: 1 小时（最大可接受数据丢失）
  rto: 30 分钟（最大可接受恢复时间）
  failover: 自动（DNS 切换 + 数据库只读副本提升）
  drill: 每季度一次故障演练
```

审计项：
- [ ] 数据库自动备份已配置并验证恢复流程
- [ ] 备份存储在不同区域/可用区
- [ ] RPO/RTO 目标已定义并经过演练验证
- [ ] 灾难恢复流程文档化，团队成员熟悉
- [ ] 每月执行一次备份恢复测试

## 安全头与传输安全

```nginx
# Nginx 安全头配置
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "0" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

审计项：
- [ ] HTTPS 强制（HSTS 已启用，max-age ≥ 1 年）
- [ ] 安全头已配置（CSP、X-Frame-Options、X-Content-Type-Options）
- [ ] TLS 1.2+ 仅允许强密码套件
- [ ] Cookie 设置 Secure、HttpOnly、SameSite 属性
- [ ] CORS 策略限制允许的源

## 限流与过载保护

```yaml
rate_limiting:
  global: 10000 req/s
  per_ip: 100 req/min
  per_user: 1000 req/min
  per_endpoint:
    /api/login: 5 req/min per IP
    /api/upload: 10 req/min per user

  response_on_limit:
    status: 429
    headers:
      Retry-After: <seconds>
    body: { "error": "请求过于频繁，请稍后重试" }

circuit_breaker:
  threshold: 50% 错误率
  window: 30s
  recovery: 半开状态，逐步恢复流量
```

审计项：
- [ ] API 限流已配置（全局 + 每用户 + 每 IP）
- [ ] 登录/注册等敏感端点有更严格的限制
- [ ] 熔断器保护下游依赖
- [ ] 429 响应包含 Retry-After 头
- [ ] 过载时优雅降级而非完全不可用

## 错误追踪

审计项：
- [ ] 错误追踪平台已接入（Sentry/Bugsnag/Datadog）
- [ ] 未捕获异常自动上报并包含堆栈和上下文
- [ ] 错误按影响范围分级（影响用户数、频率）
- [ ] 关键错误自动创建工单
- [ ] Source Map 已上传支持前端错误定位

## 性能基线

审计项：
- [ ] 核心 API 响应时间基线已建立（P50/P95/P99）
- [ ] 页面加载性能基线（LCP < 2.5s, FID < 100ms, CLS < 0.1）
- [ ] 数据库查询无慢查询（> 1s 的查询已优化或加索引）
- [ ] 负载测试验证系统可承受预期峰值 2x 流量
- [ ] 性能回归检测集成到 CI（Lighthouse CI / k6）

## 运维手册（Runbook）

```markdown
# Runbook 模板
## 问题：[告警名称]
### 症状
- 描述用户可见的影响

### 诊断步骤
1. 检查 [具体指标/日志]
2. 确认 [根因假设]

### 修复步骤
1. [具体操作命令]
2. [验证恢复]

### 升级路径
- 5 分钟未恢复 → 通知 Tech Lead
- 15 分钟未恢复 → 通知 CTO

### 事后复盘
- 根因分析模板链接
```

审计项：
- [ ] 每个 Critical 告警有对应 Runbook
- [ ] Runbook 包含诊断步骤、修复命令、升级路径
- [ ] 新成员可按 Runbook 独立处理常见故障
- [ ] Runbook 每季度审查更新
- [ ] 值班轮换制度已建立

## 总检查清单

- [ ] **日志**：结构化、可追踪、已脱敏、有保留策略
- [ ] **监控**：RED + USE 指标全覆盖，仪表盘可用
- [ ] **告警**：分级通知、关联 Runbook、无噪音
- [ ] **备份**：自动化、跨区域、定期验证恢复
- [ ] **安全**：HTTPS、安全头、限流、CORS
- [ ] **错误追踪**：自动上报、分级、可定位
- [ ] **性能**：基线已建立、回归可检测
- [ ] **运维**：Runbook 完备、值班制度、演练计划
