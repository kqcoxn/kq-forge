---
name: docker-patterns
type: capability
package: devops
description: Docker 最佳实践，涵盖多阶段构建、层缓存优化、安全加固、docker-compose 开发环境、健康检查、.dockerignore 与镜像瘦身。
---

# Docker 最佳实践

## 核心原则

1. **最小化攻击面** — 使用最小基础镜像，非 root 用户运行
2. **层缓存友好** — 变化频率低的指令放前面，最大化缓存命中
3. **构建与运行分离** — 多阶段构建，运行镜像不含构建工具
4. **可重现构建** — 锁定依赖版本，固定基础镜像 digest
5. **一容器一进程** — 每个容器只运行一个主进程

## 多阶段构建

```dockerfile
# === 构建阶段 ===
FROM node:20-alpine AS builder
WORKDIR /app

# 先复制依赖文件（利用层缓存）
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# 再复制源码并构建
COPY . .
RUN pnpm build

# === 运行阶段 ===
FROM node:20-alpine AS runner
WORKDIR /app

# 安全：创建非 root 用户
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser

# 只复制运行所需文件
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

USER appuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
```

```dockerfile
# Go 应用：静态二进制，scratch 镜像
FROM golang:1.22-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/server ./cmd/server

FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/server /server
USER 65534:65534
ENTRYPOINT ["/server"]
```

## 层缓存优化

```dockerfile
# 反模式：每次源码变更都重新安装依赖
COPY . .
RUN pip install -r requirements.txt

# 正确：分离依赖安装和源码复制
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# 使用 .dockerignore 排除不需要的文件
# 减少构建上下文大小，加速传输
```

## 安全加固

```dockerfile
# 1. 固定基础镜像版本（使用 digest 更安全）
FROM python:3.12-slim@sha256:abc123...

# 2. 非 root 用户
RUN useradd --create-home --shell /bin/bash appuser
USER appuser

# 3. 只读文件系统（docker run 时）
# docker run --read-only --tmpfs /tmp myapp

# 4. 不安装不必要的包
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 5. 构建时使用 secrets（不留在镜像层中）
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) npm install

# 6. 扫描漏洞
# docker scout cves myimage:latest
# trivy image myimage:latest
```

## Docker Compose 开发环境

```yaml
# docker-compose.yml
services:
  app:
    build:
      context: .
      target: development  # 使用开发阶段
    ports:
      - "3000:3000"
      - "9229:9229"  # 调试端口
    volumes:
      - .:/app          # 源码挂载，支持热重载
      - /app/node_modules  # 排除 node_modules
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://user:pass@db:5432/app
    depends_on:
      db:
        condition: service_healthy
    develop:
      watch:
        - action: sync
          path: ./src
          target: /app/src
        - action: rebuild
          path: package.json

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: app
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d app"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

volumes:
  pgdata:
```

## 健康检查

```dockerfile
# HTTP 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# TCP 端口检查（无 curl 的镜像）
HEALTHCHECK --interval=30s --timeout=3s \
    CMD nc -z localhost 8080 || exit 1

# 自定义脚本
COPY healthcheck.sh /usr/local/bin/
HEALTHCHECK --interval=30s CMD ["healthcheck.sh"]
```

## .dockerignore

```gitignore
# 版本控制
.git
.gitignore

# 依赖目录
node_modules
vendor
__pycache__

# 构建产物
dist
build
*.egg-info

# 开发文件
.env*
.vscode
.idea
*.md
docs/
tests/

# Docker 相关
Dockerfile*
docker-compose*
.dockerignore
```

## 镜像瘦身技巧

```dockerfile
# 1. 选择合适的基础镜像
# alpine (~5MB) < slim (~80MB) < full (~900MB)
FROM python:3.12-alpine  # 最小
FROM python:3.12-slim    # 平衡（推荐）

# 2. 合并 RUN 指令减少层数
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    pip install --no-cache-dir -r requirements.txt && \
    apt-get purge -y gcc && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# 3. 使用 --no-cache-dir
RUN pip install --no-cache-dir -r requirements.txt

# 4. 多阶段构建只复制产物
COPY --from=builder /app/dist ./dist

# 5. 压缩二进制
RUN upx --best /app/server  # Go/Rust 二进制压缩
```

## 检查清单

- [ ] 使用多阶段构建，运行镜像不含编译工具
- [ ] 基础镜像使用 `-slim` 或 `-alpine` 变体
- [ ] 容器以非 root 用户运行
- [ ] 依赖安装与源码复制分层，最大化缓存
- [ ] 配置 `.dockerignore` 排除无关文件
- [ ] 设置 `HEALTHCHECK` 指令
- [ ] 敏感信息通过 `--mount=type=secret` 传入，不写入镜像层
- [ ] 固定基础镜像版本，定期更新
- [ ] 生产镜像大小 < 200MB（应用类）
- [ ] 使用 `docker scout` 或 `trivy` 扫描漏洞
