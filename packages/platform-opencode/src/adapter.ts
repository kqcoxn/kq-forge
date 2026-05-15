import { writeFile, mkdir } from "node:fs/promises";
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
 * OpenCode 平台适配器
 *
 * 输出结构：
 * - AGENTS.md — 从 AGENTS.template.md 渲染（替换占位符）
 * - .opencode/agents/*.md — 转译后的 agent 定义
 * - .opencode/skills/<name>/SKILL.md — 转译后的 skills
 * - .opencode/workflows/*.md — workflow 文件
 */
export class OpenCodeAdapter implements PlatformAdapter {
  readonly name = "opencode" as const;

  async sync(context: SyncContext): Promise<SyncResult> {
    const { projectRoot, agents, skills, workflows } = context;
    const result: SyncResult = { files: [], warnings: [] };

    // 创建 .opencode 目录结构
    const opencodeDir = join(projectRoot, ".opencode");
    await mkdir(join(opencodeDir, "agents"), { recursive: true });
    await mkdir(join(opencodeDir, "skills"), { recursive: true });
    await mkdir(join(opencodeDir, "workflows"), { recursive: true });

    // 1. 渲染 AGENTS.md（从模板 + 占位符替换）
    const agentsMdContent = this.renderEntryFile(context);
    const agentsMdPath = join(projectRoot, "AGENTS.md");
    await writeFile(agentsMdPath, agentsMdContent, "utf-8");
    result.files.push({ path: "AGENTS.md", action: "created" });

    // 2. 生成 .opencode/agents/*.md
    for (const agent of agents) {
      const content = this.transformAgent(agent);
      const filePath = join(opencodeDir, "agents", `${agent.frontmatter.name}.md`);
      await writeFile(filePath, content, "utf-8");
      result.files.push({
        path: `.opencode/agents/${agent.frontmatter.name}.md`,
        action: "created",
      });
    }

    // 3. 生成 .opencode/skills/<name>/SKILL.md
    for (const skill of skills) {
      const skillDir = join(opencodeDir, "skills", skill.frontmatter.name);
      await mkdir(skillDir, { recursive: true });

      const content = this.transformSkill(skill);
      await writeFile(join(skillDir, "SKILL.md"), content, "utf-8");
      result.files.push({
        path: `.opencode/skills/${skill.frontmatter.name}/SKILL.md`,
        action: "created",
      });

      if (skill.subFiles) {
        for (const sub of skill.subFiles) {
          await writeFile(join(skillDir, sub.name), sub.content, "utf-8");
        }
      }
    }

    // 4. 生成 .opencode/workflows/*.md
    for (const wf of workflows) {
      const content = this.transformWorkflow(wf);
      const filePath = join(opencodeDir, "workflows", `${wf.frontmatter.name}.md`);
      await writeFile(filePath, content, "utf-8");
      result.files.push({
        path: `.opencode/workflows/${wf.frontmatter.name}.md`,
        action: "created",
      });
    }

    return result;
  }

  getDefaultConfig(): PlatformConfig {
    return {
      platform: "opencode",
      output: {
        directory: ".opencode",
        entry_file: "AGENTS.md",
        agent_format: "single-file",
      },
      mapping: { skill_injection: "inline" },
      sync: { auto: true, watch: false, on_conflict: "overwrite" },
      platform_specific: {},
    };
  }

  /**
   * 渲染入口文件：读取模板，替换占位符
   */
  private renderEntryFile(context: SyncContext): string {
    const { config, agents, skills, workflows, template } = context;

    const vars: TemplateVars = {
      ENTRY_FILENAME: "AGENTS.md",
      DEFAULT_AUTONOMY: config.defaults.autonomy,
      ROUND_CAP: String(config.defaults.round_cap),
      CUSTOM_RULES: context.customRules ? context.customRules + "\n\n---\n\n" : "",
      AGENTS_TABLE: this.buildAgentsTable(agents),
      SKILLS_TABLE: this.buildSkillsTable(skills),
      WORKFLOWS_TABLE: this.buildWorkflowsTable(workflows),
    };

    return renderTemplate(template, vars);
  }

  private buildAgentsTable(agents: AgentDefinition[]): string {
    if (agents.length === 0) return "（无）";
    const lines: string[] = [];
    lines.push(`| Agent | 职责 | 默认等级 | 文件 |`);
    lines.push(`| ----- | ---- | -------- | ---- |`);
    for (const agent of agents) {
      const desc = agent.frontmatter.description || "";
      lines.push(
        `| **${agent.frontmatter.name}** | ${desc} | ${agent.frontmatter.autonomy} | [.opencode/agents/${agent.frontmatter.name}.md](.opencode/agents/${agent.frontmatter.name}.md) |`
      );
    }
    return lines.join("\n");
  }

