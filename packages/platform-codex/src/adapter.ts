import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  PlatformAdapter,
  SyncContext,
  SyncResult,
  PlatformConfig,
  AgentDefinition,
  SkillDefinition,
  WorkflowDefinition,
} from "@kq-forge/core";

/**
 * Codex CLI 平台适配器
 *
 * 输出结构：
 * - AGENTS.md — 全量 inline（Codex 只认 AGENTS.md，无子目录结构）
 *
 * Codex 读取项目根的 AGENTS.md 作为唯一指令来源。
 * 所有 agents/skills/workflows 内容 inline 注入。
 */
export class CodexAdapter implements PlatformAdapter {
  readonly name = "codex" as const;

  async sync(context: SyncContext): Promise<SyncResult> {
    const { projectRoot } = context;
    const result: SyncResult = { files: [], warnings: [] };

    const content = this.generateAgentsMd(context);
    const filePath = join(projectRoot, "AGENTS.md");
    await writeFile(filePath, content, "utf-8");
    result.files.push({ path: "AGENTS.md", action: "created" });

    return result;
  }

  getDefaultConfig(): PlatformConfig {
    return {
      platform: "codex",
      output: {
        directory: ".",
        entry_file: "AGENTS.md",
        agent_format: "single-file",
      },
      mapping: {
        skill_injection: "inline",
      },
      sync: {
        auto: true,
        watch: false,
        on_conflict: "overwrite",
      },
      platform_specific: {},
    };
  }

  private generateAgentsMd(context: SyncContext): string {
    const { config, agents, skills, workflows } = context;
    const sections: string[] = [];

    sections.push(`# AGENTS.md\n`);
    sections.push(
      `> 本文件由 KQ-Forge 自动生成，请勿手动编辑。修改 \`.kqforge/config.yaml\` 后运行 \`kq-forge sync\` 重新同步。\n`
    );

    // 项目协作规则
    sections.push(`---\n`);
    sections.push(`## 项目协作规则\n`);
    sections.push(
      `以下规则对所有 Agent 生效，不可被单个 Agent 或 Workflow 覆盖。\n`
    );
    sections.push(`### 基本原则\n`);
    sections.push(
      `1. **以人为本** — 人类是最终决策者。任何 Agent 在不确定时应请求澄清而非猜测。`
    );
    sections.push(
      `2. **因地制宜** — 不同任务使用不同的 autonomy level，不存在"一刀切"的最优模式。`
    );
    sections.push(
      `3. **实事求是** — 犯错不可怕，隐瞒错误不可接受。发现问题立即上报。\n`
    );

    // Autonomy Level
    sections.push(`### Autonomy Level 约定\n`);
    sections.push(`| 等级   | 模式     | 人类角色                     | 适用场景             |`);
    sections.push(`| ------ | -------- | ---------------------------- | -------------------- |`);
    sections.push(`| **L0** | 全手动   | Agent 建议，人执行           | 高风险变更、架构决策 |`);
    sections.push(`| **L1** | 半自动   | Agent 执行，关键节点等人确认 | 常规功能开发         |`);
    sections.push(`| **L2** | 监督自动 | Agent 全自动，人异步 review  | 批量任务、重构       |`);
    sections.push(`| **L3** | 全自动   | Agent 自主完成，仅失败时通知 | 机械性任务、格式化   |\n`);
    sections.push(`默认等级：**${config.defaults.autonomy}**\n`);

    // 对抗三角
    sections.push(`### 对抗三角约定\n`);
    sections.push(`- Writer（执行者）不能 review 自己的产出`);
    sections.push(`- Reviewer（审查者）只读，不能直接修改代码`);
    sections.push(`- Judge（裁决者）独立于 Writer 和 Reviewer，做最终裁决`);
    sections.push(
      `- 对抗轮次有上限（默认 \`round_cap: ${config.defaults.round_cap}\`），达到上限后 Judge 强制裁决\n`
    );

    // 记忆沉淀
    sections.push(`### 记忆沉淀触发条件\n`);
    sections.push(
      `以下情况必须触发记忆沉淀（写入 \`.kqforge/memory/\`）：\n`
    );
    sections.push(`- 发现项目级约束或约定（如"本项目用 pnpm"）`);
    sections.push(`- 犯错后的根因分析结论`);
    sections.push(`- 人类明确指出的偏好或规则`);
    sections.push(`- 反复出现的模式（第二次遇到时沉淀）\n`);

    // 自定义规则
    sections.push(`---\n`);
    sections.push(`## 自定义规则\n`);
    sections.push(`全程使用中文。\n`);

    // Agents（全量 inline）
    sections.push(`---\n`);
    sections.push(`## Agents\n`);
    for (const agent of agents) {
      sections.push(`### ${agent.frontmatter.name}\n`);
      if (agent.frontmatter.description) {
        sections.push(`${agent.frontmatter.description}\n`);
      }
      const scope = Array.isArray(agent.frontmatter.scope)
        ? agent.frontmatter.scope.join(", ")
        : agent.frontmatter.scope;
      sections.push(`- **Scope**: ${scope}`);
      sections.push(`- **Autonomy**: ${agent.frontmatter.autonomy}`);
      if (agent.frontmatter.required_skills.length > 0) {
        sections.push(`- **Required Skills**: ${agent.frontmatter.required_skills.join(", ")}`);
      }
      if (agent.frontmatter.delegates_to.length > 0) {
        sections.push(`- **Delegates To**: ${agent.frontmatter.delegates_to.join(", ")}`);
      }
      sections.push(``);
      if (agent.body) {
        sections.push(agent.body);
        sections.push(``);
      }
    }

    // Skills（全量 inline）
    sections.push(`---\n`);
    sections.push(`## Skills\n`);

    const constraintSkills = skills.filter((s) => s.frontmatter.type === "constraint");
    const capabilitySkills = skills.filter((s) => s.frontmatter.type === "capability");

    if (constraintSkills.length > 0) {
      sections.push(`### 约束类 Skills（始终生效）\n`);
      for (const skill of constraintSkills) {
        sections.push(`#### ${skill.frontmatter.name}\n`);
        if (skill.frontmatter.description) {
          sections.push(`${skill.frontmatter.description}\n`);
        }
        if (skill.body) {
          sections.push(skill.body);
          sections.push(``);
        }
      }
    }

    if (capabilitySkills.length > 0) {
      sections.push(`### 能力类 Skills（按需加载）\n`);
      for (const skill of capabilitySkills) {
        sections.push(`#### ${skill.frontmatter.name}\n`);
        if (skill.frontmatter.description) {
          sections.push(`${skill.frontmatter.description}\n`);
        }
        if (skill.body) {
          sections.push(skill.body);
          sections.push(``);
        }
      }
    }

    // Workflows（全量 inline）
    sections.push(`---\n`);
    sections.push(`## Workflows\n`);
    for (const wf of workflows) {
      sections.push(`### ${wf.frontmatter.name}\n`);
      if (wf.frontmatter.description) {
        sections.push(`${wf.frontmatter.description}\n`);
      }
      sections.push(`**步骤**:\n`);
      for (let i = 0; i < wf.frontmatter.steps.length; i++) {
        const step = wf.frontmatter.steps[i];
        sections.push(`${i + 1}. **${step.agent}** → ${step.action} (${step.autonomy || "继承默认"})`);
      }
      sections.push(``);
      if (wf.body) {
        sections.push(wf.body);
        sections.push(``);
      }
    }

    return sections.join("\n");
  }
}
