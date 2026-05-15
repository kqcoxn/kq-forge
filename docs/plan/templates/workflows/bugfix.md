---
name: bugfix
description: 缺陷修复流程——诊断、修复、验证、反思（轻量，无 judge）
triggers:
  - "/workflow bugfix"
  - "/fix"
steps:
  - agent: lead
    action: diagnose
    task_tag: debugging
  - agent: implementer
    action: fix
  - agent: reviewer
    action: verify
    round_cap: 2
    on_fail: retry
  - agent: lead
    action: reflect
on_complete: reflect
---

## 概述

Bugfix 工作流是针对缺陷修复场景的轻量级流程。与 feature 工作流相比，它省略了 judge 裁决环节（因为 bug 修复的验收标准通常很明确——"bug 不再复现"），用更快的节奏完成修复闭环。

## 流程图

```
┌─────────┐     ┌──────────────┐     ┌──────────┐     ┌─────────┐
│  lead   │────▶│ implementer  │────▶│ reviewer │────▶│  lead   │
│ diagnose│     │     fix      │     │  verify  │     │ reflect │
└─────────┘     └──────────────┘     └──────────┘     └─────────┘
                        ▲                   │
                        │      FAIL         │
                        └───────────────────┘
                        (最多 2 轮)
```

## 各步骤详解

### 步骤 1：lead — diagnose（诊断）

**输入：** 用户的 bug 报告（现象描述、复现步骤、期望行为）

**动作：**
1. 理解 bug 的现象和影响范围
2. 调用 debug skill 的前两步（复现 + 定位）
3. 形成修复方向的初步判断
4. 定义验收标准（通常是"bug 不再复现 + 无回归"）

**输出：**
- 问题定位（具体到文件/函数/行号）
- 根因假设
- 验收标准
- 修复建议方向

**task_tag: debugging** — 此步骤会匹配 overrides 中 `task: debugging` 的规则。

**失败处理：**
- 无法复现 → 返回 NEEDS_CONTEXT，请求更多复现信息
- 无法定位 → 返回 BLOCKED，建议人类协助排查

### 步骤 2：implementer — fix（修复）

**输入：** lead 的诊断结果 + 根因假设 + 修复方向 + AC

**动作：**
1. 基于诊断结果实现修复
2. 调用 debug skill 的后续步骤（修复 + 回归验证）
3. 确认 bug 不再复现
4. 确认没有引入回归

**输出：** 修复代码 + 验证结果

**失败处理：**
- 修复后 bug 仍存在 → 返回 DONE_WITH_CONCERNS，说明情况
- 修复引入回归 → 回退修改，返回 BLOCKED

### 步骤 3：reviewer — verify（验证）

**输入：** implementer 的修复代码 + AC

**动作：**
1. 验证修复是否真正解决了根因（而非只修了症状）
2. 检查是否有回归风险
3. 检查修复范围是否最小化

**审查重点（与 feature 的 review 不同）：**
- 修复是否针对根因？
- 修复范围是否最小化？（没有顺手改其他东西）
- 是否有类似的 bug 在其他地方潜伏？（举一反三）
- 是否需要添加防御性代码防止复发？

**输出：** PASS / FAIL

**对抗循环：**
- FAIL → implementer 重新修复 → reviewer 重新验证
- 最多 2 轮（bugfix 追求快速闭环）
- 2 轮后仍 FAIL → retry 策略会再给一次机会，之后升级给人类

### 步骤 4：lead — reflect（反思）

**输入：** 整个修复过程的记录

**动作：**
1. 调用 reflect skill
2. 重点分析：这个 bug 为什么会出现？如何防止类似 bug？
3. 沉淀教训到 memory/lessons.md

**输出：** 反思记录 + memory 更新

**bugfix 反思的特殊关注点：**
- 这个 bug 是否暴露了测试覆盖的盲区？
- 是否需要添加新的规则到 memory/rules.md？
- 是否有类似的潜在 bug 需要排查？

## 适用场景

- 明确的功能缺陷（行为与预期不符）
- 生产环境报错
- 测试失败的修复
- 回归问题的修复

## 不适用场景

- 需要设计决策的功能变更 → 使用 feature 工作流
- 性能优化（非功能性 bug）→ 使用 feature 工作流
- 大规模重构中发现的系统性问题 → 使用 longmarch 工作流

## 与 feature 工作流的区别

| 维度 | feature | bugfix |
|------|---------|--------|
| 第一步 | 分解（设计导向） | 诊断（调试导向） |
| 质量模型 | 三角对抗（Writer/Reviewer/Judge） | 线性验证（Writer/Reviewer） |
| 审查重点 | 全维度审查 | 聚焦根因和回归 |
| round_cap | 3（默认） | 2（追求快速闭环） |
| 门控 | 分解后需确认 | 无门控（紧急修复不等人） |
| 反思重点 | 通用经验沉淀 | 防复发策略 |
