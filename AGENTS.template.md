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

以下情况必须触发记忆沉淀（通过 memory-keeper 子智能体写入 `.kqforge/memory/`）：

- 发现项目级约束或约定
- 犯错后的根因分析结论
- 人类明确指出的偏好或规则
- 反复出现的模式（第二次遇到时沉淀）

---

## 记忆读取规则

任务开始时，按以下策略读取 `.kqforge/memory/` 下的记忆文件：

- **rules.md**：全文读取（项目硬约束，不可遗漏）
- **facts.md**：用当前任务涉及的模块名、文件路径、技术关键词搜索，只读匹配条目
- **lessons.md**：用当前任务涉及的模块名、文件路径、技术关键词搜索，只读匹配条目

如果 facts.md 或 lessons.md 文件较短（< 30 条），可直接全文读取。

---

## 范式（Paradigm）

范式是从反复出现的工作模式中提炼的专家 Agent。文件名以 `paradigm-` 为前缀，直接存放在平台 agents 目录中（如 `.opencode/agents/paradigm-api-expert.md`）。

- 创建范式前**必须征得用户同意**
- 范式文件格式与普通 Agent 相同，但 body 包含四个段落：模式、步骤、判断依据、反例
- 当同一模式出现 3 次以上时，应建议用户创建范式

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
