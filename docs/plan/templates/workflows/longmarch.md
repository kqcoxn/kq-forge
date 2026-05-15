---
name: longmarch
description: 长征模式——持续向远目标反复推进，自分阶段循环迭代
triggers:
  - "/workflow longmarch"
  - "/march"
steps:
  # Phase 0: 目标分解为 milestones
  - agent: lead
    action: plan-phases
    autonomy: L0
    gate:
      enabled: true
      min_autonomy: L3
      message: "阶段规划完成，请确认 milestone 列表和优先级"
  # 迭代循环开始
  - agent: lead
    action: plan-iteration
  - agent: implementer
    action: implement
  - agent: reviewer
    action: review
    round_cap: 2
    on_fail: escalate
  - agent: lead
    action: checkpoint
    gate:
      enabled: true
      min_autonomy: L2
      message: "迭代完成，请确认进度并决定是否继续/调整方向"
  # Milestone 完成时引入 judge
  - agent: judge
    action: judge-milestone
    condition: "milestone_ready"
    round_cap: 2
loop:
  enabled: true
  max_iterations: 20
  until: "milestone_complete"
on_complete: reflect
---

## 概述

Longmarch（长征）工作流适用于需要持续推进的大型目标——架构迁移、系统重构、新产品搭建等。这些任务的特点是：目标遥远、路径不确定、需要分阶段推进、每个阶段内部需要多次迭代。

与 feature 工作流的关键区别：feature 是"一次性完成一个功能"，longmarch 是"持续向一个远目标反复推进，边走边调整"。

## 核心理念

**长征三原则：**

1. **分而治之**：将遥远的终极目标拆为有序的 milestones，每个 milestone 是一个可验证的中间状态
2. **迭代推进**：每个 milestone 内部通过多次短迭代逐步逼近
3. **动态调整**：每次迭代后评估方向，允许调整计划（而非死守初始方案）

## 流程图

```
┌────────────────────────────────────────────────────────────────────┐
│                        LONGMARCH 工作流                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────┐                                                      │
│  │   lead   │  Phase 0: 将终极目标拆为 Milestones                    │
│  │plan-phases│  [L0 门控：必须人确认]                                 │
│  └────┬─────┘                                                      │
│       │                                                            │
│       ▼                                                            │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │              Milestone N 迭代循环                         │       │
│  │                                                         │       │
│  │  ┌──────┐   ┌───────────┐   ┌────────┐   ┌──────────┐ │       │
│  │  │ lead │──▶│implementer│──▶│reviewer│──▶│   lead   │ │       │
│  │  │plan- │   │ implement │   │ review │   │checkpoint│ │       │
│  │  │iter. │   └───────────┘   └────────┘   └────┬─────┘ │       │
│  │  └──────┘                                      │       │       │
│  │      ▲                                         │       │       │
│  │      │            继续迭代                      │       │       │
│  │      └─────────────────────────────────────────┘       │       │
│  │                                                         │       │
│  │      当 milestone_ready 时:                              │       │
│  │      ┌───────┐                                          │       │
│  │      │ judge │  裁决 milestone 是否达标                   │       │
│  │      │ mile- │                                          │       │
│  │      │ stone │                                          │       │
│  │      └───┬───┘                                          │       │
│  │          │                                              │       │
│  └──────────┼──────────────────────────────────────────────┘       │
│             │                                                      │
│             ▼                                                      │
│  ┌──────────┐                                                      │
│  │   lead   │  Milestone 完成后反思沉淀                              │
│  │ reflect  │  然后进入下一个 Milestone                              │
│  └──────────┘                                                      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## 各步骤详解

### Phase 0：lead — plan-phases（阶段规划）

**输入：** 用户描述的终极目标

**动作：**
1. 理解终极目标和约束条件
2. 将目标拆解为有序的 milestones
3. 每个 milestone 定义：
   - 名称和描述
   - 验收标准（可验证的中间状态）
   - 预估迭代次数
   - 与前后 milestone 的依赖关系
4. 确定 milestone 优先级和执行顺序

**输出：** Milestone 列表（含 AC 和优先级）

**门控：** 强制人确认（min_autonomy: L3，即只有 L3 才跳过）。阶段规划是战略决策，必须人类参与。

**Milestone 设计原则：**
- 每个 milestone 是一个**可独立验证的中间状态**（不是"完成 50%"这种模糊状态）
- milestone 之间尽量**低耦合**（允许调整顺序或跳过）
- 单个 milestone 预估 3-8 次迭代可完成（太少说明粒度太细，太多说明粒度太粗）

### 迭代步骤 1：lead — plan-iteration（迭代规划）

**输入：** 当前 milestone 的 AC + 上一次迭代的结果（如有）

**动作：**
1. 评估当前进度（距离 milestone AC 还有多远）
2. 规划本次迭代的具体任务
3. 定义本次迭代的小目标（milestone AC 的子集）

**输出：** 本次迭代的任务列表 + 小目标

**关键：** 每次迭代规划都基于最新状态，不死守初始计划。

### 迭代步骤 2：implementer — implement（实现）

**输入：** 本次迭代的任务 + 小目标

**动作：** 标准实现流程（调用 implement skill）

**输出：** 代码变更 + 状态返回

### 迭代步骤 3：reviewer — review（审查）

**输入：** 本次迭代的变更 + 小目标

**动作：** 轻量审查（round_cap: 2，迭代内追求速度）

**审查重点：**
- 变更是否朝着 milestone AC 的方向前进？
- 是否引入了会阻碍后续迭代的技术债？
- 是否有明显的正确性问题？

**注意：** 迭代内的审查比 feature 工作流更宽松——允许"足够好"而非"完美"，因为后续迭代可以持续改进。

### 迭代步骤 4：lead — checkpoint（检查点）

**输入：** 本次迭代的结果 + milestone AC + 历史迭代记录

**动作：**
1. 评估本次迭代的成果
2. 更新进度（哪些 milestone AC 已满足）
3. 判断下一步：
   - **继续迭代**：还有未满足的 AC
   - **milestone 就绪**：所有 AC 看起来已满足，触发 judge 裁决
   - **调整方向**：发现原计划不可行，需要修改 milestone 定义
   - **升级**：遇到无法自行解决的阻塞

**门控：** L0/L1 模式下需人确认方向。L2/L3 自动继续。

**输出：**
- 进度报告
- 下一步决策（继续 / milestone_ready / 调整 / 升级）

### 条件步骤：judge — judge-milestone（Milestone 裁决）

**触发条件：** checkpoint 判定 `milestone_ready`

**输入：** milestone 的全部变更 + milestone AC + 审查历史

**动作：**
1. 逐条对照 milestone AC
2. 评估整体质量（不只是单次迭代，而是 milestone 整体）
3. 裁决 milestone 是否达标

**输出：**
- PASS → milestone 完成，进入反思，然后开始下一个 milestone
- FAIL → 回到迭代循环继续推进
- PARTIAL → 部分 AC 满足，标记已完成的部分，继续推进剩余部分

## 循环控制

```yaml
loop:
  enabled: true
  max_iterations: 20      # 单个 milestone 最多 20 次迭代
  until: "milestone_complete"
