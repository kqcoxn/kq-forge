---
name: cost-aware-llm-pipeline
type: capability
package: ai-ml
description: LLM 成本优化管道，涵盖 Token 预算管理、模型路由（先廉价后升级）、缓存策略（语义缓存）、Prompt 优化、批处理、限流处理与成本监控告警。
---

# 成本感知 LLM 管道

## 核心原则

1. **成本可见** — 每次调用的 Token 消耗和费用实时可追踪
2. **分级路由** — 简单任务用小模型，复杂任务才升级到大模型
3. **缓存优先** — 相似请求复用结果，避免重复计算
4. **Prompt 精简** — 用最少的 Token 传达最多的信息
5. **预算控制** — 设置硬性预算上限，超限自动降级或拒绝

## Token 预算管理

```python
from dataclasses import dataclass
from enum import Enum

class ModelTier(Enum):
    CHEAP = "gpt-4o-mini"       # $0.15/1M input, $0.60/1M output
    STANDARD = "gpt-4o"         # $2.50/1M input, $10/1M output
    PREMIUM = "claude-opus"     # $15/1M input, $75/1M output

@dataclass
class TokenBudget:
    max_input_tokens: int = 4000
    max_output_tokens: int = 1000
    max_daily_cost_usd: float = 50.0
    max_per_request_cost_usd: float = 0.50

class BudgetManager:
    def __init__(self, budget: TokenBudget):
        self.budget = budget
        self.daily_spend = 0.0

    def estimate_cost(self, model: ModelTier, input_tokens: int, max_output: int) -> float:
        """预估单次调用成本"""
        rates = {
            ModelTier.CHEAP: (0.00015, 0.0006),
            ModelTier.STANDARD: (0.0025, 0.01),
            ModelTier.PREMIUM: (0.015, 0.075),
        }
        input_rate, output_rate = rates[model]
        return (input_tokens * input_rate + max_output * output_rate) / 1000

    def can_afford(self, estimated_cost: float) -> bool:
        """检查是否超出预算"""
        if estimated_cost > self.budget.max_per_request_cost_usd:
            return False
        if self.daily_spend + estimated_cost > self.budget.max_daily_cost_usd:
            return False
        return True

    def record_spend(self, actual_cost: float):
        self.daily_spend += actual_cost
```

## 模型路由（先廉价后升级）

```python
class ModelRouter:
    """根据任务复杂度选择合适的模型"""

    def __init__(self, budget_manager: BudgetManager):
        self.budget = budget_manager

    async def route(self, request: LLMRequest) -> LLMResponse:
        # 策略1：先用小模型尝试
        response = await self._try_model(ModelTier.CHEAP, request)

        # 策略2：质量不达标时升级
        if not self._quality_check(response, request):
            response = await self._try_model(ModelTier.STANDARD, request)

        # 策略3：仍不满足时使用最强模型
        if not self._quality_check(response, request):
            if self.budget.can_afford(self.budget.estimate_cost(
                ModelTier.PREMIUM, request.input_tokens, request.max_output
            )):
                response = await self._try_model(ModelTier.PREMIUM, request)

        return response

    def _quality_check(self, response: LLMResponse, request: LLMRequest) -> bool:
        """质量检查：根据任务类型判断输出是否合格"""
        if request.task_type == "classification":
            return response.confidence > 0.8
        if request.task_type == "generation":
            return len(response.text) > 50 and response.coherence_score > 0.7
        return True

    # 基于规则的快速路由（跳过小模型尝试）
    def select_tier(self, request: LLMRequest) -> ModelTier:
        """根据任务特征直接选择模型层级"""
        if request.input_tokens < 500 and request.task_type in ("classification", "extraction"):
            return ModelTier.CHEAP
        if request.requires_reasoning or request.input_tokens > 10000:
            return ModelTier.STANDARD
        return ModelTier.CHEAP
```

## 缓存策略

```python
import hashlib
import numpy as np
from redis import Redis

class LLMCache:
    def __init__(self, redis: Redis, embedding_model):
        self.redis = redis
        self.embedder = embedding_model
        self.similarity_threshold = 0.95

    # 精确缓存：相同输入直接命中
    def exact_lookup(self, prompt: str, model: str) -> str | None:
        key = self._hash_key(prompt, model)
        return self.redis.get(key)

    def exact_store(self, prompt: str, model: str, response: str, ttl: int = 3600):
        key = self._hash_key(prompt, model)
        self.redis.setex(key, ttl, response)

    # 语义缓存：相似输入也能命中
    async def semantic_lookup(self, prompt: str) -> str | None:
        query_embedding = await self.embedder.embed(prompt)
        # 在向量数据库中搜索相似 prompt
        results = await self.vector_db.search(
            vector=query_embedding,
            top_k=1,
            threshold=self.similarity_threshold,
        )
        if results:
            return results[0].metadata["response"]
        return None

    async def semantic_store(self, prompt: str, response: str):
        embedding = await self.embedder.embed(prompt)
        await self.vector_db.upsert(
            vector=embedding,
            metadata={"prompt": prompt, "response": response},
        )

    def _hash_key(self, prompt: str, model: str) -> str:
        content = f"{model}:{prompt}"
        return f"llm_cache:{hashlib.sha256(content.encode()).hexdigest()}"
```

## Prompt 优化

