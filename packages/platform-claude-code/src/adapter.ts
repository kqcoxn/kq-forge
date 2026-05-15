import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
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
 * Claude Code 平台适配器
 *
 * 输出结构：
 * - CLAUDE.md — 协作规则 + constraint skills inline + agent/workflow 索引
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

    // 1. 生成 CLAUDE.md
    const claudeMdContent = this.generateClaudeMd(context);
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

    // 3. 生成 .claude/agents/*.md（lead 不生成为 subagent，规则在 CLAUDE.md 中）
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

      // 复制子文件
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

  /**
   * 转译 Agent 为 Claude Code subagent 格式
   */
  private transformAgent(agent: AgentDefinition): string {
    const fm = agent.frontmatter;
    const lines: string[] = [];

    // Claude Code subagent 只需要简单的 markdown
    lines.push(`# ${fm.name}\n`);

    if (fm.description) {
      lines.push(`${fm.description}\n`);
    }

    // 元信息
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

    // 原始 body 内容
    if (agent.body) {
      lines.push(`## 指令\n`);
      lines.push(agent.body);
    }

    return lines.join("\n");
  }

  /**
   * 转译 Skill 为 Claude Code 格式（保持原内容，去除不兼容字段）
   */
  private transformSkill(skill: SkillDefinition): string {
    const fm = skill.frontmatter;
    const lines: string[] = [];

    lines.push(`# ${fm.name}\n`);
    if (fm.description) {
      lines.push(`${fm.description}\n`);
    }
    lines.push(`- **Type**: ${fm.type}`);
    if (fm.applies_to) {
      const applies = Array.isArray(fm.applies_to)
        ? fm.applies_to.join(", ")
        : fm.applies_to;
      lines.push(`- **Applies To**: ${applies}`);
    }
    lines.push(``);

    if (skill.body) {
      lines.push(skill.body);
    }

    return lines.join("\n");
  }

  /**
   * 转译 Workflow
   */
  private transformWorkflow(wf: WorkflowDefinition): string {
    const fm = wf.frontmatter;
    const lines: string[] = [];

    lines.push(`# ${fm.name}\n`);
    if (fm.description) {
      lines.push(`${fm.description}\n`);
    }

    lines.push(`## 步骤\n`);
    for (let i = 0; i < fm.steps.length; i++) {
      const step = fm.steps[i];
      lines.push(`${i + 1}. **${step.agent}** → ${step.action} (${step.autonomy || "继承默认"})`);
      if (step.gate?.message) {
        lines.push(`   - Gate: ${step.gate.message}`);
      }
      if (step.on_fail !== "retry") {
        lines.push(`   - On Fail: ${step.on_fail}`);
      }
    }
    lines.push(``);

    if (wf.body) {
      lines.push(`---\n`);
      lines.push(wf.body);
    }

    return lines.join("\n");
  }

  /**
   * 生成 CLAUDE.md 入口文件
   */
  private generateClaudeMd(context: SyncContext): string {
    const { config, agents, skills, workflows } = context;
    const sections: string[] = [];

    sections.push(`# CLAUDE.md\n`);
    sections.push(
      `> 本文件由 KQ-Forge 自动生成，请勿手动编辑。修改 \`.kqforge/config.yaml\` 后运行 \`kq-forge sync\` 重新同步。\n`
    );

    // 项目协作规则（完整版，Claude Code 上下文窗口大）
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

    // Agents 索引
    sections.push(`---\n`);
    sections.push(`## Agents\n`);
    sections.push(`| Agent           | 职责                                                     | 默认等级 | 文件                                           |`);
    sections.push(`| --------------- | -------------------------------------------------------- | -------- | ---------------------------------------------- |`);
    for (const agent of agents) {
      const desc = agent.frontmatter.description || "";
      const file = agent.frontmatter.name === "lead"
        ? "(规则内嵌于本文件)"
        : `[.claude/agents/${agent.frontmatter.name}.md](.claude/agents/${agent.frontmatter.name}.md)`;
      sections.push(
        `| **${agent.frontmatter.name}** | ${desc} | ${agent.frontmatter.autonomy} | ${file} |`
      );
    }
    sections.push(``);

    // Skills 索引
    sections.push(`---\n`);
    sections.push(`## Skills\n`);

    const constraintSkills = skills.filter((s) => s.frontmatter.type === "constraint");
    const capabilitySkills = skills.filter((s) => s.frontmatter.type === "capability");

    if (constraintSkills.length > 0) {
      sections.push(`### 约束类 Skills（始终生效）\n`);
      sections.push(`| Skill              | 说明                  | 路径                                                             |`);
      sections.push(`| ------------------ | --------------------- | ---------------------------------------------------------------- |`);
      for (const skill of constraintSkills) {
        const desc = skill.frontmatter.description || "";
        sections.push(
          `| ${skill.frontmatter.name} | ${desc} | [.claude/skills/${skill.frontmatter.name}/](.claude/skills/${skill.frontmatter.name}/SKILL.md) |`
        );
      }
      sections.push(``);
    }

    if (capabilitySkills.length > 0) {
      sections.push(`### 能力类 Skills（按需加载）\n`);
      sections.push(`| Skill     | 说明                     | 路径                                           |`);
      sections.push(`| --------- | ------------------------ | ---------------------------------------------- |`);
      for (const skill of capabilitySkills) {
        const desc = skill.frontmatter.description || "";
        sections.push(
          `| ${skill.frontmatter.name} | ${desc} | [.claude/skills/${skill.frontmatter.name}/](.claude/skills/${skill.frontmatter.name}/SKILL.md) |`
        );
      }
      sections.push(``);
    }

    // Workflows 索引
    sections.push(`---\n`);
    sections.push(`## Workflows\n`);
    sections.push(`| Workflow      | 说明                                            | 文件                                             |`);
    sections.push(`| ------------- | ----------------------------------------------- | ------------------------------------------------ |`);
    for (const wf of workflows) {
      const desc = wf.frontmatter.description || "";
      sections.push(
        `| **${wf.frontmatter.name}** | ${desc} | [.claude/workflows/${wf.frontmatter.name}.md](.claude/workflows/${wf.frontmatter.name}.md) |`
      );
    }
    sections.push(``);

    return sections.join("\n");
  }
}
