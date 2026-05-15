---
name: feature
description: 标准功能开发流程——分解、实现、对抗审查、裁决、反思
triggers:
  - "/workflow feature"
  - "/feat"
steps:
  - agent: lead
    action: decompose
    gate:
      enabled: true
      min_autonomy: L2
      message: "任务已分解，请确认子任务列表和验收标准"
  - agent: implementer
    action: implement
  - agent: reviewer
    action: review
  - agent: judge
    action: judge
    round_cap: 3
    on_fail: escalate
  - agent: lead
    action: reflect
on_complete: reflect
---

## 概述

Feature 工作流是 KQ-Forge 的默认工作流，适用于标准的功能开发场景。它实现了完整的 Writer/Reviewer/Judge 三角对抗模型，确保每次交付都经过结构化的质量把控。

## 流程图

```
┌─────────┐     ┌──────────────┐     ┌──────────┐     ┌───────┐     ┌─────────┐
│  lead   │────▶│ implementer  │────▶│ reviewer │────▶│ judge │────▶│  lead   │
│decompose│     │  implement   │     │  review  │     │ judge │     │ reflect │
└─────────┘     └──────────────┘     └──────────┘     └───────┘     └─────────┘
     │                  ▲                                  │
     │ [L0/L1:         │              FAIL                 │
     │  等待人确认]     └──────────────────────────────────┘
     ▼
 [人类确认]
```

## 各步骤详解

### 步骤 1：lead — decompose（任务分解）

**输入：** 用户的功能需求描述

**动作：**
1. 调用 design skill 进行目标澄清和 AC 定义
2. 将功能拆解为可执行的子任务
3. 为每个子任务指定 AC

**输出：** 结构化的任务分解方案（含 AC）

**门控：** 在 L0/L1 模式下，分解结果需要人类确认后才继续。L2/L3 模式下自动通过。

**失败处理：** 如果信息不足，返回 NEEDS_CONTEXT 等待人类补充。

### 步骤 2：implementer — implement（实现）

**输入：** lead 分解的子任务 + AC + 上下文

**动作：**
1. 调用 implement skill 执行编码
2. 对照 AC 自检
3. 返回变更摘要

**输出：** 代码变更 + 状态返回

**失败处理：**
- NEEDS_CONTEXT → 回到 lead 补充信息
- BLOCKED → 升级给人类

### 步骤 3：reviewer — review（审查）

**输入：** implementer 的代码变更 + AC

**动作：**
1. 调用 review skill 逐维度审查
2. 输出结构化审查报告

**输出：** 审查报告（PASS / FAIL + 问题列表）

**如果 PASS：** 跳过 judge，直接进入 reflect
**如果 FAIL：** 进入 judge 裁决

### 步骤 4：judge — judge（裁决）

**输入：** implementer 变更 + reviewer 报告 + AC + 当前轮次

**动作：**
1. 独立评估变更是否达标
2. 输出裁决结果

**输出：** PASS / FAIL / PARTIAL

**对抗循环：**
- FAIL → implementer 根据必须修改条目重新实现 → reviewer 重新审查 → judge 重新裁决
- 最多循环 round_cap 次（默认 3 次）
- round_cap 耗尽仍为 FAIL → escalate（升级给人类决策）

### 步骤 5：lead — reflect（反思）

**输入：** 整个流程的执行记录

**动作：**
1. 调用 reflect skill 进行反思
2. 沉淀有价值的知识到 memory

**输出：** 反思记录 + memory 更新

## 适用场景

- 新功能开发
- 现有功能增强
- 需要设计决策的技术任务
- 任何需要完整质量把控的变更

## 不适用场景

- 紧急缺陷修复 → 使用 bugfix 工作流
- 大型长期项目 → 使用 longmarch 工作流
- 纯机械性任务（格式化、批量重命名）→ 直接 L3 执行，无需工作流

## 配置覆盖

可在 config.yaml 的 overrides 中针对特定路径或任务类型覆盖此工作流的行为：

```yaml
overrides:
  - match: "tests/**"
    autonomy: L3          # 测试代码全自动
  - match: "src/auth/**"
    round_cap: 5          # 安全相关代码更多轮审查
```