  private buildSkillsTable(skills: SkillDefinition[]): string {
    if (skills.length === 0) return "（无）";
    const lines: string[] = [];
    const capabilitySkills = skills.filter((s) => s.frontmatter.type === "capability");
    const constraintSkills = skills.filter((s) => s.frontmatter.type === "constraint");

    if (capabilitySkills.length > 0) {
      lines.push(`### 能力类 Skills\n`);
      lines.push(`| Skill | 说明 | 路径 |`);
      lines.push(`| ----- | ---- | ---- |`);
      for (const skill of capabilitySkills) {
        const desc = skill.frontmatter.description || "";
        lines.push(
          `| ${skill.frontmatter.name} | ${desc} | [.opencode/skills/${skill.frontmatter.name}/](.opencode/skills/${skill.frontmatter.name}/SKILL.md) |`
        );
      }
      lines.push(``);
    }

    if (constraintSkills.length > 0) {
      lines.push(`### 约束类 Skills\n`);
      lines.push(`| Skill | 说明 | 路径 |`);
      lines.push(`| ----- | ---- | ---- |`);
      for (const skill of constraintSkills) {
        const desc = skill.frontmatter.description || "";
        lines.push(
          `| ${skill.frontmatter.name} | ${desc} | [.opencode/skills/${skill.frontmatter.name}/](.opencode/skills/${skill.frontmatter.name}/SKILL.md) |`
        );
      }
    }

    return lines.join("\n");
  }

  private buildWorkflowsTable(workflows: WorkflowDefinition[]): string {
    if (workflows.length === 0) return "（无）";
    const lines: string[] = [];
    lines.push(`| Workflow | 说明 | 文件 |`);
    lines.push(`| -------- | ---- | ---- |`);
    for (const wf of workflows) {
      const desc = wf.frontmatter.description || "";
      lines.push(
        `| **${wf.frontmatter.name}** | ${desc} | [.opencode/workflows/${wf.frontmatter.name}.md](.opencode/workflows/${wf.frontmatter.name}.md) |`
      );
    }
    return lines.join("\n");
  }

  private transformAgent(agent: AgentDefinition): string {
    const fm = agent.frontmatter;
    const lines: string[] = [];
    lines.push(`---`);
    lines.push(`name: ${fm.name}`);
    if (fm.description) lines.push(`description: ${fm.description}`);
    lines.push(`---`);
    lines.push(``);
    lines.push(`# ${fm.name}\n`);
    if (fm.scope) {
      const scope = Array.isArray(fm.scope) ? fm.scope.join(", ") : fm.scope;
      lines.push(`**Scope**: ${scope}\n`);
    }
    lines.push(`**Autonomy**: ${fm.autonomy}\n`);
    if (fm.required_skills.length > 0) {
      lines.push(`**Required Skills**: ${fm.required_skills.join(", ")}\n`);
    }
    if (fm.optional_skills.length > 0) {
      lines.push(`**Optional Skills**: ${fm.optional_skills.join(", ")}\n`);
    }
    if (fm.delegates_to.length > 0) {
      lines.push(`**Delegates To**: ${fm.delegates_to.join(", ")}\n`);
    }
    if (agent.body) {
      lines.push(`---\n`);
      lines.push(agent.body);
    }
    return lines.join("\n");
  }

  private transformSkill(skill: SkillDefinition): string {
    const fm = skill.frontmatter;
    const lines: string[] = [];
    lines.push(`---`);
    lines.push(`name: ${fm.name}`);
    if (fm.description) lines.push(`description: ${fm.description}`);
    lines.push(`---`);
    lines.push(``);
    if (skill.body) lines.push(skill.body);
    return lines.join("\n");
  }

  private transformWorkflow(wf: WorkflowDefinition): string {
    const fm = wf.frontmatter;
    const lines: string[] = [];
    lines.push(`---`);
    lines.push(`name: ${fm.name}`);
    if (fm.description) lines.push(`description: ${fm.description}`);
    lines.push(`---`);
    lines.push(``);
    lines.push(`# ${fm.name}\n`);
    if (fm.description) lines.push(`${fm.description}\n`);
    lines.push(`## 步骤\n`);
    for (let i = 0; i < fm.steps.length; i++) {
      const step = fm.steps[i];
      lines.push(`${i + 1}. **${step.agent}** → ${step.action} (${step.autonomy || "继承默认"})`);
      if (step.gate?.message) lines.push(`   - Gate: ${step.gate.message}`);
      if (step.on_fail !== "retry") lines.push(`   - On Fail: ${step.on_fail}`);
    }
    lines.push(``);
    if (wf.body) {
      lines.push(`---\n`);
      lines.push(wf.body);
    }
    return lines.join("\n");
  }
}
