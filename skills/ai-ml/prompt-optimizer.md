---
name: prompt-optimizer
type: capability
package: ai-ml
description: Prompt 工程最佳实践，涵盖清晰性与具体性原则、结构化输出（JSON mode、Function Calling）、思维链、Few-shot 选择策略、Prompt 测试评估、版本控制与 A/B 测试。
---

# Prompt 优化指南

## 核心原则

1. **清晰具体** — 明确告诉模型要做什么、不做什么、输出格式
2. **结构化输出** — 约束输出格式，便于程序解析
3. **迭代优化** — Prompt 是代码，需要测试、版本管理和持续改进
4. **任务分解** — 复杂任务拆分为多步，每步一个清晰的 Prompt
5. **评估驱动** — 用量化指标衡量 Prompt 效果，而非主观感觉

## Prompt 工程原则

```python
# 原则1：具体而非模糊
# 反模式
bad_prompt = "帮我总结这篇文章"

# 正确：明确长度、格式、重点
good_prompt = """
请用中文总结以下文章，要求：
- 总结长度：3-5 句话
- 包含：核心论点、关键数据、结论
- 格式：先用一句话概括主旨，再展开要点
- 不要包含：作者背景、引用来源

文章内容：
{article}
"""

# 原则2：提供正反例
prompt_with_examples = """
判断用户评论的情感倾向。

正面示例：
- "这个产品太好用了，强烈推荐！" → positive
- "物流很快，包装完好" → positive

负面示例：
- "质量太差了，用了一天就坏了" → negative
- "客服态度恶劣，再也不买了" → negative

中性示例：
- "还行吧，一般般" → neutral
- "收到了，还没用" → neutral

请判断以下评论：
"{comment}"

输出格式：仅输出 positive/negative/neutral
"""

# 原则3：角色设定 + 约束条件
system_prompt = """
你是一位资深的代码审查专家，专注于 Python 后端开发。

审查规则：
1. 只关注代码质量问题，不讨论业务逻辑
2. 按严重程度分级：critical / warning / suggestion
3. 每个问题给出具体的修复建议和代码示例
4. 如果代码没有问题，直接回复"LGTM"

不要：
- 重写整个函数
- 讨论代码风格偏好（已有 linter 处理）
- 提出架构级别的重构建议
"""
```

## 结构化输出

```python
# JSON Mode：强制输出 JSON
from openai import OpenAI

client = OpenAI()

response = client.chat.completions.create(
    model="gpt-4o",
    response_format={"type": "json_object"},
    messages=[
        {"role": "system", "content": "你是一个数据提取助手，始终输出 JSON 格式。"},
        {"role": "user", "content": f"""
从以下文本中提取结构化信息：

文本：{text}

输出 JSON 格式：
{{
  "entities": [
    {{"name": "实体名", "type": "person|org|location", "context": "出现的上下文"}}
  ],
  "relations": [
    {{"subject": "主体", "predicate": "关系", "object": "客体"}}
  ],
  "summary": "一句话摘要"
}}
"""}
    ],
)

# Function Calling：类型安全的结构化输出
tools = [{
    "type": "function",
    "function": {
        "name": "extract_order_info",
        "description": "从用户消息中提取订单相关信息",
        "parameters": {
            "type": "object",
            "properties": {
                "intent": {
                    "type": "string",
                    "enum": ["query_status", "cancel", "modify", "complaint"],
                    "description": "用户意图"
                },
                "order_id": {
                    "type": "string",
                    "description": "订单号（如果提到）"
                },
                "urgency": {
                    "type": "string",
                    "enum": ["low", "medium", "high"],
                    "description": "紧急程度"
                },
            },
            "required": ["intent", "urgency"],
        },
    },
}]
```

## 思维链（Chain-of-Thought）

```python
# 零样本 CoT
zero_shot_cot = """
请一步一步思考，然后给出最终答案。

问题：{question}

思考过程：
"""

# 结构化 CoT
structured_cot = """
请按以下步骤分析问题：

1. 理解问题：用自己的话重述问题核心
2. 识别关键信息：列出解题所需的关键数据
3. 制定策略：选择解题方法并说明原因
4. 逐步执行：展示每一步的计算/推理过程
5. 验证答案：检查答案是否合理

问题：{question}
"""

# 自我一致性（Self-Consistency）：多次采样取多数
async def self_consistency(prompt: str, n_samples: int = 5) -> str:
    """多次生成，取最一致的答案"""
    responses = await asyncio.gather(*[
        llm.generate(prompt, temperature=0.7)
        for _ in range(n_samples)
    ])
    # 提取最终答案并投票
    answers = [extract_final_answer(r) for r in responses]
    return Counter(answers).most_common(1)[0][0]
```

## Few-shot 选择策略

