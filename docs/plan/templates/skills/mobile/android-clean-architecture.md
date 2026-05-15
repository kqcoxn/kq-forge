---
name: android-clean-architecture
type: capability
package: mobile
description: Android Clean Architecture 实践，涵盖分层架构（domain/data/presentation）、Hilt DI、Repository 模式、Use Cases、ViewModel + StateFlow、Room、Retrofit 与各层测试。
---

# Android Clean Architecture

## 核心原则

1. **依赖规则** — 外层依赖内层，domain 层不依赖任何框架
2. **关注点分离** — 每层职责明确，变更影响范围可控
3. **可测试性** — 业务逻辑纯 Kotlin，无 Android 依赖即可测试
4. **单向数据流** — UI 状态从 ViewModel 单向流出，事件单向流入
5. **接口隔离** — 层间通过接口通信，实现可替换

## 分层结构

```
app/
├── domain/                    # 核心业务（纯 Kotlin）
│   ├── model/
│   │   └── User.kt
│   ├── repository/
│   │   └── UserRepository.kt  # 接口定义
│   └── usecase/
│       ├── GetUserUseCase.kt
│       └── UpdateProfileUseCase.kt
├── data/                      # 数据层（实现 domain 接口）
│   ├── remote/
│   │   ├── api/
│   │   │   └── UserApi.kt     # Retrofit 接口
│   │   └── dto/
│   │       └── UserDto.kt
│   ├── local/
│   │   ├── dao/
│   │   │   └── UserDao.kt     # Room DAO
│   │   └── entity/
│   │       └── UserEntity.kt
│   ├── mapper/
│   │   └── UserMapper.kt
│   └── repository/
│       └── UserRepositoryImpl.kt
├── presentation/              # UI 层
│   ├── ui/
│   │   ├── screen/
│   │   │   └── ProfileScreen.kt
│   │   └── component/
│   │       └── UserAvatar.kt
│   └── viewmodel/
│       └── ProfileViewModel.kt
└── di/                        # 依赖注入模块
    ├── NetworkModule.kt
    ├── DatabaseModule.kt
    └── RepositoryModule.kt
```

## Domain 层

```kotlin
// 领域模型：纯数据，无框架依赖
data class User(
    val id: String,
    val name: String,
    val email: String,
    val avatarUrl: String?,
    val createdAt: Instant
)

// Repository 接口：定义数据契约
interface UserRepository {
    suspend fun getById(id: String): User?
    suspend fun getAll(): List<User>
    suspend fun save(user: User)
    fun observeAll(): Flow<List<User>>
}

// Use Case：封装单一业务操作
class GetUserUseCase(private val repository: UserRepository) {
    suspend operator fun invoke(userId: String): Result<User> {
        return runCatching {
            repository.getById(userId)
                ?: throw NotFoundException("用户 $userId 不存在")
        }
    }
}

class UpdateProfileUseCase(
    private val repository: UserRepository,
    private val validator: ProfileValidator
) {
    suspend operator fun invoke(params: Params): Result<User> {
        return runCatching {
            validator.validate(params.name, params.email)
            val user = repository.getById(params.userId)
                ?: throw NotFoundException("用户不存在")
            val updated = user.copy(name = params.name, email = params.email)
            repository.save(updated)
            updated
        }
    }

    data class Params(val userId: String, val name: String, val email: String)
}
```

## Data 层

```kotlin
// Retrofit API 接口
interface UserApi {
    @GET("users/{id}")
    suspend fun getUser(@Path("id") id: String): UserDto

    @GET("users")
    suspend fun getAllUsers(): List<UserDto>

    @PUT("users/{id}")
    suspend fun updateUser(@Path("id") id: String, @Body body: UpdateUserRequest): UserDto
}

// DTO：网络数据传输对象
@Serializable
data class UserDto(
    val id: String,
    val name: String,
    val email: String,
    @SerialName("avatar_url") val avatarUrl: String?,
    @SerialName("created_at") val createdAt: String
)

// Room Entity
@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey val id: String,
    val name: String,
    val email: String,
    val avatarUrl: String?,
    val createdAt: Long,
    val lastSyncAt: Long = System.currentTimeMillis()
)

// Room DAO
@Dao
interface UserDao {
    @Query("SELECT * FROM users WHERE id = :id")
    suspend fun getById(id: String): UserEntity?

    @Query("SELECT * FROM users ORDER BY name ASC")
    fun observeAll(): Flow<List<UserEntity>>

    @Upsert
    suspend fun upsert(user: UserEntity)
}

// Repository 实现：协调远程和本地数据源
class UserRepositoryImpl(
    private val api: UserApi,
    private val dao: UserDao,
    private val mapper: UserMapper
) : UserRepository {

    override suspend fun getById(id: String): User? {
        // 策略：先读缓存，后台刷新
        val cached = dao.getById(id)?.let { mapper.entityToDomain(it) }
        try {
            val remote = api.getUser(id)
            dao.upsert(mapper.dtoToEntity(remote))
            return mapper.dtoToDomain(remote)
        } catch (e: Exception) {
            return cached ?: throw e
        }
    }

    override fun observeAll(): Flow<List<User>> {
        return dao.observeAll().map { entities ->
            entities.map { mapper.entityToDomain(it) }
        }
    }

    override suspend fun save(user: User) {
        val dto = api.updateUser(user.id, mapper.domainToRequest(user))
        dao.upsert(mapper.dtoToEntity(dto))
    }

    override suspend fun getAll(): List<User> {
        val remote = api.getAllUsers()
        remote.forEach { dao.upsert(mapper.dtoToEntity(it)) }
        return remote.map { mapper.dtoToDomain(it) }
    }
}
```

