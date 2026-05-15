---
name: nestjs-patterns
type: capability
package: typescript
description: NestJS 框架开发模式，涵盖模块组织、装饰器、守卫、拦截器、管道、异常过滤器、ORM 集成与测试。
---

# NestJS 框架开发模式

## 核心原则

1. **模块化** — 每个功能域一个模块，依赖关系显式声明
2. **装饰器驱动** — 利用装饰器实现横切关注点
3. **依赖注入** — 所有服务通过 DI 容器管理
4. **管道验证** — 请求数据在到达处理器前完成验证

## 模块组织

```typescript
// 功能模块 — 封装相关的控制器、服务、仓储
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), CacheModule],
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserService], // 只导出需要共享的服务
})
export class UserModule {}

// 根模块
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    UserModule,
    AuthModule,
    OrderModule,
  ],
})
export class AppModule {}
```

## 控制器

```typescript
@Controller('users')
@UseGuards(JwtAuthGuard)
@UseInterceptors(LoggingInterceptor)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @HttpCode(200)
  async findAll(@Query() query: PaginationDto): Promise<PaginatedResponse<UserDto>> {
    return this.userService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserDto> {
    return this.userService.findById(id);
  }

  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.userService.create(dto, user);
  }

  @Patch(':id')
  @Roles('admin')
  @UseGuards(RolesGuard)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserDto> {
    return this.userService.update(id, dto);
  }
}
```

## 自定义装饰器

```typescript
import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

// 参数装饰器 — 提取当前用户
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;
    return data ? user[data] : user;
  },
);

// 元数据装饰器 — 标记角色
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

// 组合装饰器 — 合并多个装饰器
export function Auth(...roles: string[]) {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(...roles),
    ApiBearerAuth(),
  );
}

// 使用组合装饰器
@Auth('admin')
@Delete(':id')
async remove(@Param('id') id: string): Promise<void> {
  return this.userService.remove(id);
}
```

## 守卫

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
```

## 拦截器

```typescript
// 响应转换拦截器
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}

// 性能日志拦截器
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Performance');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const { method, url } = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        if (duration > 1000) {
          this.logger.warn(`慢请求: ${method} ${url} - ${duration}ms`);
        }
      }),
    );
  }
}
```

## 管道验证

```typescript
import { z } from 'zod';

// 基于 Zod 的验证管道
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: '验证失败',
        errors: result.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    return result.data;
  }
}

// DTO 定义
const createUserSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8),
});

type CreateUserDto = z.infer<typeof createUserSchema>;

// 在控制器中使用
@Post()
async create(@Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserDto) {
  return this.userService.create(dto);
}
```

## 异常过滤器

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = 500;
    let message = '服务器内部错误';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message;
      code = (res as any).code ?? 'HTTP_ERROR';
    }

    if (status >= 500) {
      this.logger.error('未处理异常', exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).json({
      success: false,
      error: { code, message },
      timestamp: new Date().toISOString(),
    });
  }
}
```

## ORM 集成（Prisma）

```typescript
// Prisma 服务
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

// 仓储实现
@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findWithPagination(params: { skip: number; take: number; where?: Prisma.UserWhereInput }) {
    const [items, total] = await Promise.all([
      this.prisma.user.findMany(params),
      this.prisma.user.count({ where: params.where }),
    ]);
    return { items, total };
  }
}
```

## 测试

```typescript
// 单元测试 — 使用 mock
describe('UserService', () => {
  let service: UserService;
  let repository: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: UserRepository,
          useValue: {
            findById: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UserService);
    repository = module.get(UserRepository);
  });

  it('应返回用户', async () => {
    const mockUser = { id: '1', name: 'Alice', email: 'a@b.com' };
    repository.findById.mockResolvedValue(mockUser);

    const result = await service.findById('1');
    expect(result).toEqual(mockUser);
  });

  it('用户不存在时应抛出 NotFoundException', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.findById('999')).rejects.toThrow(NotFoundException);
  });
});

// E2E 测试
describe('UserController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('POST /users 应创建用户', () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ name: 'Bob', email: 'bob@test.com', password: '12345678' })
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.name).toBe('Bob');
      });
  });
});
```

## CQRS 模式

```typescript
// 命令
export class CreateOrderCommand {
  constructor(
    public readonly userId: string,
    public readonly items: OrderItem[],
  ) {}
}

// 命令处理器
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler implements ICommandHandler<CreateOrderCommand> {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateOrderCommand): Promise<Order> {
    const order = await this.orderRepo.create(command);
    this.eventBus.publish(new OrderCreatedEvent(order.id, command.userId));
    return order;
  }
}

// 事件处理器
@EventsHandler(OrderCreatedEvent)
export class OrderCreatedHandler implements IEventHandler<OrderCreatedEvent> {
  constructor(private readonly notificationService: NotificationService) {}

  handle(event: OrderCreatedEvent): void {
    this.notificationService.sendOrderConfirmation(event.userId, event.orderId);
  }
}
```

## 检查清单

- [ ] 每个功能域一个独立模块，依赖显式导入
- [ ] 控制器只做路由分发，业务逻辑在服务层
- [ ] 所有请求数据通过管道验证
- [ ] 自定义装饰器封装重复的横切逻辑
- [ ] 全局异常过滤器统一错误响应格式
- [ ] 服务通过接口注入，便于 mock 测试
- [ ] 单元测试覆盖核心业务逻辑
- [ ] E2E 测试覆盖关键 API 路径
- [ ] 使用拦截器处理日志、缓存、响应转换
- [ ] 数据库操作封装在仓储层
