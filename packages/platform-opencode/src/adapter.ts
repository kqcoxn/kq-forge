import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  PlatformAdapter,
  SyncContext,
  SyncResult,
  PlatformConfig,
} from "@kq-forge/core";

/**
 * OpenCode 平台适配器
 *
 * OpenCode 的配置结构：
 * - AGENTS.md — 入口文件（项目根）
 * - .opencode/ — 配置目录（可选）
 *   - agents.md — Agent 定义（可选，也可直接用 AGENTS.md）
 *
 * OpenCode 读取 AGENTS.md 作为主要的 agent 指令来源。
 * 适配策略：将 KQ-Forge 的 agents/skills/workflows 合并生成一个完整的 AGENTS.md。
 */
export class OpenCodeAdapter implements PlatformAdapter {
  readonly name = "opencode" as const;

  async sync(context: SyncContext): Promise<SyncResult> {
    const { projectRoot, config, agents, skills, workflows } = context;
    const result: SyncResult = { files: [], warnings: [] };

    // 生成 AGENTS.md（OpenCode 的主入口）
    const agentsMdContent = this.generateAgentsMd(context);
    const agentsMdPath = join(projectRoot, "AGENTS.md");

    await writeFile(agentsMdPath, agentsMdContent, "utf-8");
    result.files.push({
      path: "AGENTS.md",
      action: existsSync(agentsMdPath) ? "updated" : "created",
    });

    return result;
  }

  getDefaultConfig(): PlatformConfig {
    return {
      platform: "opencode",
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

    // Header
    sections.push(`# AGENTS.md\n`);
    sections.push(
      `> 本文件由 KQ-Forge 自动生成，请勿手动编辑。修改 .kqforge/config.yaml 后重新同步。\n`
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
    sections.push(`| 等级 | 模式 | 人类角色 | 适用场景 |`);
    sections.push(`|------|------|---------|---------|`);
    sections.push(
      `| **L0** | 全手动 | Agent 建议，人执行 | 高风险变更、架构决策 |`
    );
    sections.push(
      `| **L1** | 半自动 | Agent 执行，关键节点等人确认 | 常规功能开发 |`
    );
    sections.push(
      `| **L2** | 监督自动 | Agent 全自动，人异步 review | 批量任务、重构 |`
    );
    sections.push(
      `| **L3** | 全自动 | Agent 自主完成，仅失败时通知 | 机械性任务、格式化 |\n`
    );
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
    sections.push(`| Agent | 职责 | 默认等级 | 文件 |`);
    sections.push(`|-------|------|---------|------|`);
    for (const agent of agents) {
      const desc = agent.frontmatter.description || "";
      sections.push(
        `| **${agent.frontmatter.name}** | ${desc} | ${agent.frontmatter.autonomy} | [agents/${agent.frontmatter.name}.md](agents/${agent.frontmatter.name}.md) |`
      );
    }
    sections.push(``);

    // Skills 索引
    sections.push(`---\n`);
    sections.push(`## Skills\n`);
    sections.push(`| Skill | 类型 | 说明 |`);
    sections.push(`|-------|------|------|`);
    for (const skill of skills) {
      const desc = skill.frontmatter.description || "";
      sections.push(
        `| ${skill.frontmatter.name} | ${skill.frontmatter.type} | ${desc} |`
      );
    }
    sections.push(``);

    // Workflows 索引
    sections.push(`---\n`);
    sections.push(`## Workflows\n`);
    sections.push(`| Workflow | 说明 | 文件 |`);
    sections.push(`|----------|------|------|`);
    for (const wf of workflows) {
      const desc = wf.frontmatter.description || "";
      sections.push(
        `| **${wf.frontmatter.name}** | ${desc} | [workflows/${wf.frontmatter.name}.md](workflows/${wf.frontmatter.name}.md) |`
      );
    }
    sections.push(``);

    return sections.join("\n");
  }
}
