---
name: security-scan
type: capability
package: security-advanced
description: 自动化安全扫描管道，涵盖 SAST/DAST/SCA 工具配置（Semgrep、Snyk、Trivy、OWASP ZAP）、CI 集成、漏洞分级与误报管理。
---

# 自动化安全扫描管道

## 核心原则

1. **左移安全** — 在开发阶段尽早发现漏洞，修复成本最低
2. **多层防御** — SAST + DAST + SCA 组合覆盖不同类型漏洞
3. **零噪音** — 精心调优规则，消除误报，开发者才会信任结果
4. **门禁集成** — 高危漏洞阻断合并，中危漏洞限期修复
5. **持续扫描** — 不仅在 PR 时扫描，定期全量扫描捕获新披露漏洞

## 扫描类型概览

```
SAST（静态应用安全测试）
├── 分析源代码，不需要运行应用
├── 发现：注入、硬编码密钥、不安全的加密
├── 工具：Semgrep, CodeQL, SonarQube
└── 时机：每次 PR / 每次提交

DAST（动态应用安全测试）
├── 对运行中的应用发送攻击请求
├── 发现：XSS、CSRF、安全头缺失、配置错误
├── 工具：OWASP ZAP, Burp Suite, Nuclei
└── 时机：部署到测试环境后

SCA（软件组成分析）
├── 扫描依赖中的已知漏洞
├── 发现：CVE、许可证合规问题
├── 工具：Snyk, Trivy, Dependabot, pip-audit
└── 时机：每次 PR + 每日定时扫描
```

## Semgrep 配置（SAST）

```yaml
# .semgrep.yml — 自定义规则
rules:
  - id: hardcoded-secret
    patterns:
      - pattern: |
          $KEY = "..."
      - metavariable-regex:
          metavariable: $KEY
          regex: (password|secret|api_key|token|private_key)
    message: "检测到硬编码密钥: $KEY"
    severity: ERROR
    languages: [python, javascript, typescript, go]

  - id: sql-injection
    patterns:
      - pattern: |
          cursor.execute(f"... {$USER_INPUT} ...")
      - pattern: |
          cursor.execute("..." + $USER_INPUT + "...")
    message: "潜在 SQL 注入：使用参数化查询替代字符串拼接"
    severity: ERROR
    languages: [python]
    fix: |
      cursor.execute("... %s ...", ($USER_INPUT,))

  - id: ssrf-risk
    patterns:
      - pattern: |
          requests.get($URL, ...)
      - pattern-not: |
          requests.get("...", ...)
    message: "用户可控 URL 可能导致 SSRF，请添加 URL 白名单验证"
    severity: WARNING
    languages: [python]
```

```bash
# 运行 Semgrep
semgrep scan --config=auto --config=.semgrep.yml \
  --error --severity=ERROR \
  --json --output=semgrep-results.json

# 使用社区规则集
semgrep scan --config="p/owasp-top-ten" --config="p/secrets"
```

## Snyk 配置（SCA）

```yaml
# .snyk — 忽略规则（已评估的误报或可接受风险）
ignore:
  SNYK-JS-LODASH-1018905:
    - '*':
        reason: "已通过输入验证缓解，不影响我们的使用场景"
        expires: 2024-06-01T00:00:00.000Z
        created: 2024-03-01T00:00:00.000Z

patch: {}
```

```bash
# 依赖漏洞扫描
snyk test --severity-threshold=high --json > snyk-results.json

# 容器镜像扫描
snyk container test myapp:latest --severity-threshold=high

# IaC 扫描（Terraform/CloudFormation）
snyk iac test --severity-threshold=medium

# 持续监控（注册项目后自动扫描新漏洞）
snyk monitor
```

## Trivy 配置（容器 + IaC）

```yaml
# trivy.yaml — 配置文件
severity:
  - CRITICAL
  - HIGH

vulnerability:
  type:
    - os
    - library

ignore-unfixed: true  # 忽略无修复方案的漏洞

# 忽略特定 CVE
ignorefile: .trivyignore
```

```bash
# 容器镜像扫描
trivy image --severity HIGH,CRITICAL --exit-code 1 myapp:latest

# 文件系统扫描（源码依赖）
trivy fs --severity HIGH,CRITICAL .

# IaC 扫描
trivy config --severity HIGH,CRITICAL ./terraform/

# 生成 SBOM（软件物料清单）
trivy image --format spdx-json --output sbom.json myapp:latest
```

## OWASP ZAP 配置（DAST）

```yaml
# zap-config.yaml — ZAP 自动化配置
env:
  contexts:
    - name: "应用上下文"
      urls: ["https://staging.example.com"]
      includePaths: ["https://staging.example.com/api/.*"]
      excludePaths: ["https://staging.example.com/api/health"]
      authentication:
        method: "json"
        parameters:
          loginUrl: "https://staging.example.com/api/auth/login"
          loginRequestData: '{"email":"test@example.com","password":"testpass"}'
          tokenExtract: "$.token"
          tokenHeader: "Authorization: Bearer {token}"

jobs:
  - type: spider
    parameters:
      maxDuration: 5  # 分钟
      maxDepth: 5

  - type: activeScan
    parameters:
      maxRuleDurationInMins: 2
      policy: "API-Scan"

  - type: report
    parameters:
      template: "json"
      reportFile: "zap-report.json"
      reportTitle: "安全扫描报告"
```

