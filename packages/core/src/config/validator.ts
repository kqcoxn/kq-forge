import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ZodError } from "zod";
import {
  loadConfig,
  loadAgent,
  loadSkill,
  loadWorkflow,
} from "./loader.js";
import type {
  KqForgeConfig,
  AgentDefinition,
  SkillDefinition,
  WorkflowDefinition,
} from "./schema.js";

export interface ValidationIssue {
  level: "error" | "warning";
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  config?: KqForgeConfig;
  agents: AgentDefinition[];
  skills: SkillDefinition[];
  workflows: WorkflowDefinition[];
}

/**
 * 完整校验项目配置
 */
export async function validateProject(
  projectRoot: string
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  let config: KqForgeConfig | undefined;
  const agents: AgentDefinition[] = [];
  const skills: SkillDefinition[] = [];
  const workflows: WorkflowDefinition[] = [];

  // 1. 校验主配置
  try {
    config = await loadConfig(projectRoot);
  } catch (e) {
    if (e instanceof ZodError) {
      for (const issue of e.issues) {
        issues.push({
          level: "error",
          path: `.kqforge/config.yaml:${issue.path.join(".")}`,
          message: issue.message,
        });
      }
    } else {
      issues.push({
        level: "error",
        path: ".kqforge/config.yaml",
        message: (e as Error).message,
      });
    }
  }

  // 2. 校验 Agents
  const agentsDir = join(projectRoot, "agents");
  if (existsSync(agentsDir)) {
    const files = await readdir(agentsDir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const filePath = join(agentsDir, file);
      try {
        const agent = await loadAgent(filePath);
        agents.push(agent);
      } catch (e) {
        if (e instanceof ZodError) {
          for (const issue of e.issues) {
            issues.push({
              level: "error",
              path: `agents/${file}:${issue.path.join(".")}`,
              message: issue.message,
            });
          }
        } else {
          issues.push({
            level: "error",
            path: `agents/${file}`,
            message: (e as Error).message,
          });
        }
      }
    }
  }

  // 3. 校验 Skills
  const skillsDir = join(projectRoot, "skills");
  if (existsSync(skillsDir)) {
    const dirs = await readdir(skillsDir, { withFileTypes: true });
    for (const entry of dirs) {
      if (!entry.isDirectory()) continue;
      const skillFile = join(skillsDir, entry.name, "SKILL.md");
      if (!existsSync(skillFile)) {
        issues.push({
          level: "warning",
          path: `skills/${entry.name}/`,
          message: "缺少 SKILL.md 入口文件",
        });
        continue;
      }
      try {
        const skill = await loadSkill(skillFile);
        skills.push(skill);
      } catch (e) {
        if (e instanceof ZodError) {
          for (const issue of e.issues) {
            issues.push({
              level: "error",
              path: `skills/${entry.name}/SKILL.md:${issue.path.join(".")}`,
              message: issue.message,
            });
          }
        } else {
          issues.push({
            level: "error",
            path: `skills/${entry.name}/SKILL.md`,
            message: (e as Error).message,
          });
        }
      }
    }
  }

  // 4. 校验 Workflows
  const workflowsDir = join(projectRoot, "workflows");
  if (existsSync(workflowsDir)) {
    const files = await readdir(workflowsDir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const filePath = join(workflowsDir, file);
      try {
        const workflow = await loadWorkflow(filePath);
        workflows.push(workflow);
      } catch (e) {
        if (e instanceof ZodError) {
          for (const issue of e.issues) {
            issues.push({
              level: "error",
              path: `workflows/${file}:${issue.path.join(".")}`,
              message: issue.message,
            });
          }
        } else {
          issues.push({
            level: "error",
            path: `workflows/${file}`,
            message: (e as Error).message,
          });
        }
      }
    }
  }

  // 5. 交叉引用检查
  if (config) {
    const skillNames = new Set(skills.map((s) => s.frontmatter.name));
    const agentNames = new Set(agents.map((a) => a.frontmatter.name));
    const workflowNames = new Set(workflows.map((w) => w.frontmatter.name));

    // Agent 引用的 skills 是否存在
    for (const agent of agents) {
      for (const skill of agent.frontmatter.required_skills) {
        if (!skillNames.has(skill)) {
          issues.push({
            level: "warning",
            path: `agents/${agent.frontmatter.name}`,
            message: `引用的 required_skill "${skill}" 未找到对应的 skill 定义`,
          });
        }
      }
      for (const skill of agent.frontmatter.optional_skills) {
        if (!skillNames.has(skill)) {
          issues.push({
            level: "warning",
            path: `agents/${agent.frontmatter.name}`,
            message: `引用的 optional_skill "${skill}" 未找到对应的 skill 定义`,
          });
        }
      }
    }

    // Workflow 引用的 agents 是否存在
    for (const workflow of workflows) {
      for (const step of workflow.frontmatter.steps) {
        if (!agentNames.has(step.agent)) {
          issues.push({
            level: "warning",
            path: `workflows/${workflow.frontmatter.name}`,
            message: `步骤引用的 agent "${step.agent}" 未找到对应的 agent 定义`,
          });
        }
      }
    }

    // disabled 中的项是否存在
    for (const name of config.disabled.agents) {
      if (!agentNames.has(name)) {
        issues.push({
          level: "warning",
          path: ".kqforge/config.yaml:disabled.agents",
          message: `禁用的 agent "${name}" 不存在`,
        });
      }
    }
    for (const name of config.disabled.skills) {
      if (!skillNames.has(name)) {
        issues.push({
          level: "warning",
          path: ".kqforge/config.yaml:disabled.skills",
          message: `禁用的 skill "${name}" 不存在`,
        });
      }
    }
    for (const name of config.disabled.workflows) {
      if (!workflowNames.has(name)) {
        issues.push({
          level: "warning",
          path: ".kqforge/config.yaml:disabled.workflows",
          message: `禁用的 workflow "${name}" 不存在`,
        });
      }
    }
  }

  return {
    valid: issues.filter((i) => i.level === "error").length === 0,
    issues,
    config,
    agents,
    skills,
    workflows,
  };
}