## Presentation 层

```kotlin
// UI 状态：密封类表达所有可能状态
sealed interface ProfileUiState {
    data object Loading : ProfileUiState
    data class Success(val user: User, val isEditing: Boolean = false) : ProfileUiState
    data class Error(val message: String) : ProfileUiState
}

// ViewModel：连接 UI 和 Use Case
@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val getUserUseCase: GetUserUseCase,
    private val updateProfileUseCase: UpdateProfileUseCase,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val userId: String = savedStateHandle["userId"]!!

    private val _uiState = MutableStateFlow<ProfileUiState>(ProfileUiState.Loading)
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    init { loadProfile() }

    fun loadProfile() {
        viewModelScope.launch {
            _uiState.value = ProfileUiState.Loading
            getUserUseCase(userId)
                .onSuccess { _uiState.value = ProfileUiState.Success(it) }
                .onFailure { _uiState.value = ProfileUiState.Error(it.message ?: "未知错误") }
        }
    }

    fun updateProfile(name: String, email: String) {
        viewModelScope.launch {
            val params = UpdateProfileUseCase.Params(userId, name, email)
            updateProfileUseCase(params)
                .onSuccess { _uiState.value = ProfileUiState.Success(it) }
                .onFailure { _uiState.value = ProfileUiState.Error(it.message ?: "更新失败") }
        }
    }
}

// Compose UI
@Composable
fun ProfileScreen(viewModel: ProfileViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    when (val state = uiState) {
        is ProfileUiState.Loading -> LoadingIndicator()
        is ProfileUiState.Error -> ErrorMessage(state.message, onRetry = viewModel::loadProfile)
        is ProfileUiState.Success -> ProfileContent(user = state.user)
    }
}
```

## Hilt 依赖注入

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(AuthInterceptor())
        .connectTimeout(30, TimeUnit.SECONDS)
        .build()

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient): Retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL)
        .client(client)
        .addConverterFactory(Json.asConverterFactory("application/json".toMediaType()))
        .build()

    @Provides
    fun provideUserApi(retrofit: Retrofit): UserApi = retrofit.create()
}

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds
    @Singleton
    abstract fun bindUserRepository(impl: UserRepositoryImpl): UserRepository
}
```

## 各层测试

```kotlin
// Domain 层测试：纯 Kotlin，无 Android 依赖
class GetUserUseCaseTest {
    private val repository = mockk<UserRepository>()
    private val useCase = GetUserUseCase(repository)

    @Test
    fun `用户存在时返回 Success`() = runTest {
        coEvery { repository.getById("1") } returns testUser
        val result = useCase("1")
        assertTrue(result.isSuccess)
        assertEquals("Alice", result.getOrNull()?.name)
    }

    @Test
    fun `用户不存在时返回 Failure`() = runTest {
        coEvery { repository.getById("999") } returns null
        val result = useCase("999")
        assertTrue(result.isFailure)
    }
}

// ViewModel 测试
class ProfileViewModelTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val getUserUseCase = mockk<GetUserUseCase>()
    private lateinit var viewModel: ProfileViewModel

    @Test
    fun `加载成功更新状态为 Success`() = runTest {
        coEvery { getUserUseCase("1") } returns Result.success(testUser)
        viewModel = createViewModel()

        val state = viewModel.uiState.first { it is ProfileUiState.Success }
        assertEquals("Alice", (state as ProfileUiState.Success).user.name)
    }
}

// Repository 测试：验证缓存策略
class UserRepositoryImplTest {
    private val api = mockk<UserApi>()
    private val dao = mockk<UserDao>(relaxed = true)
    private val repo = UserRepositoryImpl(api, dao, UserMapper())

    @Test
    fun `网络失败时返回缓存数据`() = runTest {
        coEvery { api.getUser("1") } throws IOException("网络错误")
        coEvery { dao.getById("1") } returns cachedEntity

        val result = repo.getById("1")
        assertNotNull(result)
        assertEquals("Alice", result?.name)
    }
}
```

## 检查清单

- [ ] Domain 层零框架依赖，可独立编译和测试
- [ ] Use Case 封装单一业务操作，通过 `operator fun invoke` 调用
- [ ] Repository 接口定义在 domain 层，实现在 data 层
- [ ] DTO/Entity 与 Domain Model 通过 Mapper 转换，不混用
- [ ] ViewModel 使用 `StateFlow` 暴露不可变 UI 状态
- [ ] UI 状态使用密封类/接口覆盖所有可能状态
- [ ] Hilt 模块按职责分离（Network/Database/Repository）
- [ ] 每层都有对应的测试：domain 单元测试、data 集成测试、UI 测试
- [ ] 使用 `collectAsStateWithLifecycle` 感知生命周期
- [ ] 错误处理使用 `Result` 类型，不在 ViewModel 中 try-catch
