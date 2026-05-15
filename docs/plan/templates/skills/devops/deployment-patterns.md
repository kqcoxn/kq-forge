---
name: deployment-patterns
type: capability
package: devops
description: CI/CD 管道设计、蓝绿部署、金丝雀发布、回滚策略、环境晋升、密钥管理与基础设施即代码基础。
---

# 部署模式与 CI/CD 实践

## 核心原则

1. **自动化一切** — 从构建到部署全链路自动化，消除人工操作风险
2. **渐进式发布** — 小批量、可观测、可回滚地发布变更
3. **环境一致性** — 开发/测试/生产环境配置差异最小化
4. **不可变部署** — 部署新版本而非修改运行中的实例
5. **快速回滚** — 任何发布都能在分钟级回滚到上一个稳定版本

## CI/CD 管道设计（GitHub Actions）

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test -- --coverage
      - run: pnpm build

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: 依赖漏洞扫描
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  build-image:
    needs: [test, security]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=
            type=raw,value=latest
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    needs: build-image
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: 部署到 Staging
        run: |
          kubectl set image deployment/app \
            app=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            --namespace=staging
      - name: 等待就绪
        run: kubectl rollout status deployment/app --namespace=staging --timeout=300s
      - name: 冒烟测试
        run: curl -f https://staging.example.com/health

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production  # 需要手动审批
    steps:
      - name: 金丝雀部署
        run: |
          kubectl set image deployment/app-canary \
            app=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            --namespace=production
      - name: 观察指标（5分钟）
        run: sleep 300 && ./scripts/check-canary-metrics.sh
      - name: 全量发布
        run: |
          kubectl set image deployment/app \
            app=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            --namespace=production
```

## GitLab CI 示例

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

variables:
  DOCKER_IMAGE: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA

test:
  stage: test
  image: node:20-alpine
  cache:
    key: $CI_COMMIT_REF_SLUG
    paths: [node_modules/]
  script:
    - npm ci
    - npm run lint
    - npm test

build:
  stage: build
  image: docker:24
  services: [docker:24-dind]
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $DOCKER_IMAGE .
    - docker push $DOCKER_IMAGE
  only: [main]

deploy_production:
  stage: deploy
  environment:
    name: production
    url: https://app.example.com
  when: manual  # 手动触发
  script:
    - kubectl set image deployment/app app=$DOCKER_IMAGE
  only: [main]
```

## 蓝绿部署

```yaml
# 蓝绿部署：两套完整环境，瞬间切换流量
# Kubernetes Service 切换标签实现
apiVersion: v1
kind: Service
metadata:
  name: app-service
spec:
  selector:
    app: myapp
    version: green  # 切换到 blue/green
  ports:
    - port: 80
      targetPort: 8080
```

```bash
#!/bin/bash
# 蓝绿切换脚本
CURRENT=$(kubectl get svc app-service -o jsonpath='{.spec.selector.version}')
TARGET=$([ "$CURRENT" = "blue" ] && echo "green" || echo "blue")

echo "当前: $CURRENT → 目标: $TARGET"

# 部署新版本到非活跃环境
kubectl set image deployment/app-$TARGET app=$NEW_IMAGE
kubectl rollout status deployment/app-$TARGET --timeout=300s

# 运行健康检查
if curl -f http://app-$TARGET.internal/health; then
    # 切换流量
    kubectl patch svc app-service -p "{\"spec\":{\"selector\":{\"version\":\"$TARGET\"}}}"
    echo "切换完成: $TARGET 已上线"
else
    echo "健康检查失败，中止切换"
    exit 1
fi
```

## 金丝雀发布

```yaml
# Kubernetes 金丝雀：通过副本比例控制流量
# 主部署：9 个副本
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-stable
spec:
  replicas: 9
  template:
    metadata:
      labels:
        app: myapp
        track: stable

---
# 金丝雀：1 个副本（10% 流量）
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-canary
spec:
  replicas: 1
  template:
    metadata:
      labels:
        app: myapp
        track: canary
```

## 回滚策略

```bash
# Kubernetes 回滚
kubectl rollout undo deployment/app                    # 回滚到上一版本
kubectl rollout undo deployment/app --to-revision=3    # 回滚到指定版本
kubectl rollout history deployment/app                 # 查看历史

# 自动回滚条件（在 CI 中）
deploy_with_rollback() {
    kubectl set image deployment/app app=$NEW_IMAGE
    if ! kubectl rollout status deployment/app --timeout=300s; then
        echo "部署超时，自动回滚"
        kubectl rollout undo deployment/app
        exit 1
    fi
    # 检查错误率
    ERROR_RATE=$(curl -s prometheus/api/v1/query?query=rate(http_errors[5m]))
    if (( $(echo "$ERROR_RATE > 0.05" | bc -l) )); then
        echo "错误率过高 ($ERROR_RATE)，自动回滚"
        kubectl rollout undo deployment/app
        exit 1
    fi
}
```

## 环境晋升

```
开发 → 测试 → 预发布 → 生产

规则：
1. 同一镜像（不可变产物）在所有环境运行
2. 环境差异仅通过配置（环境变量/ConfigMap）区分
3. 每次晋升需通过自动化测试门禁
4. 生产部署需人工审批
```

## 密钥管理

```yaml
# 不要：硬编码密钥
# 不要：提交 .env 到版本控制

# GitHub Actions Secrets
- name: Deploy
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    API_KEY: ${{ secrets.API_KEY }}

# Kubernetes Secrets + External Secrets Operator
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: app-secrets
  data:
    - secretKey: database-url
      remoteRef:
        key: prod/app/database-url
```

## 基础设施即代码

```hcl
# Terraform 示例：声明式基础设施
resource "aws_ecs_service" "app" {
  name            = "app-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 3

  deployment_circuit_breaker {
    enable   = true
    rollback = true  # 部署失败自动回滚
  }

  deployment_controller {
    type = "ECS"
  }
}
```

## 检查清单

- [ ] CI 管道包含：lint → test → security scan → build → deploy
- [ ] 构建产物不可变，同一镜像跨环境部署
- [ ] 生产部署使用金丝雀或蓝绿策略，非全量直接替换
- [ ] 自动回滚机制：部署超时或错误率超阈值时触发
- [ ] 密钥通过 Secrets Manager 管理，不存在代码仓库中
- [ ] 生产部署需人工审批（GitHub Environment protection rules）
- [ ] 部署后自动运行冒烟测试验证核心功能
- [ ] 基础设施变更通过 IaC 管理，有 PR 审查流程
- [ ] 保留至少 5 个历史版本用于快速回滚
- [ ] 部署频率和恢复时间作为团队指标跟踪（DORA metrics）