```

**安全阀：**
- 单个 milestone 最多 20 次迭代
- 超过 20 次 → 强制停止，升级给人类
- 人类可随时通过 checkpoint 门控调整方向或终止

**Milestone 间的循环：**
- 一个 milestone 完成后，自动进入下一个 milestone
- 所有 milestones 完成 → 整个 longmarch 结束
- 人类可随时终止或调整 milestone 列表

## 适用场景

- 大型架构迁移（如从 monolith 到 microservices）
- 系统重构（如替换核心框架）
- 新产品/新模块从零搭建
- 技术债清理（大量文件需要逐步改造）
- 任何预估需要多天/多周持续推进的目标

## 不适用场景

- 单次可完成的功能 → 使用 feature 工作流
- 紧急 bug 修复 → 使用 bugfix 工作流
- 探索性原型（不确定目标）→ 建议先用 feature 工作流做 spike

## 与 feature 工作流的区别

| 维度 | feature | longmarch |
|------|---------|-----------|
| 目标规模 | 单个功能 | 大型目标（多 milestone） |
| 执行模式 | 线性一次性 | 循环迭代 |
| 质量把控 | 每次变更都三角对抗 | 迭代内轻量审查，milestone 级别 judge |
| 方向调整 | 无（目标明确） | 每次 checkpoint 可调整 |
| 人类介入 | 分解时确认 | 阶段规划 + 每次 checkpoint |
| 反思时机 | 任务结束后 | 每个 milestone 结束后 |
| 适合时长 | 分钟到小时 | 小时到天/周 |

## 最佳实践

1. **Milestone 粒度**：每个 milestone 应该是"一个有意义的中间状态"，而非"完成 X% 的工作量"
2. **迭代节奏**：每次迭代聚焦一个小目标，不要贪多
3. **及时调整**：如果连续 3 次迭代没有明显进展，在 checkpoint 时考虑调整方向
4. **知识积累**：每个 milestone 的反思是宝贵的知识来源，认真对待
5. **逃生舱**：随时可以通过 checkpoint 门控终止或调整，不要死磕不可行的方案
