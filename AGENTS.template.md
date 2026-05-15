# {{ENTRY_FILENAME}}

---

## Autonomy Level 约定

| 等级   | 模式     | 人类角色                     | 适用场景             |
| ------ | -------- | ---------------------------- | -------------------- |
| **L0** | 全手动   | Agent 建议，人执行           | 高风险变更、架构决策 |
| **L1** | 半自动   | Agent 执行，关键节点等人确认 | 常规功能开发         |
| **L2** | 监督自动 | Agent 全自动，人异步 review  | 批量任务、重构       |
| **L3** | 全自动   | Agent 自主完成，仅失败时通知 | 机械性任务、格式化   |

当前默认等级：**{{DEFAULT_AUTONOMY}}**

---

## 对抗三角约定

- Writer（执行者）不能 review 自己的产出
- Reviewer（审查者）只读，不能直接修改代码
- Judge（裁决者）独立于 Writer 和 Reviewer，做最终裁决
- 对抗轮次有上限（默认 `round_cap: {{ROUND_CAP}}`），达到上限后 Judge 强制裁决

---

## 记忆沉淀触发条件

以下情况必须触发记忆沉淀（写入 `.kqforge/memory/`）：

- 发现项目级约束或约定
- 犯错后的根因分析结论
- 人类明确指出的偏好或规则
- 反复出现的模式（第二次遇到时沉淀）

---

{{CUSTOM_RULES}}

## Agents

{{AGENTS_TABLE}}

除上述 Agent 外，也可以根据任务需要调用项目中其他可用的 Agent。

---

## Skills

{{SKILLS_TABLE}}

除上述 Skills 外，也可以调用项目中其他可用的 Skill。执行任务时应尽可能多地调用合适的 Skill 以确保质量。

---

## Workflows

{{WORKFLOWS_TABLE}}

除上述 Workflows 外，也可以根据任务类型选择项目中其他可用的 Workflow。
