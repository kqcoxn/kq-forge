import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  PlatformAdapter,
  SyncContext,
  SyncResult,
  PlatformConfig,
} from "@kq-forge/core";

/**
 * Codex CLI 平台适配器
 *
 * Codex CLI 的配置结构：
 * - AGENTS.md — 入口文件（项目根），Codex 直接读取
 *
 * Codex 读取项目根的 AGENTS.md 作为指令来源。
 * 适配策略：生成一个精简的 AGENTS.md，包含核心规则和 agent 引用。
 */
export class CodexAdapter implements PlatformAdapter {
  readonly name = "codex" as const;

  async sync(context: SyncContext): Promise<SyncResult> {
    const { projectRoot, config, agents, skills, workflows } = context;
    const result: SyncResult = { files: [], warnings: [] };

    // Codex 直接使用 AGENTS.md
    const content = this.generateAgentsMd(context);
    const filePath = join(projectRoot, "AGENTS.md");

    await writeFile(filePath, content, "utf-8");
    result.files.push({
      path: "AGENTS.md",
      action: existsSync(filePath) ? "updated" : "created",
    });

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
        skill_injection: "reference",
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

    // Header
    sections.push(`# AGENTS.md\n`);
    sections.push(
      `> 本文件由 KQ-Forge 自动生成，请勿手动编辑。\n`
    );

    // 项目协作规则（精简版，Codex 上下文窗口较小）
    sections.push(`---\n`);
    sections.push(`## 项目协作规则\n`);
    sections.push(
      `1. **以人为本** — 人类是最终决策者。不确定时请求澄清。`
    );
    sections.push(
      `2. **因地制宜** — 不同任务使用不同的 autonomy level。`
    );
    sections.push(
      `3. **实事求是** — 犯错不可怕，隐瞒错误不可接受。\n`
    );

    sections.push(`默认 Autonomy: **${config.defaults.autonomy}**`);
    sections.push(`默认 Workflow: **${config.defaults.workflow}**`);
    sections.push(`Quality Model: **${config.quality.model}**\n`);

    // 自定义规则
    sections.push(`---\n`);
    sections.push(`## 自定义规则\n`);
    sections.push(`全程使用中文。\n`);

    // Agents 引用
    sections.push(`---\n`);
    sections.push(`## Agents\n`);
    for (const agent of agents) {
      const desc = agent.frontmatter.description || "";
      sections.push(
        `- **${agent.frontmatter.name}** (${agent.frontmatter.autonomy}): ${desc} → [agents/${agent.frontmatter.name}.md](agents/${agent.frontmatter.name}.md)`
      );
    }
    sections.push(``);

    // Skills 引用
    sections.push(`## Skills\n`);
    for (const skill of skills) {
      const desc = skill.frontmatter.description || "";
      sections.push(
        `- **${skill.frontmatter.name}** [${skill.frontmatter.type}]: ${desc}`
      );
    }
    sections.push(``);

    // Workflows 引用
    sections.push(`## Workflows\n`);
    for (const wf of workflows) {
      const desc = wf.frontmatter.description || "";
      sections.push(
        `- **${wf.frontmatter.name}**: ${desc} → [workflows/${wf.frontmatter.name}.md](workflows/${wf.frontmatter.name}.md)`
      );
    }
    sections.push(``);

    return sections.join("\n");
  }
}
