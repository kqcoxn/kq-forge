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
import { renderTemplate, type TemplateVars } from "@kq-forge/core";

/**
 * Codex CLI 平台适配器
 *
 * 输出结构：
 * - AGENTS.md — 从 AGENTS.template.md 渲染，Agents/Skills/Workflows 全量 inline
 *
 * Codex 只读 AGENTS.md，无子目录结构，所以把所有内容 inline 到表格/正文中。
 */
export class CodexAdapter implements PlatformAdapter {
  readonly name = "codex" as const;

  async sync(context: SyncContext): Promise<SyncResult> {
    const { projectRoot } = context;
    const result: SyncResult = { files: [], warnings: [] };

    const content = this.renderEntryFile(context);
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
      mapping: { skill_injection: "inline" },
      sync: { auto: true, watch: false, on_conflict: "overwrite" },
      platform_specific: {},
    };
  }

  private renderEntryFile(context: SyncContext): string {
    const { config, agents, skills, workflows, template } = context;

    const vars: TemplateVars = {
      ENTRY_FILENAME: "AGENTS.md",
      DEFAULT_AUTONOMY: config.defaults.autonomy,
      ROUND_CAP: String(config.defaults.round_cap),
      CUSTOM_RULES: context.customRules ? context.customRules + "\n\n---\n\n" : "",
      AGENTS_TABLE: this.buildAgentsInline(agents),
      SKILLS_TABLE: this.buildSkillsInline(skills),
      WORKFLOWS_TABLE: this.buildWorkflowsInline(workflows),
    };

    return renderTemplate(template, vars);
  }

  /**
   * Codex 全量 inline：每个 agent 展开完整内容
   */
  private buildAgentsInline(agents: AgentDefinition[]): string {
    if (agents.length === 0) return "（无）";
    const lines: string[] = [];

    for (const agent of agents) {
      const fm = agent.frontmatter;
      lines.push(`### ${fm.name}\n`);
      if (fm.description) lines.push(`${fm.description}\n`);
      const scope = Array.isArray(fm.scope) ? fm.scope.join(", ") : fm.scope;
      lines.push(`- **Scope**: ${scope}`);
      lines.push(`- **Autonomy**: ${fm.autonomy}`);
      if (fm.required_skills.length > 0) {
        lines.push(`- **Required Skills**: ${fm.required_skills.join(", ")}`);
      }
      if (fm.delegates_to.length > 0) {
        lines.push(`- **Delegates To**: ${fm.delegates_to.join(", ")}`);
      }
      lines.push(``);
      if (agent.body) {
        lines.push(agent.body);
        lines.push(``);
      }
    }

    return lines.join("\n");
  }

  /**
   * Codex 全量 inline：每个 skill 展开完整内容
   */
  private buildSkillsInline(skills: SkillDefinition[]): string {
    if (skills.length === 0) return "（无）";
    const lines: string[] = [];

    const constraintSkills = skills.filter((s) => s.frontmatter.type === "constraint");
    const capabilitySkills = skills.filter((s) => s.frontmatter.type === "capability");

    if (constraintSkills.length > 0) {
      lines.push(`### 约束类 Skills（始终生效）\n`);
      for (const skill of constraintSkills) {
        lines.push(`#### ${skill.frontmatter.name}\n`);
        if (skill.frontmatter.description) lines.push(`${skill.frontmatter.description}\n`);
        if (skill.body) {
          lines.push(skill.body);
          lines.push(``);
        }
      }
    }

    if (capabilitySkills.length > 0) {
      lines.push(`### 能力类 Skills（按需加载）\n`);
      for (const skill of capabilitySkills) {
        lines.push(`#### ${skill.frontmatter.name}\n`);
        if (skill.frontmatter.description) lines.push(`${skill.frontmatter.description}\n`);
        if (skill.body) {
          lines.push(skill.body);
          lines.push(``);
        }
      }
    }

    return lines.join("\n");
  }

  /**
   * Codex 全量 inline：每个 workflow 展开步骤
   */
  private buildWorkflowsInline(workflows: WorkflowDefinition[]): string {
    if (workflows.length === 0) return "（无）";
    const lines: string[] = [];

    for (const wf of workflows) {
      const fm = wf.frontmatter;
      lines.push(`### ${fm.name}\n`);
      if (fm.description) lines.push(`${fm.description}\n`);
      lines.push(`**步骤**:\n`);
      for (let i = 0; i < fm.steps.length; i++) {
        const step = fm.steps[i];
        lines.push(`${i + 1}. **${step.agent}** → ${step.action} (${step.autonomy || "继承默认"})`);
      }
      lines.push(``);
      if (wf.body) {
        lines.push(wf.body);
        lines.push(``);
      }
    }

    return lines.join("\n");
  }
}