```python
class PromptOptimizer:
    """减少 Token 消耗的 Prompt 优化策略"""

    def compress_system_prompt(self, prompt: str) -> str:
        """压缩系统提示：去除冗余，保留关键指令"""
        # 移除多余空白和重复说明
        lines = [l.strip() for l in prompt.split('\n') if l.strip()]
        return '\n'.join(lines)

    def select_few_shots(self, query: str, examples: list[dict],
                         max_examples: int = 3) -> list[dict]:
        """动态选择最相关的 few-shot 示例"""
        # 基于相似度选择，而非固定示例
        query_emb = self.embedder.embed(query)
        scored = [(ex, cosine_sim(query_emb, self.embedder.embed(ex["input"])))
                  for ex in examples]
        scored.sort(key=lambda x: x[1], reverse=True)
        return [ex for ex, _ in scored[:max_examples]]

    def truncate_context(self, context: str, max_tokens: int) -> str:
        """智能截断上下文：保留首尾，压缩中间"""
        tokens = self.tokenizer.encode(context)
        if len(tokens) <= max_tokens:
            return context
        # 保留前 30% 和后 30%，中间用摘要替代
        head_size = int(max_tokens * 0.3)
        tail_size = int(max_tokens * 0.3)
        head = self.tokenizer.decode(tokens[:head_size])
        tail = self.tokenizer.decode(tokens[-tail_size:])
        return f"{head}\n...[中间内容已省略]...\n{tail}"
```

## 批处理

```python
import asyncio
from collections import deque

class BatchProcessor:
    """将多个请求合并为批次调用，降低开销"""

    def __init__(self, max_batch_size: int = 20, max_wait_ms: int = 100):
        self.max_batch_size = max_batch_size
        self.max_wait_ms = max_wait_ms
        self.queue: deque = deque()
        self._processing = False

    async def submit(self, request: LLMRequest) -> LLMResponse:
        """提交请求，等待批次处理完成"""
        future = asyncio.get_event_loop().create_future()
        self.queue.append((request, future))

        if not self._processing:
            asyncio.create_task(self._process_batch())

        return await future

    async def _process_batch(self):
        self._processing = True
        await asyncio.sleep(self.max_wait_ms / 1000)  # 等待更多请求

        batch = []
        while self.queue and len(batch) < self.max_batch_size:
            batch.append(self.queue.popleft())

        # 批量调用 API
        requests = [req for req, _ in batch]
        responses = await self.llm_client.batch_complete(requests)

        for (_, future), response in zip(batch, responses):
            future.set_result(response)

        self._processing = False
        if self.queue:
            asyncio.create_task(self._process_batch())
```

## 限流处理

```python
import asyncio
from datetime import datetime, timedelta

class RateLimiter:
    """令牌桶限流器，适配 API 速率限制"""

    def __init__(self, requests_per_minute: int = 60, tokens_per_minute: int = 90000):
        self.rpm_limit = requests_per_minute
        self.tpm_limit = tokens_per_minute
        self.request_timestamps: list[datetime] = []
        self.token_usage: list[tuple[datetime, int]] = []

    async def acquire(self, estimated_tokens: int):
        """等待直到有可用配额"""
        while True:
            now = datetime.now()
            cutoff = now - timedelta(minutes=1)

            # 清理过期记录
            self.request_timestamps = [t for t in self.request_timestamps if t > cutoff]
            self.token_usage = [(t, n) for t, n in self.token_usage if t > cutoff]

            current_rpm = len(self.request_timestamps)
            current_tpm = sum(n for _, n in self.token_usage)

            if current_rpm < self.rpm_limit and current_tpm + estimated_tokens < self.tpm_limit:
                self.request_timestamps.append(now)
                self.token_usage.append((now, estimated_tokens))
                return

            # 等待后重试
            await asyncio.sleep(1)
```

## 成本监控与告警

```python
class CostMonitor:
    def __init__(self, daily_budget: float, alert_threshold: float = 0.8):
        self.daily_budget = daily_budget
        self.alert_threshold = alert_threshold

    def record_usage(self, model: str, input_tokens: int, output_tokens: int):
        cost = self._calculate_cost(model, input_tokens, output_tokens)
        self.metrics.record(model=model, cost=cost, tokens=input_tokens + output_tokens)

        # 检查预算
        daily_total = self.metrics.get_daily_total()
        if daily_total > self.daily_budget * self.alert_threshold:
            self._send_alert(f"LLM 日支出已达 ${daily_total:.2f}，"
                           f"预算 ${self.daily_budget:.2f} 的 "
                           f"{daily_total/self.daily_budget*100:.0f}%")

    def get_dashboard_data(self) -> dict:
        return {
            "daily_cost": self.metrics.get_daily_total(),
            "cost_by_model": self.metrics.get_cost_by_model(),
            "cost_by_feature": self.metrics.get_cost_by_feature(),
            "token_efficiency": self.metrics.get_cache_hit_rate(),
        }
```

## 检查清单

- [ ] 每次 LLM 调用记录 Token 消耗和费用
- [ ] 模型路由策略：简单任务用小模型，复杂任务升级
- [ ] 精确缓存 + 语义缓存减少重复调用
- [ ] Prompt 经过优化：去冗余、动态 few-shot、智能截断
- [ ] 批处理合并小请求，减少 API 调用次数
- [ ] 限流器适配 API 速率限制，避免 429 错误
- [ ] 日预算上限设置，超限自动降级或拒绝
- [ ] 成本仪表盘可见：按模型、按功能、按时间维度
- [ ] 告警规则：日支出超 80% 预算时通知
- [ ] 定期审查：哪些功能 ROI 低，是否值得 LLM 调用
