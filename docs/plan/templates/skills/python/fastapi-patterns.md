---
name: fastapi-patterns
type: capability
package: python
description: FastAPI 框架最佳实践，涵盖项目结构、依赖注入、Pydantic 模型、中间件、认证与异步数据库集成。
---

# FastAPI 框架模式

## 核心原则

1. **异步优先** — 充分利用 async/await 提升并发性能
2. **类型驱动** — Pydantic 模型作为数据验证和文档的单一来源
3. **依赖注入** — 通过 Depends 实现松耦合和可测试性
4. **自动文档** — OpenAPI 规范自动生成，保持 API 文档与代码同步
5. **分层架构** — 路由、服务、数据访问层职责分离

## 项目结构

```
src/
├── app/
│   ├── __init__.py
│   ├── main.py              # 应用入口，挂载路由
│   ├── config.py            # 配置管理
│   ├── dependencies.py      # 共享依赖
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── users.py
│   │   └── orders.py
│   ├── schemas/             # Pydantic 模型
│   │   ├── __init__.py
│   │   ├── user.py
│   │   └── order.py
│   ├── models/              # ORM 模型
│   │   └── user.py
│   ├── services/            # 业务逻辑
│   │   └── user_service.py
│   ├── middleware/
│   │   └── logging.py
│   └── utils/
│       └── security.py
└── tests/
    ├── conftest.py
    └── test_users.py
```

## Pydantic 模型

```python
from pydantic import BaseModel, Field, field_validator, ConfigDict
from datetime import datetime

# 基础 Schema 分层
class UserBase(BaseModel):
    email: str = Field(..., examples=["user@example.com"])
    name: str = Field(..., min_length=1, max_length=100)

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("密码必须包含大写字母")
        return v

class UserResponse(UserBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Settings 管理
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    redis_url: str = "redis://localhost:6379"
    secret_key: str
    debug: bool = False

    model_config = ConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
```

## 依赖注入

```python
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

# 数据库会话依赖
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

# 当前用户依赖
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_token(token)
    user = await db.get(User, payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user

# 权限检查依赖
def require_role(role: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        if role not in user.roles:
            raise HTTPException(status_code=403, detail="权限不足")
        return user
    return checker

# 在路由中使用
@router.get("/admin/users")
async def list_users(
    admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    return await db.scalars(select(User))
```

## 路由与异常处理

```python
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/v1/users", tags=["用户管理"])

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user

# 全局异常处理器
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.code, "message": exc.message},
    )
```

## 中间件

```python
import time
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start
        response.headers["X-Process-Time"] = f"{duration:.4f}"
        return response

# CORS 配置
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 后台任务与 WebSocket

```python
from fastapi import BackgroundTasks, WebSocket

# 后台任务
@router.post("/users/", status_code=201)
async def create_user(
    user_in: UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    user = User(**user_in.model_dump())
    db.add(user)
    await db.flush()
    background_tasks.add_task(send_welcome_email, user.email)
    return user

# WebSocket
@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    await manager.connect(websocket, room_id)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(room_id, data)
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
```

## 数据库集成（SQLAlchemy Async）

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

engine = create_async_engine(settings.database_url, echo=settings.debug)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    hashed_password: Mapped[str]
```

## 认证（JWT + OAuth2）

```python
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt, JWTError
from datetime import datetime, timedelta

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=30))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm="HS256")

@router.post("/auth/token")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="认证失败")
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}
```

## 测试

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

async def test_create_user(client: AsyncClient):
    response = await client.post("/api/v1/users/", json={
        "email": "new@example.com",
        "name": "测试用户",
        "password": "StrongPass1",
    })
    assert response.status_code == 201
    assert response.json()["email"] == "new@example.com"

async def test_unauthorized_access(client: AsyncClient):
    response = await client.get("/api/v1/admin/users")
    assert response.status_code == 401
```

## 检查清单

- [ ] 使用 Pydantic 模型分层（Create/Update/Response）
- [ ] 依赖注入管理数据库会话和认证
- [ ] 路由按功能模块拆分到独立 Router
- [ ] 全局异常处理器统一错误响应格式
- [ ] 配置通过 `pydantic-settings` 从环境变量加载
- [ ] 异步数据库操作使用 SQLAlchemy 2.0 风格
- [ ] JWT token 设置合理过期时间
- [ ] 测试使用 `httpx.AsyncClient` + `ASGITransport`
- [ ] OpenAPI 文档包含示例值和描述
- [ ] 生产环境配置 CORS、限流和 HTTPS
