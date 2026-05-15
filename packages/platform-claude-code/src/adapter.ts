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
 * Claude Code 平台适配器
 *
 * 输出结构：
 * - CLAUDE.md — 从 AGENTS.template.md 渲染（替换占位符，文件名改为 CLAUDE.md）
 * - .claude/settings.json — 权限配置
 * - .claude/agents/*.md — 转译后的 subagent 定义
 * - .claude/skills/<name>/SKILL.md — 转译后的 skills
 * - .claude/workflows/*.md — workflow 文件
 */
export class ClaudeCodeAdapter implements PlatformAdapter {
  readonly name = "claude-code" as const;

  async sync(context: SyncContext): Promise<SyncResult> {
    const { projectRoot, agents, skills, workflows } = context;
    const result: SyncResult = { files: [], warnings: [] };

    // 创建 .claude 目录结构
    const claudeDir = join(projectRoot, ".claude");
    await mkdir(join(claudeDir, "agents"), { recursive: true });
    await mkdir(join(claudeDir, "skills"), { recursive: true });
    await mkdir(join(claudeDir, "workflows"), { recursive: true });

    // 1. 渲染 CLAUDE.md
    const claudeMdContent = this.renderEntryFile(context);
    const claudeMdPath = join(projectRoot, "CLAUDE.md");
    await writeFile(claudeMdPath, claudeMdContent, "utf-8");
    result.files.push({ path: "CLAUDE.md", action: "created" });

    // 2. 生成 .claude/settings.json
    const settingsPath = join(claudeDir, "settings.json");
    const settings = {
      permissions: {
        allow: [
          "Read",
          "Edit",
          "Write",
          "Bash(git *)",
          "Bash(pnpm *)",
          "Bash(npm *)",
        ],
        deny: [
          "Bash(rm -rf /)",
          "Bash(git push --force)",
        ],
      },
    };
    await writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
    result.files.push({ path: ".claude/settings.json", action: "created" });

    // 3. 生成 .claude/agents/*.md（lead 不生成为 subagent）
    for (const agent of agents) {
      if (agent.frontmatter.name === "lead") continue;
      const content = this.transformAgent(agent);
      const filePath = join(claudeDir, "agents", `${agent.frontmatter.name}.md`);
      await writeFile(filePath, content, "utf-8");
      result.files.push({
        path: `.claude/agents/${agent.frontmatter.name}.md`,
        action: "created",
      });
    }

    // 4. 生成 .claude/skills/<name>/SKILL.md
    for (const skill of skills) {
      const skillDir = join(claudeDir, "skills", skill.frontmatter.name);
      await mkdir(skillDir, { recursive: true });
      const content = this.transformSkill(skill);
      await writeFile(join(skillDir, "SKILL.md"), content, "utf-8");
      result.files.push({
        path: `.claude/skills/${skill.frontmatter.name}/SKILL.md`,
        action: "created",
      });
      if (skill.subFiles) {
        for (const sub of skill.subFiles) {
          await writeFile(join(skillDir, sub.name), sub.content, "utf-8");
        }
      }
    }

    // 5. 生成 .claude/workflows/*.md
    for (const wf of workflows) {
      const content = this.transformWorkflow(wf);
      const filePath = join(claudeDir, "workflows", `${wf.frontmatter.name}.md`);
      await writeFile(filePath, content, "utf-8");
      result.files.push({
        path: `.claude/workflows/${wf.frontmatter.name}.md`,
        action: "created",
      });
    }

    return result;
  }

  getDefaultConfig(): PlatformConfig {
    return {
      platform: "claude-code",
      output: {
        directory: ".claude",
        entry_file: "CLAUDE.md",
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
      ENTRY_FILENAME: "CLAUDE.md",
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
      const file = agent.frontmatter.name === "lead"
        ? "(规则内嵌于本文件)"
        : `[.claude/agents/${agent.frontmatter.name}.md](.claude/agents/${agent.frontmatter.name}.md)`;
      lines.push(
        `| **${agent.frontmatter.name}** | ${desc} | ${agent.frontmatter.autonomy} | ${file} |`
      );
    }
    return lines.join("\n");
  }

  private buildSkillsTable(skills: SkillDefinition[]): string {
    if (skills.length === 0) return "（无）";
    const lines: string[] = [];
    const constraintSkills = skills.filter((s) => s.frontmatter.type === "constraint");
    const capabilitySkills = skills.filter((s) => s.frontmatter.type === "capability");

    if (constraintSkills.length > 0) {
      lines.push(`### 约束类 Skills（始终生效）\n`);
      lines.push(`| Skill | 说明 | 路径 |`);
      lines.push(`| ----- | ---- | ---- |`);
      for (const skill of constraintSkills) {
        const desc = skill.frontmatter.description || "";
        lines.push(
          `| ${skill.frontmatter.name} | ${desc} | [.claude/skills/${skill.frontmatter.name}/](.claude/skills/${skill.frontmatter.name}/SKILL.md) |`
        );
      }
      lines.push(``);
    }

    if (capabilitySkills.length > 0) {
      lines.push(`### 能力类 Skills（按需加载）\n`);
      lines.push(`| Skill | 说明 | 路径 |`);
      lines.push(`| ----- | ---- | ---- |`);
      for (const skill of capabilitySkills) {
        const desc = skill.frontmatter.description || "";
        lines.push(
          `| ${skill.frontmatter.name} | ${desc} | [.claude/skills/${skill.frontmatter.name}/](.claude/skills/${skill.frontmatter.name}/SKILL.md) |`
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
        `| **${wf.frontmatter.name}** | ${desc} | [.claude/workflows/${wf.frontmatter.name}.md](.claude/workflows/${wf.frontmatter.name}.md) |`
      );
    }
    return lines.join("\n");
  }

  private transformAgent(agent: AgentDefinition): string {
    const fm = agent.frontmatter;
    const lines: string[] = [];
    lines.push(`# ${fm.name}\n`);
    if (fm.description) lines.push(`${fm.description}\n`);
    lines.push(`## 配置\n`);
    if (fm.scope) {
      const scope = Array.isArray(fm.scope) ? fm.scope.join(", ") : fm.scope;
      lines.push(`- **Scope**: ${scope}`);
    }
    lines.push(`- **Autonomy**: ${fm.autonomy}`);
    if (fm.required_skills.length > 0) {
      lines.push(`- **Required Skills**: ${fm.required_skills.join(", ")}`);
    }
    if (fm.optional_skills.length > 0) {
      lines.push(`- **Optional Skills**: ${fm.optional_skills.join(", ")}`);
    }
    if (fm.delegates_to.length > 0) {
      lines.push(`- **Delegates To**: ${fm.delegates_to.join(", ")}`);
    }
    lines.push(``);
    if (agent.body) {
      lines.push(`## 指令\n`);
      lines.push(agent.body);
    }
    return lines.join("\n");
  }

  private transformSkill(skill: SkillDefinition): string {
    const fm = skill.frontmatter;
    const lines: string[] = [];
    lines.push(`# ${fm.name}\n`);
    if (fm.description) lines.push(`${fm.description}\n`);
    lines.push(`- **Type**: ${fm.type}`);
    if (fm.applies_to) {
      const applies = Array.isArray(fm.applies_to) ? fm.applies_to.join(", ") : fm.applies_to;
      lines.push(`- **Applies To**: ${applies}`);
    }
    lines.push(``);
    if (skill.body) lines.push(skill.body);
    return lines.join("\n");
  }

  private transformWorkflow(wf: WorkflowDefinition): string {
    const fm = wf.frontmatter;
    const lines: string[] = [];
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
