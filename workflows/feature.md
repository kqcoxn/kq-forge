---
name: feature
description: 标准功能开发流程——探索、设计、计划、实现、对抗审查、裁决、反思
triggers:
  - "/workflow feature"
  - "/feat"
steps:
  - agent: lead
    action: brainstorm
    gate:
      enabled: true
      min_autonomy: L2
      message: "需求探索完成，请确认设计方案"
  - agent: lead
    action: plan
    gate:
      enabled: true
      min_autonomy: L2
      message: "实现计划已生成，请确认后开始执行"
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

Feature 工作流是 KQ-Forge 的默认工作流，适用于标准的功能开发场景。它实现了完整的"探索→计划→实现→对抗审查→裁决→反思"流程，确保每次交付都经过结构化的质量把控。

## 流程图

```
┌─────────┐     ┌─────────┐     ┌──────────────┐     ┌──────────┐     ┌───────┐     ┌─────────┐
│  lead   │────▶│  lead   │────▶│ implementer  │────▶│ reviewer │────▶│ judge │────▶│  lead   │
│brainstorm│    │  plan   │     │  implement   │     │  review  │     │ judge │     │ reflect │
└─────────┘     └─────────┘     └──────────────┘     └──────────┘     └───────┘     └─────────┘
     │               │                  ▲                                  │
     │ [L0/L1:       │ [L0/L1:         │              FAIL                 │
     │  等待确认]     │  等待确认]      └──────────────────────────────────┘
     ▼               ▼
 [人类确认]      [人类确认]
```

## 各步骤详解

### 步骤 1：lead — brainstorm（需求探索）

**输入：** 用户的功能需求描述

**动作：**
1. 探索项目上下文，理解当前状态
2. 逐个提问澄清需求（L0/L1），或快速确认方向（L2/L3）
3. 提出 2-3 种方案，附权衡分析和推荐
4. 呈现设计方案，获得确认

**输出：** 确认的设计方案（含 AC）

**门控：** L0/L1 模式下设计方案需人类确认。L2/L3 自动通过。

**失败处理：** 如果信息不足，返回 NEEDS_CONTEXT 等待人类补充。

### 步骤 2：lead — plan（计划编写）

**输入：** 确认的设计方案

**动作：**
1. 映射文件结构
2. 按 2-5 分钟粒度分解为可执行步骤（L0/L1），或按任务级别分解（L2/L3）
3. 每步包含精确文件路径、代码片段、验证命令
4. 自检计划覆盖度和一致性

**输出：** 结构化实现计划

**门控：** L0/L1 模式下计划需人类确认。L2/L3 自动通过。

### 步骤 3：implementer — implement（实现）

**输入：** lead 的实现计划 + AC + 上下文

**动作：**
1. 审阅计划，确认无疑问
2. 严格按步骤顺序执行
3. 每步运行验证命令确认结果
4. 对照 AC 自检
5. 返回变更摘要

**输出：** 代码变更 + 状态返回

**失败处理：**
- NEEDS_CONTEXT → 回到 lead 补充信息
- BLOCKED → 升级给人类

### 步骤 4：reviewer — review（审查）

**输入：** implementer 的代码变更 + AC

**动作：**
1. 调用 review skill 逐维度审查
2. 输出结构化审查报告

**输出：** 审查报告（PASS / FAIL + 问题列表）

**如果 PASS：** 跳过 judge，直接进入 reflect
**如果 FAIL：** 进入 judge 裁决

### 步骤 5：judge — judge（裁决）

**输入：** implementer 变更 + reviewer 报告 + AC + 当前轮次

**动作：**
1. 独立评估变更是否达标
2. 输出裁决结果

**输出：** PASS / FAIL / PARTIAL

**对抗循环：**
- FAIL → implementer 根据必须修改条目重新实现 → reviewer 重新审查 → judge 重新裁决
- 最多循环 round_cap 次（默认 3 次）
- round_cap 耗尽仍为 FAIL → escalate（升级给人类决策）

### 步骤 6：lead — reflect（反思）

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
