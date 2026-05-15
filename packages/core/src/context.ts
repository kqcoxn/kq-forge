import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, loadAgent, loadSkill, loadWorkflow } from "./config/loader.js";
import type {
  KqForgeConfig,
  AgentDefinition,
  SkillDefinition,
  WorkflowDefinition,
} from "./config/schema.js";
import type { SyncContext } from "./platform/adapter.js";

/** 默认模板（当 .kqforge/AGENTS.template.md 不存在时的回退） */
const DEFAULT_TEMPLATE = `# {{ENTRY_FILENAME}}

---

## Autonomy Level 约定

当前默认等级：**{{DEFAULT_AUTONOMY}}**

---

{{CUSTOM_RULES}}

## Agents

{{AGENTS_TABLE}}

---

## Skills

{{SKILLS_TABLE}}

---

## Workflows

{{WORKFLOWS_TABLE}}
`;

/**
 * 从 .kqforge/ 目录加载完整的项目上下文，供平台适配器使用。
 */
export async function loadProjectContext(
  projectRoot: string
): Promise<SyncContext> {
  const config = await loadConfig(projectRoot);
  const kqDir = join(projectRoot, ".kqforge");

  const agents = await loadAllAgents(join(kqDir, "agents"));
  const skills = await loadAllSkills(join(kqDir, "skills"));
  const workflows = await loadAllWorkflows(join(kqDir, "workflows"));

  // 读取模板文件
  const templatePath = join(kqDir, "AGENTS.template.md");
  let template = DEFAULT_TEMPLATE;
  if (existsSync(templatePath)) {
    template = await readFile(templatePath, "utf-8");
  }

  // 读取自定义规则文件
  const customRulesPath = join(kqDir, "custom-rules.md");
  let customRules = "";
  if (existsSync(customRulesPath)) {
    customRules = (await readFile(customRulesPath, "utf-8")).trim();
  }

  return {
    projectRoot,
    config,
    agents,
    skills,
    workflows,
    template,
    customRules,
    platformConfig: {
      platform: config.platforms[0] || "opencode",
      output: { directory: ".", agent_format: "single-file" },
      mapping: { skill_injection: "inline" },
      sync: { auto: true, watch: false, on_conflict: "overwrite" },
      platform_specific: {},
    },
  };
}

/**
 * 加载 .kqforge/agents/ 下所有 .md 文件
 */
async function loadAllAgents(dir: string): Promise<AgentDefinition[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const agents: AgentDefinition[] = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      try {
        const agent = await loadAgent(join(dir, entry.name));
        agents.push(agent);
      } catch {
        // 跳过无法解析的文件
      }
    }
  }

  return agents;
}

/**
 * 加载 .kqforge/skills/ 下所有 skill 目录（每个目录含 SKILL.md）
 */
async function loadAllSkills(dir: string): Promise<SkillDefinition[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const skills: SkillDefinition[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillFile = join(dir, entry.name, "SKILL.md");
      if (existsSync(skillFile)) {
        try {
          const skill = await loadSkill(skillFile);
          // 加载子文件
          const subDir = join(dir, entry.name);
          const subEntries = await readdir(subDir, { withFileTypes: true });
          const subFiles: { name: string; content: string }[] = [];
          for (const sub of subEntries) {
            if (
              sub.isFile() &&
              sub.name.endsWith(".md") &&
              sub.name !== "SKILL.md"
            ) {
              const { readFile } = await import("node:fs/promises");
              const content = await readFile(join(subDir, sub.name), "utf-8");
              subFiles.push({ name: sub.name, content });
            }
          }
          if (subFiles.length > 0) {
            skill.subFiles = subFiles;
          }
          skills.push(skill);
        } catch {
          // 跳过无法解析的文件
        }
      }
    }
  }

  return skills;
}

/**
 * 加载 .kqforge/workflows/ 下所有 .md 文件
 */
async function loadAllWorkflows(dir: string): Promise<WorkflowDefinition[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const workflows: WorkflowDefinition[] = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      try {
        const wf = await loadWorkflow(join(dir, entry.name));
        workflows.push(wf);
      } catch {
        // 跳过无法解析的文件
      }
    }
  }

  return workflows;
}