```python
class FewShotSelector:
    """动态选择最相关的 few-shot 示例"""

    def __init__(self, examples: list[dict], embedder):
        self.examples = examples
        self.embedder = embedder
        # 预计算所有示例的 embedding
        self.embeddings = [embedder.embed(ex["input"]) for ex in examples]

    def select_by_similarity(self, query: str, k: int = 3) -> list[dict]:
        """基于语义相似度选择"""
        query_emb = self.embedder.embed(query)
        scores = [cosine_similarity(query_emb, emb) for emb in self.embeddings]
        top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:k]
        return [self.examples[i] for i in top_indices]

    def select_diverse(self, query: str, k: int = 3) -> list[dict]:
        """相似度 + 多样性平衡（MMR 算法）"""
        query_emb = self.embedder.embed(query)
        selected = []
        candidates = list(range(len(self.examples)))

        for _ in range(k):
            best_idx = None
            best_score = -float("inf")
            for idx in candidates:
                relevance = cosine_similarity(query_emb, self.embeddings[idx])
                # 与已选示例的最大相似度（惩罚冗余）
                redundancy = max(
                    (cosine_similarity(self.embeddings[idx], self.embeddings[s])
                     for s in selected),
                    default=0,
                )
                score = 0.7 * relevance - 0.3 * redundancy
                if score > best_score:
                    best_score = score
                    best_idx = idx
            selected.append(best_idx)
            candidates.remove(best_idx)

        return [self.examples[i] for i in selected]
```

## Prompt 测试与评估

```python
import json
from dataclasses import dataclass

@dataclass
class PromptTestCase:
    input: str
    expected_output: str | None = None
    expected_contains: list[str] | None = None
    expected_format: str | None = None  # "json", "markdown", etc.
    max_tokens: int | None = None

class PromptEvaluator:
    def __init__(self, test_cases: list[PromptTestCase]):
        self.test_cases = test_cases

    async def evaluate(self, prompt_template: str) -> dict:
        results = []
        for case in self.test_cases:
            prompt = prompt_template.format(input=case.input)
            response = await self.llm.generate(prompt)

            score = self._score_response(response, case)
            results.append({"input": case.input, "output": response, "score": score})

        return {
            "total": len(results),
            "pass_rate": sum(1 for r in results if r["score"] >= 0.8) / len(results),
            "avg_score": sum(r["score"] for r in results) / len(results),
            "failures": [r for r in results if r["score"] < 0.8],
        }

    def _score_response(self, response: str, case: PromptTestCase) -> float:
        score = 1.0
        if case.expected_contains:
            for keyword in case.expected_contains:
                if keyword not in response:
                    score -= 0.2
        if case.expected_format == "json":
            try:
                json.loads(response)
            except json.JSONDecodeError:
                score -= 0.5
        return max(0, score)
```

## 版本控制与 A/B 测试

```python
# Prompt 版本管理
class PromptRegistry:
    """Prompt 注册中心：版本化管理所有 Prompt"""

    def __init__(self, storage_path: str):
        self.storage = storage_path

    def register(self, name: str, version: str, template: str, metadata: dict):
        """注册新版本 Prompt"""
        entry = {
            "name": name,
            "version": version,
            "template": template,
            "metadata": metadata,  # 作者、变更说明、评估结果
            "created_at": datetime.now().isoformat(),
        }
        self._save(name, version, entry)

    def get_active(self, name: str) -> str:
        """获取当前活跃版本"""
        config = self._load_config(name)
        return config["active_version"]

    def ab_test(self, name: str, user_id: str) -> str:
        """A/B 测试：根据用户分组返回不同版本"""
        config = self._load_config(name)
        variants = config.get("ab_test", {})
        if not variants:
            return self.get_active(name)

        # 确定性分组
        bucket = hash(f"{name}:{user_id}") % 100
        cumulative = 0
        for version, traffic_pct in variants.items():
            cumulative += traffic_pct
            if bucket < cumulative:
                return version
        return self.get_active(name)

# 目录结构
# prompts/
# ├── sentiment_analysis/
# │   ├── v1.0.yaml
# │   ├── v1.1.yaml
# │   ├── v2.0.yaml
# │   └── config.yaml  (active_version, ab_test settings)
# └── code_review/
#     ├── v1.0.yaml
#     └── config.yaml
```

## 检查清单

- [ ] Prompt 包含明确的任务描述、输出格式和约束条件
- [ ] 使用 JSON Mode 或 Function Calling 获取结构化输出
- [ ] 复杂推理任务使用思维链（CoT）引导
- [ ] Few-shot 示例基于相似度动态选择，非固定
- [ ] 每个 Prompt 有对应的测试用例集（≥ 20 条）
- [ ] Prompt 变更有版本记录和变更说明
- [ ] 重要 Prompt 上线前通过 A/B 测试验证效果
- [ ] 评估指标量化：准确率、格式合规率、延迟
- [ ] 定期审查 Prompt 效果，淘汰低效版本
- [ ] Prompt 模板与代码分离，支持热更新