```bash
# Docker 运行 ZAP
docker run --rm -v $(pwd):/zap/wrk \
  ghcr.io/zaproxy/zaproxy:stable \
  zap.sh -cmd -autorun /zap/wrk/zap-config.yaml
```

## CI 集成

```yaml
# .github/workflows/security.yml
name: 安全扫描

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'  # 每周一全量扫描

jobs:
  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Semgrep SAST
        uses: semgrep/semgrep-action@v1
        with:
          config: >-
            p/owasp-top-ten
            p/secrets
            .semgrep.yml
        env:
          SEMGREP_APP_TOKEN: ${{ secrets.SEMGREP_APP_TOKEN }}

  sca:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Snyk 依赖扫描
        uses: snyk/actions/node@master
        with:
          args: --severity-threshold=high
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  container:
    runs-on: ubuntu-latest
    needs: [sast, sca]
    steps:
      - uses: actions/checkout@v4
      - name: 构建镜像
        run: docker build -t myapp:${{ github.sha }} .
      - name: Trivy 镜像扫描
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp:${{ github.sha }}
          severity: CRITICAL,HIGH
          exit-code: 1

  dast:
    runs-on: ubuntu-latest
    needs: [container]
    if: github.event_name == 'schedule'  # 仅定时任务运行 DAST
    steps:
      - uses: actions/checkout@v4
      - name: 部署到测试环境
        run: ./scripts/deploy-staging.sh
      - name: OWASP ZAP 扫描
        uses: zaproxy/action-full-scan@v0.9.0
        with:
          target: https://staging.example.com
          rules_file_name: zap-rules.tsv
```

## 漏洞分级与处理

```yaml
# 漏洞处理 SLA
severity_sla:
  critical:
    description: "可远程利用，影响数据安全或系统可用性"
    fix_deadline: 24 小时
    action: 阻断部署，立即修复
    examples: [RCE, SQL注入, 认证绕过]

  high:
    description: "可利用但需要特定条件"
    fix_deadline: 7 天
    action: 阻断 PR 合并
    examples: [XSS, SSRF, 权限提升]

  medium:
    description: "有限影响或利用难度高"
    fix_deadline: 30 天
    action: 创建工单跟踪
    examples: [信息泄露, 弱加密, CSRF]

  low:
    description: "最佳实践违规，无直接安全影响"
    fix_deadline: 90 天
    action: 纳入技术债务
    examples: [安全头缺失, 过时依赖]
```

## 误报管理

```yaml
# 误报处理流程
false_positive_workflow:
  1_identify: "开发者标记为误报"
  2_review: "安全团队确认"
  3_suppress: "添加到忽略规则（带过期时间和原因）"
  4_audit: "每季度审查所有忽略规则"

# Semgrep 行内忽略
# nosemgrep: hardcoded-secret  # 这是测试用的 mock 值
TEST_API_KEY = "test_key_not_real"

# Trivy 忽略文件
# .trivyignore
CVE-2023-12345  # 不影响我们的使用场景，已通过输入验证缓解
CVE-2023-67890  # 等待上游修复，预计下个版本解决
```

## 扫描结果聚合

```python
def aggregate_scan_results(semgrep_file, snyk_file, trivy_file, zap_file) -> dict:
    """聚合多个扫描工具的结果，去重并统一格式"""
    findings = []

    # 统一格式
    for finding in parse_semgrep(semgrep_file):
        findings.append({
            "source": "semgrep",
            "type": "SAST",
            "severity": finding["severity"],
            "title": finding["check_id"],
            "file": finding["path"],
            "line": finding["start"]["line"],
            "description": finding["message"],
            "cwe": finding.get("metadata", {}).get("cwe"),
        })

    # 去重：同一位置的同类漏洞只保留一条
    deduplicated = deduplicate_by_location(findings)

    # 按严重程度排序
    deduplicated.sort(key=lambda f: severity_order(f["severity"]))

    return {
        "total": len(deduplicated),
        "by_severity": Counter(f["severity"] for f in deduplicated),
        "by_type": Counter(f["type"] for f in deduplicated),
        "findings": deduplicated,
    }
```

## 检查清单

- [ ] SAST 扫描集成到每次 PR（Semgrep / CodeQL）
- [ ] SCA 扫描覆盖所有依赖（Snyk / Dependabot）
- [ ] 容器镜像扫描在构建后自动执行（Trivy）
- [ ] DAST 扫描定期运行在测试环境（OWASP ZAP）
- [ ] Critical/High 漏洞阻断 PR 合并和部署
- [ ] 漏洞处理 SLA 已定义并跟踪
- [ ] 误报有审查流程，忽略规则有过期时间
- [ ] 扫描结果聚合到统一仪表盘
- [ ] 每周安全扫描报告发送给团队
- [ ] 新披露的 CVE 通过定时扫描在 24 小时内发现
