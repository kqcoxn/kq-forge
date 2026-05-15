---
name: springboot-security
type: constraint
package: java
description: Spring Security 6 安全配置指南，涵盖认证、授权、JWT、OAuth2、CORS、CSRF 与常见漏洞防护。
---
# Spring Boot Security 安全实践

## 核心原则

1. **纵深防御** — 多层安全控制，不依赖单一机制
2. **最小权限** — 默认拒绝，显式授权
3. **安全默认值** — 框架默认配置即安全，修改需谨慎
4. **不信任输入** — 所有外部输入都需校验和清理

## SecurityFilterChain 配置

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public/**", "/actuator/health").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE).hasAuthority("DELETE_PRIVILEGE")
                .anyRequest().authenticated())
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
            .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
            .headers(headers -> headers
                .contentSecurityPolicy(csp -> csp.policyDirectives(
                    "default-src 'self'; script-src 'self'"))
                .frameOptions(frame -> frame.deny()))
            .build();
    }
}
```

## JWT 认证

```java
// JWT 工具类
@Component
public class JwtTokenProvider {
    private final SecretKey key;
    private final Duration expiration;

    public JwtTokenProvider(SecurityProperties props) {
        this.key = Keys.hmacShaKeyFor(props.jwtSecret().getBytes(StandardCharsets.UTF_8));
        this.expiration = props.jwtExpiration();
    }

    public String generateToken(UserDetails user) {
        var now = Instant.now();
        return Jwts.builder()
            .subject(user.getUsername())
            .claim("roles", user.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority).toList())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(expiration)))
            .signWith(key)
            .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }
}

// JWT 过滤器
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        try {
            String token = header.substring(7);
            Claims claims = tokenProvider.parseToken(token);
            var auth = new UsernamePasswordAuthenticationToken(
                claims.getSubject(), null, extractAuthorities(claims));
            SecurityContextHolder.getContext().setAuthentication(auth);
        } catch (JwtException e) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }

        chain.doFilter(request, response);
    }
}
```

## OAuth2 资源服务器

```java
// application.yml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://auth.example.com
          audiences: my-api

// 自定义 JWT 转换器
@Bean
public JwtAuthenticationConverter jwtAuthenticationConverter() {
    var grantedAuthoritiesConverter = new JwtGrantedAuthoritiesConverter();
    grantedAuthoritiesConverter.setAuthoritiesClaimName("roles");
    grantedAuthoritiesConverter.setAuthorityPrefix("ROLE_");

    var converter = new JwtAuthenticationConverter();
    converter.setJwtGrantedAuthoritiesConverter(grantedAuthoritiesConverter);
    return converter;
}
```

## 方法级安全

```java
@Service
public class OrderService {

    // 基于角色
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteOrder(String orderId) { /* ... */ }

    // 基于表达式
    @PreAuthorize("#userId == authentication.name or hasRole('ADMIN')")
    public List<Order> getUserOrders(String userId) { /* ... */ }

    // 后置校验
    @PostAuthorize("returnObject.ownerId == authentication.name")
    public Order getOrder(String orderId) { /* ... */ }

    // 自定义权限评估器
    @PreAuthorize("@permissionService.canAccess(#resourceId, authentication)")
    public Resource getResource(String resourceId) { /* ... */ }
}
```

## CORS 配置

```java
@Bean
public CorsConfigurationSource corsConfigurationSource() {
    var config = new CorsConfiguration();
    config.setAllowedOrigins(List.of(
        "https://app.example.com",
        "https://admin.example.com"
    ));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Request-ID"));
    config.setExposedHeaders(List.of("X-Total-Count"));
    config.setAllowCredentials(true);
    config.setMaxAge(3600L);

    var source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", config);
    return source;
}
```

## CSRF 防护

```java
// SPA 应用：使用 Cookie 模式
.csrf(csrf -> csrf
    .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
    .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())
    // 排除无状态 API 端点
    .ignoringRequestMatchers("/api/webhooks/**"))

// 纯 API（无状态 + JWT）：可禁用 CSRF
// 仅当确认不使用 Cookie 认证时
.csrf(AbstractHttpConfigurer::disable)
```

## 密码编码

```java
@Bean
public PasswordEncoder passwordEncoder() {
    // 使用自适应哈希，自动升级旧算法
    return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    // 默认使用 bcrypt，支持 {bcrypt}, {scrypt}, {argon2} 前缀
}

// 注册时
String encoded = passwordEncoder.encode(rawPassword);

// 验证时（框架自动调用）
boolean matches = passwordEncoder.matches(rawPassword, encoded);
```

## 限流

```java
@Component
public class RateLimitFilter extends OncePerRequestFilter {
    // 使用 Bucket4j 或 Resilience4j
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String clientIp = getClientIp(request);
        Bucket bucket = buckets.computeIfAbsent(clientIp, this::createBucket);

        if (bucket.tryConsume(1)) {
            chain.doFilter(request, response);
        } else {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", "60");
            response.getWriter().write("{\"error\":\"请求过于频繁\"}");
        }
    }

    private Bucket createBucket(String key) {
        return Bucket.builder()
            .addLimit(Bandwidth.classic(100, Refill.intervally(100, Duration.ofMinutes(1))))
            .build();
    }
}
```

## 安全响应头

```java
.headers(headers -> headers
    // 防止点击劫持
    .frameOptions(frame -> frame.deny())
    // XSS 保护
    .xssProtection(xss -> xss.headerValue(XXssProtectionHeaderWriter.HeaderValue.ENABLED_MODE_BLOCK))
    // 内容类型嗅探防护
    .contentTypeOptions(Customizer.withDefaults())
    // HSTS（仅 HTTPS）
    .httpStrictTransportSecurity(hsts -> hsts
        .maxAgeInSeconds(31536000)
        .includeSubDomains(true))
    // CSP
    .contentSecurityPolicy(csp -> csp
        .policyDirectives("default-src 'self'; img-src 'self' data:; script-src 'self'"))
)
```

## 常见漏洞防护

```java
// SQL 注入：始终使用参数化查询
// ❌ "SELECT * FROM users WHERE id = '" + id + "'"
// ✅ JPA 自动参数化
@Query("SELECT u FROM User u WHERE u.email = :email")
Optional<User> findByEmail(@Param("email") String email);

// XSS：输出编码（模板引擎自动处理）
// API 返回 JSON 时 Content-Type: application/json 即可防护

// 路径遍历：校验文件路径
public Path resolveFile(String filename) {
    Path resolved = uploadDir.resolve(filename).normalize();
    if (!resolved.startsWith(uploadDir)) {
        throw new SecurityException("非法文件路径");
    }
    return resolved;
}

// 敏感数据：日志脱敏
log.info("用户登录: {}", maskEmail(email));
// 响应中排除敏感字段
@JsonIgnore
private String passwordHash;
```

## 检查清单

- [ ] SecurityFilterChain 配置默认拒绝，显式放行公开端点
- [ ] JWT 密钥从环境变量加载，长度 >= 256 位
- [ ] 密码使用 bcrypt/argon2 编码，不使用 MD5/SHA
- [ ] 方法级安全注解保护敏感操作
- [ ] CORS 白名单明确列出允许的域名，不使用 `*`
- [ ] 限流保护认证端点和公开 API
- [ ] 安全响应头全部启用（HSTS、CSP、X-Frame-Options）
- [ ] 所有数据库查询使用参数化，无字符串拼接
- [ ] 文件上传校验类型、大小，存储路径不可遍历
- [ ] 敏感数据不出现在日志和错误响应中
- [ ] 定期更新依赖，使用 OWASP Dependency-Check 扫描
