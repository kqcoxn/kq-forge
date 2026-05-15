#!/usr/bin/env node

// src/index.ts
import { defineCommand as defineCommand8, runMain } from "citty";

// src/commands/init.ts
import { defineCommand } from "citty";
import { consola } from "consola";
import { resolve as resolve2, basename } from "path";

// ../core/dist/index.js
import { z } from "zod";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import matter from "gray-matter";
import { readdir } from "fs/promises";
import { existsSync as existsSync2 } from "fs";
import { join as join2 } from "path";
import { ZodError } from "zod";
import { mkdir, writeFile, cp } from "fs/promises";
import { existsSync as existsSync3 } from "fs";
import { join as join3, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { stringify as stringifyYaml } from "yaml";
import { readFile as readFile2, writeFile as writeFile2, mkdir as mkdir2 } from "fs/promises";
import { existsSync as existsSync4 } from "fs";
import { join as join4 } from "path";
import { parse as parseYaml2, stringify as stringifyYaml2 } from "yaml";
import { cp as cp2, mkdir as mkdir3 } from "fs/promises";
import { existsSync as existsSync5 } from "fs";
import { join as join5 } from "path";
import { readdir as readdir2, readFile as readFile3 } from "fs/promises";
import { existsSync as existsSync6 } from "fs";
import { join as join6 } from "path";
var AutonomyLevel = z.enum(["L0", "L1", "L2", "L3"]);
var PlatformName = z.enum(["claude-code", "opencode", "codex"]);
var QualityModel = z.enum(["triangle", "linear", "none"]);
var ProjectSchema = z.object({
  name: z.string(),
  description: z.string().optional()
});
var DefaultsSchema = z.object({
  autonomy: AutonomyLevel.default("L1"),
  workflow: z.string().default("feature"),
  round_cap: z.number().int().min(1).max(10).default(3),
  reflect_on_error: z.boolean().default(true),
  language: z.string().default("zh-CN")
});
var MemoryConfigSchema = z.object({
  auto_capture: z.boolean().default(true),
  max_entries_per_file: z.number().int().min(10).max(200).default(50),
  categories: z.array(z.string()).default(["rules", "facts", "lessons"])
});
var QualityConfigSchema = z.object({
  model: QualityModel.default("triangle"),
  acceptance_criteria: z.boolean().default(true),
  round_cap: z.number().int().min(1).max(10).optional()
});
var DisabledSchema = z.object({
  agents: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  workflows: z.array(z.string()).default([])
});
var OverrideSchema = z.object({
  match: z.string().optional(),
  task: z.string().optional(),
  autonomy: AutonomyLevel.optional(),
  workflow: z.string().optional(),
  round_cap: z.number().int().min(1).max(10).optional(),
  quality: QualityModel.optional()
});
var KqForgeConfigSchema = z.object({
  version: z.literal(1),
  project: ProjectSchema,
  defaults: DefaultsSchema.default({}),
  platforms: z.array(PlatformName).default([]),
  memory: MemoryConfigSchema.default({}),
  quality: QualityConfigSchema.default({}),
  disabled: DisabledSchema.default({}),
  overrides: z.array(OverrideSchema).default([])
});
var AgentFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  description: z.string().optional(),
  scope: z.union([z.string(), z.array(z.string())]),
  autonomy: AutonomyLevel.default("L1"),
  required_skills: z.array(z.string()),
  optional_skills: z.array(z.string()).default([]),
  delegates_to: z.array(z.string()).default([]),
  triggers: z.array(
    z.object({
      event: z.string(),
      condition: z.string().optional()
    })
  ).default([])
});
var SkillFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  description: z.string().optional(),
  type: z.enum(["constraint", "capability"]),
  applies_to: z.union([z.string(), z.array(z.string())]).optional(),
  priority: z.number().int().min(0).max(100).default(50),
  depends_on: z.array(z.string()).default([])
});
var WorkflowStepSchema = z.object({
  agent: z.string(),
  action: z.string(),
  autonomy: AutonomyLevel.optional(),
  round_cap: z.number().int().min(1).max(10).optional(),
  gate: z.object({
    enabled: z.boolean().default(true),
    min_autonomy: AutonomyLevel.default("L1"),
    message: z.string().optional()
  }).optional(),
  on_fail: z.enum(["retry", "skip", "abort", "escalate"]).default("retry"),
  task_tag: z.string().optional(),
  condition: z.string().optional()
});
var WorkflowFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  description: z.string().optional(),
  triggers: z.array(z.string()).default([]),
  steps: z.array(WorkflowStepSchema).min(1),
  on_complete: z.enum(["reflect", "summarize", "none"]).default("reflect"),
  loop: z.object({
    enabled: z.boolean().default(false),
    max_iterations: z.number().int().min(1).default(5),
    until: z.string().optional()
  }).optional()
});
var PlatformOutputSchema = z.object({
  directory: z.string(),
  entry_file: z.string().optional(),
  agent_format: z.enum(["single-file", "directory"]).default("single-file")
});
var PlatformMappingSchema = z.object({
  autonomy_to_mode: z.record(z.string()).optional(),
  skill_injection: z.enum(["inline", "reference", "append"]).default("inline")
});
var PlatformSyncSchema = z.object({
  auto: z.boolean().default(true),
  watch: z.boolean().default(false),
  on_conflict: z.enum(["overwrite", "merge", "ask"]).default("overwrite")
});
var PlatformConfigSchema = z.object({
  platform: PlatformName,
  output: PlatformOutputSchema,
  mapping: PlatformMappingSchema.default({}),
  sync: PlatformSyncSchema.default({}),
  platform_specific: z.record(z.unknown()).default({})
});
async function loadConfig(projectRoot) {
  const configPath = join(projectRoot, ".kqforge", "config.yaml");
  if (!existsSync(configPath)) {
    throw new Error(`\u914D\u7F6E\u6587\u4EF6\u4E0D\u5B58\u5728: ${configPath}`);
  }
  const raw = await readFile(configPath, "utf-8");
  const parsed = parseYaml(raw);
  return KqForgeConfigSchema.parse(parsed);
}
async function loadAgent(filePath) {
  const raw = await readFile(filePath, "utf-8");
  const { data, content } = matter(raw);
  const frontmatter = AgentFrontmatterSchema.parse(data);
  return { frontmatter, body: content.trim(), filePath };
}
async function loadSkill(filePath) {
  const raw = await readFile(filePath, "utf-8");
  const { data, content } = matter(raw);
  const frontmatter = SkillFrontmatterSchema.parse(data);
  return { frontmatter, body: content.trim(), filePath };
}
async function loadWorkflow(filePath) {
  const raw = await readFile(filePath, "utf-8");
  const { data, content } = matter(raw);
  const frontmatter = WorkflowFrontmatterSchema.parse(data);
  return { frontmatter, body: content.trim(), filePath };
}
function isInitialized(projectRoot) {
  return existsSync(join(projectRoot, ".kqforge", "config.yaml"));
}
async function validateProject(projectRoot) {
  const issues = [];
  let config;
  const agents = [];
  const skills = [];
  const workflows = [];
  try {
    config = await loadConfig(projectRoot);
  } catch (e) {
    if (e instanceof ZodError) {
      for (const issue of e.issues) {
        issues.push({
          level: "error",
          path: `.kqforge/config.yaml:${issue.path.join(".")}`,
          message: issue.message
        });
      }
    } else {
      issues.push({
        level: "error",
        path: ".kqforge/config.yaml",
        message: e.message
      });
    }
  }
  const agentsDir = join2(projectRoot, ".kqforge", "agents");
  if (existsSync2(agentsDir)) {
    const files = await readdir(agentsDir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const filePath = join2(agentsDir, file);
      try {
        const agent = await loadAgent(filePath);
        agents.push(agent);
      } catch (e) {
        if (e instanceof ZodError) {
          for (const issue of e.issues) {
            issues.push({
              level: "error",
              path: `agents/${file}:${issue.path.join(".")}`,
              message: issue.message
            });
          }
        } else {
          issues.push({
            level: "error",
            path: `agents/${file}`,
            message: e.message
          });
        }
      }
    }
  }
  const skillsDir = join2(projectRoot, ".kqforge", "skills");
  if (existsSync2(skillsDir)) {
    const dirs = await readdir(skillsDir, { withFileTypes: true });
    for (const entry of dirs) {
      if (!entry.isDirectory()) continue;
      const skillFile = join2(skillsDir, entry.name, "SKILL.md");
      if (!existsSync2(skillFile)) {
        issues.push({
          level: "warning",
          path: `skills/${entry.name}/`,
          message: "\u7F3A\u5C11 SKILL.md \u5165\u53E3\u6587\u4EF6"
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
              message: issue.message
            });
          }
        } else {
          issues.push({
            level: "error",
            path: `skills/${entry.name}/SKILL.md`,
            message: e.message
          });
        }
      }
    }
  }
  const workflowsDir = join2(projectRoot, ".kqforge", "workflows");
  if (existsSync2(workflowsDir)) {
    const files = await readdir(workflowsDir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const filePath = join2(workflowsDir, file);
      try {
        const workflow = await loadWorkflow(filePath);
        workflows.push(workflow);
      } catch (e) {
        if (e instanceof ZodError) {
          for (const issue of e.issues) {
            issues.push({
              level: "error",
              path: `workflows/${file}:${issue.path.join(".")}`,
              message: issue.message
            });
          }
        } else {
          issues.push({
            level: "error",
            path: `workflows/${file}`,
            message: e.message
          });
        }
      }
    }
  }
  if (config) {
    const skillNames = new Set(skills.map((s) => s.frontmatter.name));
    const agentNames = new Set(agents.map((a) => a.frontmatter.name));
    const workflowNames = new Set(workflows.map((w) => w.frontmatter.name));
    for (const agent of agents) {
      for (const skill of agent.frontmatter.required_skills) {
        if (!skillNames.has(skill)) {
          issues.push({
            level: "warning",
            path: `agents/${agent.frontmatter.name}`,
            message: `\u5F15\u7528\u7684 required_skill "${skill}" \u672A\u627E\u5230\u5BF9\u5E94\u7684 skill \u5B9A\u4E49`
          });
        }
      }
      for (const skill of agent.frontmatter.optional_skills) {
        if (!skillNames.has(skill)) {
          issues.push({
            level: "warning",
            path: `agents/${agent.frontmatter.name}`,
            message: `\u5F15\u7528\u7684 optional_skill "${skill}" \u672A\u627E\u5230\u5BF9\u5E94\u7684 skill \u5B9A\u4E49`
          });
        }
      }
    }
    for (const workflow of workflows) {
      for (const step of workflow.frontmatter.steps) {
        if (!agentNames.has(step.agent)) {
          issues.push({
            level: "warning",
            path: `workflows/${workflow.frontmatter.name}`,
            message: `\u6B65\u9AA4\u5F15\u7528\u7684 agent "${step.agent}" \u672A\u627E\u5230\u5BF9\u5E94\u7684 agent \u5B9A\u4E49`
          });
        }
      }
    }
    for (const name of config.disabled.agents) {
      if (!agentNames.has(name)) {
        issues.push({
          level: "warning",
          path: ".kqforge/config.yaml:disabled.agents",
          message: `\u7981\u7528\u7684 agent "${name}" \u4E0D\u5B58\u5728`
        });
      }
    }
    for (const name of config.disabled.skills) {
      if (!skillNames.has(name)) {
        issues.push({
          level: "warning",
          path: ".kqforge/config.yaml:disabled.skills",
          message: `\u7981\u7528\u7684 skill "${name}" \u4E0D\u5B58\u5728`
        });
      }
    }
    for (const name of config.disabled.workflows) {
      if (!workflowNames.has(name)) {
        issues.push({
          level: "warning",
          path: ".kqforge/config.yaml:disabled.workflows",
          message: `\u7981\u7528\u7684 workflow "${name}" \u4E0D\u5B58\u5728`
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
    workflows
  };
}
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
function getTemplateRoot() {
  if (process.env.KQ_FORGE_TEMPLATE_ROOT) {
    return process.env.KQ_FORGE_TEMPLATE_ROOT;
  }
  let current = __dirname;
  for (let i = 0; i < 10; i++) {
    if (existsSync3(join3(current, "agents")) && existsSync3(join3(current, "skills"))) {
      return current;
    }
    const parent = resolve(current, "..");
    if (parent === current) break;
    current = parent;
  }
  return resolve(__dirname, "..", "..", "..", "..");
}
var KQFORGE_GITIGNORE = `# Template content (pulled by init, do not commit)
agents/
skills/
workflows/
AGENTS.template.md
`;
async function initProject(options) {
  const { targetDir, projectName, platforms, force = false } = options;
  const result = { files: [], warnings: [] };
  const templateRoot = getTemplateRoot();
  const configDir = join3(targetDir, ".kqforge");
  const alreadyExists = existsSync3(configDir);
  if (alreadyExists && !force) {
    result.warnings.push(
      ".kqforge/ \u5DF2\u5B58\u5728\uFF0C\u8FDB\u5165\u67E5\u7F3A\u8865\u6F0F\u6A21\u5F0F\uFF08\u6A21\u677F\u5185\u5BB9\u5C06\u5237\u65B0\uFF0C\u5BA2\u5236\u5316\u6587\u4EF6\u4E0D\u8986\u76D6\uFF09"
    );
  }
  await mkdir(join3(configDir, "memory"), { recursive: true });
  await mkdir(join3(configDir, "paradigms"), { recursive: true });
  await mkdir(join3(configDir, "platforms"), { recursive: true });
  await mkdir(join3(configDir, "agents"), { recursive: true });
  await mkdir(join3(configDir, "skills"), { recursive: true });
  await mkdir(join3(configDir, "workflows"), { recursive: true });
  await writeFile(join3(configDir, "memory", ".gitkeep"), "");
  await writeFile(join3(configDir, "paradigms", ".gitkeep"), "");
  const configPath = join3(configDir, "config.yaml");
  if (!existsSync3(configPath) || force) {
    const config = {
      version: 1,
      project: { name: projectName },
      defaults: {
        autonomy: "L1",
        workflow: "feature",
        round_cap: 3,
        reflect_on_error: true,
        language: "zh-CN"
      },
      platforms,
      memory: {
        auto_capture: true,
        max_entries_per_file: 50,
        categories: ["rules", "facts", "lessons"]
      },
      quality: {
        model: "triangle",
        acceptance_criteria: true
      },
      disabled: { agents: [], skills: [], workflows: [] },
      overrides: []
    };
    await writeFile(configPath, stringifyYaml(config), "utf-8");
    result.files.push({ path: ".kqforge/config.yaml", action: "created" });
  } else {
    result.files.push({ path: ".kqforge/config.yaml", action: "skipped" });
  }
  const agentsSrc = join3(templateRoot, "agents");
  const agentsDest = join3(configDir, "agents");
  if (existsSync3(agentsSrc)) {
    await cp(agentsSrc, agentsDest, { recursive: true, force: true });
    result.files.push({ path: ".kqforge/agents/", action: "created" });
  }
  const workflowsSrc = join3(templateRoot, "workflows");
  const workflowsDest = join3(configDir, "workflows");
  if (existsSync3(workflowsSrc)) {
    await cp(workflowsSrc, workflowsDest, { recursive: true, force: true });
    result.files.push({ path: ".kqforge/workflows/", action: "created" });
  }
  const coreSkills = [
    "design",
    "implement",
    "review",
    "debug",
    "reflect",
    "code-hygiene",
    "git-conventions",
    "security-check",
    "test-first",
    "verify-before-done"
  ];
  for (const skillName of coreSkills) {
    const src = join3(templateRoot, "skills", skillName);
    const dest = join3(configDir, "skills", skillName);
    if (existsSync3(src)) {
      await cp(src, dest, { recursive: true, force: true });
    }
  }
  result.files.push({ path: ".kqforge/skills/", action: "created" });
  const templateSrc = join3(templateRoot, "AGENTS.template.md");
  const templateDest = join3(configDir, "AGENTS.template.md");
  if (existsSync3(templateSrc)) {
    await cp(templateSrc, templateDest, { force: true });
    result.files.push({
      path: ".kqforge/AGENTS.template.md",
      action: "created"
    });
  }
  const customRulesDest = join3(configDir, "custom-rules.md");
  if (!existsSync3(customRulesDest) || force) {
    const defaultCustomRules = `## \u81EA\u5B9A\u4E49\u89C4\u5219

\u5168\u7A0B\u4F7F\u7528\u4E2D\u6587\u3002
`;
    await writeFile(customRulesDest, defaultCustomRules, "utf-8");
    result.files.push({ path: ".kqforge/custom-rules.md", action: "created" });
  } else {
    result.files.push({ path: ".kqforge/custom-rules.md", action: "skipped" });
  }
  const kqforgeGitignorePath = join3(configDir, ".gitignore");
  await writeFile(kqforgeGitignorePath, KQFORGE_GITIGNORE, "utf-8");
  return result;
}
async function addPlatform(options) {
  const { targetDir, platform } = options;
  const configPath = join4(targetDir, ".kqforge", "config.yaml");
  if (!existsSync4(configPath)) {
    return {
      success: false,
      message: "\u9879\u76EE\u672A\u521D\u59CB\u5316\u3002\u8BF7\u5148\u8FD0\u884C kq-forge init\u3002"
    };
  }
  const raw = await readFile2(configPath, "utf-8");
  const parsed = parseYaml2(raw);
  const config = KqForgeConfigSchema.parse(parsed);
  if (config.platforms.includes(platform)) {
    return {
      success: false,
      message: `\u5E73\u53F0 "${platform}" \u5DF2\u5B58\u5728\u4E8E\u914D\u7F6E\u4E2D\u3002`
    };
  }
  config.platforms.push(platform);
  await writeFile2(configPath, stringifyYaml2(config), "utf-8");
  const platformsDir = join4(targetDir, ".kqforge", "platforms");
  await mkdir2(platformsDir, { recursive: true });
  return {
    success: true,
    message: `\u5E73\u53F0 "${platform}" \u5DF2\u6DFB\u52A0\u3002`
  };
}
var PACKAGES = [
  {
    name: "frontend",
    description: "\u524D\u7AEF\u5F00\u53D1\u573A\u666F\u5305\uFF08TypeScript\u3001React\u3001CSS\u3001\u65E0\u969C\u788D\uFF09",
    skills: ["typescript", "frontend-ui"],
    workflows: []
  },
  {
    name: "api",
    description: "API \u5F00\u53D1\u573A\u666F\u5305\uFF08API \u8BBE\u8BA1\u3001\u6570\u636E\u5E93\u3001\u5B89\u5168\uFF09",
    skills: ["api", "database", "security-advanced"],
    workflows: []
  }
];
function getPackage(name) {
  return PACKAGES.find((p) => p.name === name);
}
function listPackages() {
  return PACKAGES;
}
async function addPackage(options) {
  const { targetDir, packageName } = options;
  const templateRoot = getTemplateRoot();
  if (!existsSync5(join5(targetDir, ".kqforge", "config.yaml"))) {
    return {
      success: false,
      message: "\u9879\u76EE\u672A\u521D\u59CB\u5316\u3002\u8BF7\u5148\u8FD0\u884C kq-forge init\u3002",
      addedSkills: [],
      addedWorkflows: [],
      skipped: []
    };
  }
  const pkg = getPackage(packageName);
  if (!pkg) {
    return {
      success: false,
      message: `\u672A\u627E\u5230\u573A\u666F\u5305 "${packageName}"\u3002\u4F7F\u7528 kq-forge list-packages \u67E5\u770B\u53EF\u7528\u5305\u3002`,
      addedSkills: [],
      addedWorkflows: [],
      skipped: []
    };
  }
  const addedSkills = [];
  const addedWorkflows = [];
  const skipped = [];
  const skillsDir = join5(targetDir, ".kqforge", "skills");
  await mkdir3(skillsDir, { recursive: true });
  for (const skillName of pkg.skills) {
    const src = join5(templateRoot, "skills", skillName);
    const dest = join5(skillsDir, skillName);
    if (!existsSync5(src)) {
      skipped.push(`skills/${skillName}\uFF08\u6A21\u677F\u4E0D\u5B58\u5728\uFF09`);
      continue;
    }
    if (existsSync5(dest)) {
      skipped.push(`skills/${skillName}\uFF08\u5DF2\u5B58\u5728\uFF09`);
      continue;
    }
    await cp2(src, dest, { recursive: true });
    addedSkills.push(skillName);
  }
  if (pkg.workflows.length > 0) {
    const workflowsDir = join5(targetDir, ".kqforge", "workflows");
    await mkdir3(workflowsDir, { recursive: true });
    for (const wfName of pkg.workflows) {
      const src = join5(templateRoot, "workflows", `${wfName}.md`);
      const dest = join5(workflowsDir, `${wfName}.md`);
      if (!existsSync5(src)) {
        skipped.push(`workflows/${wfName}\uFF08\u6A21\u677F\u4E0D\u5B58\u5728\uFF09`);
        continue;
      }
      if (existsSync5(dest)) {
        skipped.push(`workflows/${wfName}\uFF08\u5DF2\u5B58\u5728\uFF09`);
        continue;
      }
      await cp2(src, dest);
      addedWorkflows.push(wfName);
    }
  }
  return {
    success: true,
    message: `\u573A\u666F\u5305 "${packageName}" \u5DF2\u6DFB\u52A0\u3002`,
    addedSkills,
    addedWorkflows,
    skipped
  };
}
var DEFAULT_TEMPLATE = `# {{ENTRY_FILENAME}}

---

## Autonomy Level \u7EA6\u5B9A

\u5F53\u524D\u9ED8\u8BA4\u7B49\u7EA7\uFF1A**{{DEFAULT_AUTONOMY}}**

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
async function loadProjectContext(projectRoot) {
  const config = await loadConfig(projectRoot);
  const kqDir = join6(projectRoot, ".kqforge");
  const agents = await loadAllAgents(join6(kqDir, "agents"));
  const skills = await loadAllSkills(join6(kqDir, "skills"));
  const workflows = await loadAllWorkflows(join6(kqDir, "workflows"));
  const templatePath = join6(kqDir, "AGENTS.template.md");
  let template = DEFAULT_TEMPLATE;
  if (existsSync6(templatePath)) {
    template = await readFile3(templatePath, "utf-8");
  }
  const customRulesPath = join6(kqDir, "custom-rules.md");
  let customRules = "";
  if (existsSync6(customRulesPath)) {
    customRules = (await readFile3(customRulesPath, "utf-8")).trim();
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
      platform_specific: {}
    }
  };
}
async function loadAllAgents(dir) {
  if (!existsSync6(dir)) return [];
  const entries = await readdir2(dir, { withFileTypes: true });
  const agents = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      try {
        const agent = await loadAgent(join6(dir, entry.name));
        agents.push(agent);
      } catch {
      }
    }
  }
  return agents;
}
async function loadAllSkills(dir) {
  if (!existsSync6(dir)) return [];
  const entries = await readdir2(dir, { withFileTypes: true });
  const skills = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillFile = join6(dir, entry.name, "SKILL.md");
      if (existsSync6(skillFile)) {
        try {
          const skill = await loadSkill(skillFile);
          const subDir = join6(dir, entry.name);
          const subEntries = await readdir2(subDir, { withFileTypes: true });
          const subFiles = [];
          for (const sub of subEntries) {
            if (sub.isFile() && sub.name.endsWith(".md") && sub.name !== "SKILL.md") {
              const { readFile: readFile4 } = await import("fs/promises");
              const content = await readFile4(join6(subDir, sub.name), "utf-8");
              subFiles.push({ name: sub.name, content });
            }
          }
          if (subFiles.length > 0) {
            skill.subFiles = subFiles;
          }
          skills.push(skill);
        } catch {
        }
      }
    }
  }
  return skills;
}
async function loadAllWorkflows(dir) {
  if (!existsSync6(dir)) return [];
  const entries = await readdir2(dir, { withFileTypes: true });
  const workflows = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      try {
        const wf = await loadWorkflow(join6(dir, entry.name));
        workflows.push(wf);
      } catch {
      }
    }
  }
  return workflows;
}
function renderTemplate(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

// ../platform-opencode/dist/index.js
import { writeFile as writeFile3, mkdir as mkdir4 } from "fs/promises";
import { join as join7 } from "path";
var OpenCodeAdapter = class {
  name = "opencode";
  async sync(context) {
    const { projectRoot, agents, skills, workflows } = context;
    const result = { files: [], warnings: [] };
    const opencodeDir = join7(projectRoot, ".opencode");
    await mkdir4(join7(opencodeDir, "agents"), { recursive: true });
    await mkdir4(join7(opencodeDir, "skills"), { recursive: true });
    await mkdir4(join7(opencodeDir, "workflows"), { recursive: true });
    const agentsMdContent = this.renderEntryFile(context);
    const agentsMdPath = join7(projectRoot, "AGENTS.md");
    await writeFile3(agentsMdPath, agentsMdContent, "utf-8");
    result.files.push({ path: "AGENTS.md", action: "created" });
    for (const agent of agents) {
      const content = this.transformAgent(agent);
      const filePath = join7(opencodeDir, "agents", `${agent.frontmatter.name}.md`);
      await writeFile3(filePath, content, "utf-8");
      result.files.push({
        path: `.opencode/agents/${agent.frontmatter.name}.md`,
        action: "created"
      });
    }
    for (const skill of skills) {
      const skillDir = join7(opencodeDir, "skills", skill.frontmatter.name);
      await mkdir4(skillDir, { recursive: true });
      const content = this.transformSkill(skill);
      await writeFile3(join7(skillDir, "SKILL.md"), content, "utf-8");
      result.files.push({
        path: `.opencode/skills/${skill.frontmatter.name}/SKILL.md`,
        action: "created"
      });
      if (skill.subFiles) {
        for (const sub of skill.subFiles) {
          await writeFile3(join7(skillDir, sub.name), sub.content, "utf-8");
        }
      }
    }
    for (const wf of workflows) {
      const content = this.transformWorkflow(wf);
      const filePath = join7(opencodeDir, "workflows", `${wf.frontmatter.name}.md`);
      await writeFile3(filePath, content, "utf-8");
      result.files.push({
        path: `.opencode/workflows/${wf.frontmatter.name}.md`,
        action: "created"
      });
    }
    return result;
  }
  getDefaultConfig() {
    return {
      platform: "opencode",
      output: {
        directory: ".opencode",
        entry_file: "AGENTS.md",
        agent_format: "single-file"
      },
      mapping: { skill_injection: "inline" },
      sync: { auto: true, watch: false, on_conflict: "overwrite" },
      platform_specific: {}
    };
  }
  /**
   * 渲染入口文件：读取模板，替换占位符
   */
  renderEntryFile(context) {
    const { config, agents, skills, workflows, template } = context;
    const vars = {
      ENTRY_FILENAME: "AGENTS.md",
      DEFAULT_AUTONOMY: config.defaults.autonomy,
      ROUND_CAP: String(config.defaults.round_cap),
      CUSTOM_RULES: context.customRules ? context.customRules + "\n\n---\n\n" : "",
      AGENTS_TABLE: this.buildAgentsTable(agents),
      SKILLS_TABLE: this.buildSkillsTable(skills),
      WORKFLOWS_TABLE: this.buildWorkflowsTable(workflows)
    };
    return renderTemplate(template, vars);
  }
  buildAgentsTable(agents) {
    if (agents.length === 0) return "\uFF08\u65E0\uFF09";
    const lines = [];
    lines.push(`| Agent | \u804C\u8D23 | \u9ED8\u8BA4\u7B49\u7EA7 | \u6587\u4EF6 |`);
    lines.push(`| ----- | ---- | -------- | ---- |`);
    for (const agent of agents) {
      const desc = agent.frontmatter.description || "";
      lines.push(
        `| **${agent.frontmatter.name}** | ${desc} | ${agent.frontmatter.autonomy} | [.opencode/agents/${agent.frontmatter.name}.md](.opencode/agents/${agent.frontmatter.name}.md) |`
      );
    }
    return lines.join("\n");
  }
  buildSkillsTable(skills) {
    if (skills.length === 0) return "\uFF08\u65E0\uFF09";
    const lines = [];
    const capabilitySkills = skills.filter((s) => s.frontmatter.type === "capability");
    const constraintSkills = skills.filter((s) => s.frontmatter.type === "constraint");
    if (capabilitySkills.length > 0) {
      lines.push(`### \u80FD\u529B\u7C7B Skills
`);
      lines.push(`| Skill | \u8BF4\u660E | \u8DEF\u5F84 |`);
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
      lines.push(`### \u7EA6\u675F\u7C7B Skills
`);
      lines.push(`| Skill | \u8BF4\u660E | \u8DEF\u5F84 |`);
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
  buildWorkflowsTable(workflows) {
    if (workflows.length === 0) return "\uFF08\u65E0\uFF09";
    const lines = [];
    lines.push(`| Workflow | \u8BF4\u660E | \u6587\u4EF6 |`);
    lines.push(`| -------- | ---- | ---- |`);
    for (const wf of workflows) {
      const desc = wf.frontmatter.description || "";
      lines.push(
        `| **${wf.frontmatter.name}** | ${desc} | [.opencode/workflows/${wf.frontmatter.name}.md](.opencode/workflows/${wf.frontmatter.name}.md) |`
      );
    }
    return lines.join("\n");
  }
  transformAgent(agent) {
    const fm = agent.frontmatter;
    const lines = [];
    lines.push(`---`);
    lines.push(`name: ${fm.name}`);
    if (fm.description) lines.push(`description: ${fm.description}`);
    lines.push(`---`);
    lines.push(``);
    lines.push(`# ${fm.name}
`);
    if (fm.scope) {
      const scope = Array.isArray(fm.scope) ? fm.scope.join(", ") : fm.scope;
      lines.push(`**Scope**: ${scope}
`);
    }
    lines.push(`**Autonomy**: ${fm.autonomy}
`);
    if (fm.required_skills.length > 0) {
      lines.push(`**Required Skills**: ${fm.required_skills.join(", ")}
`);
    }
    if (fm.optional_skills.length > 0) {
      lines.push(`**Optional Skills**: ${fm.optional_skills.join(", ")}
`);
    }
    if (fm.delegates_to.length > 0) {
      lines.push(`**Delegates To**: ${fm.delegates_to.join(", ")}
`);
    }
    if (agent.body) {
      lines.push(`---
`);
      lines.push(agent.body);
    }
    return lines.join("\n");
  }
  transformSkill(skill) {
    const fm = skill.frontmatter;
    const lines = [];
    lines.push(`---`);
    lines.push(`name: ${fm.name}`);
    if (fm.description) lines.push(`description: ${fm.description}`);
    lines.push(`---`);
    lines.push(``);
    if (skill.body) lines.push(skill.body);
    return lines.join("\n");
  }
  transformWorkflow(wf) {
    const fm = wf.frontmatter;
    const lines = [];
    lines.push(`---`);
    lines.push(`name: ${fm.name}`);
    if (fm.description) lines.push(`description: ${fm.description}`);
    lines.push(`---`);
    lines.push(``);
    lines.push(`# ${fm.name}
`);
    if (fm.description) lines.push(`${fm.description}
`);
    lines.push(`## \u6B65\u9AA4
`);
    for (let i = 0; i < fm.steps.length; i++) {
      const step = fm.steps[i];
      lines.push(`${i + 1}. **${step.agent}** \u2192 ${step.action} (${step.autonomy || "\u7EE7\u627F\u9ED8\u8BA4"})`);
      if (step.gate?.message) lines.push(`   - Gate: ${step.gate.message}`);
      if (step.on_fail !== "retry") lines.push(`   - On Fail: ${step.on_fail}`);
    }
    lines.push(``);
    if (wf.body) {
      lines.push(`---
`);
      lines.push(wf.body);
    }
    return lines.join("\n");
  }
};

// ../platform-claude-code/dist/index.js
import { writeFile as writeFile4, mkdir as mkdir5 } from "fs/promises";
import { join as join8 } from "path";
var ClaudeCodeAdapter = class {
  name = "claude-code";
  async sync(context) {
    const { projectRoot, agents, skills, workflows } = context;
    const result = { files: [], warnings: [] };
    const claudeDir = join8(projectRoot, ".claude");
    await mkdir5(join8(claudeDir, "agents"), { recursive: true });
    await mkdir5(join8(claudeDir, "skills"), { recursive: true });
    await mkdir5(join8(claudeDir, "workflows"), { recursive: true });
    const claudeMdContent = this.renderEntryFile(context);
    const claudeMdPath = join8(projectRoot, "CLAUDE.md");
    await writeFile4(claudeMdPath, claudeMdContent, "utf-8");
    result.files.push({ path: "CLAUDE.md", action: "created" });
    const settingsPath = join8(claudeDir, "settings.json");
    const settings = {
      permissions: {
        allow: [
          "Read",
          "Edit",
          "Write",
          "Bash(git *)",
          "Bash(pnpm *)",
          "Bash(npm *)"
        ],
        deny: [
          "Bash(rm -rf /)",
          "Bash(git push --force)"
        ]
      }
    };
    await writeFile4(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
    result.files.push({ path: ".claude/settings.json", action: "created" });
    for (const agent of agents) {
      if (agent.frontmatter.name === "lead") continue;
      const content = this.transformAgent(agent);
      const filePath = join8(claudeDir, "agents", `${agent.frontmatter.name}.md`);
      await writeFile4(filePath, content, "utf-8");
      result.files.push({
        path: `.claude/agents/${agent.frontmatter.name}.md`,
        action: "created"
      });
    }
    for (const skill of skills) {
      const skillDir = join8(claudeDir, "skills", skill.frontmatter.name);
      await mkdir5(skillDir, { recursive: true });
      const content = this.transformSkill(skill);
      await writeFile4(join8(skillDir, "SKILL.md"), content, "utf-8");
      result.files.push({
        path: `.claude/skills/${skill.frontmatter.name}/SKILL.md`,
        action: "created"
      });
      if (skill.subFiles) {
        for (const sub of skill.subFiles) {
          await writeFile4(join8(skillDir, sub.name), sub.content, "utf-8");
        }
      }
    }
    for (const wf of workflows) {
      const content = this.transformWorkflow(wf);
      const filePath = join8(claudeDir, "workflows", `${wf.frontmatter.name}.md`);
      await writeFile4(filePath, content, "utf-8");
      result.files.push({
        path: `.claude/workflows/${wf.frontmatter.name}.md`,
        action: "created"
      });
    }
    return result;
  }
  getDefaultConfig() {
    return {
      platform: "claude-code",
      output: {
        directory: ".claude",
        entry_file: "CLAUDE.md",
        agent_format: "single-file"
      },
      mapping: { skill_injection: "inline" },
      sync: { auto: true, watch: false, on_conflict: "overwrite" },
      platform_specific: {}
    };
  }
  renderEntryFile(context) {
    const { config, agents, skills, workflows, template } = context;
    const vars = {
      ENTRY_FILENAME: "CLAUDE.md",
      DEFAULT_AUTONOMY: config.defaults.autonomy,
      ROUND_CAP: String(config.defaults.round_cap),
      CUSTOM_RULES: context.customRules ? context.customRules + "\n\n---\n\n" : "",
      AGENTS_TABLE: this.buildAgentsTable(agents),
      SKILLS_TABLE: this.buildSkillsTable(skills),
      WORKFLOWS_TABLE: this.buildWorkflowsTable(workflows)
    };
    return renderTemplate(template, vars);
  }
  buildAgentsTable(agents) {
    if (agents.length === 0) return "\uFF08\u65E0\uFF09";
    const lines = [];
    lines.push(`| Agent | \u804C\u8D23 | \u9ED8\u8BA4\u7B49\u7EA7 | \u6587\u4EF6 |`);
    lines.push(`| ----- | ---- | -------- | ---- |`);
    for (const agent of agents) {
      const desc = agent.frontmatter.description || "";
      const file = agent.frontmatter.name === "lead" ? "(\u89C4\u5219\u5185\u5D4C\u4E8E\u672C\u6587\u4EF6)" : `[.claude/agents/${agent.frontmatter.name}.md](.claude/agents/${agent.frontmatter.name}.md)`;
      lines.push(
        `| **${agent.frontmatter.name}** | ${desc} | ${agent.frontmatter.autonomy} | ${file} |`
      );
    }
    return lines.join("\n");
  }
  buildSkillsTable(skills) {
    if (skills.length === 0) return "\uFF08\u65E0\uFF09";
    const lines = [];
    const constraintSkills = skills.filter((s) => s.frontmatter.type === "constraint");
    const capabilitySkills = skills.filter((s) => s.frontmatter.type === "capability");
    if (constraintSkills.length > 0) {
      lines.push(`### \u7EA6\u675F\u7C7B Skills\uFF08\u59CB\u7EC8\u751F\u6548\uFF09
`);
      lines.push(`| Skill | \u8BF4\u660E | \u8DEF\u5F84 |`);
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
      lines.push(`### \u80FD\u529B\u7C7B Skills\uFF08\u6309\u9700\u52A0\u8F7D\uFF09
`);
      lines.push(`| Skill | \u8BF4\u660E | \u8DEF\u5F84 |`);
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
  buildWorkflowsTable(workflows) {
    if (workflows.length === 0) return "\uFF08\u65E0\uFF09";
    const lines = [];
    lines.push(`| Workflow | \u8BF4\u660E | \u6587\u4EF6 |`);
    lines.push(`| -------- | ---- | ---- |`);
    for (const wf of workflows) {
      const desc = wf.frontmatter.description || "";
      lines.push(
        `| **${wf.frontmatter.name}** | ${desc} | [.claude/workflows/${wf.frontmatter.name}.md](.claude/workflows/${wf.frontmatter.name}.md) |`
      );
    }
    return lines.join("\n");
  }
  transformAgent(agent) {
    const fm = agent.frontmatter;
    const lines = [];
    lines.push(`# ${fm.name}
`);
    if (fm.description) lines.push(`${fm.description}
`);
    lines.push(`## \u914D\u7F6E
`);
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
      lines.push(`## \u6307\u4EE4
`);
      lines.push(agent.body);
    }
    return lines.join("\n");
  }
  transformSkill(skill) {
    const fm = skill.frontmatter;
    const lines = [];
    lines.push(`# ${fm.name}
`);
    if (fm.description) lines.push(`${fm.description}
`);
    lines.push(`- **Type**: ${fm.type}`);
    if (fm.applies_to) {
      const applies = Array.isArray(fm.applies_to) ? fm.applies_to.join(", ") : fm.applies_to;
      lines.push(`- **Applies To**: ${applies}`);
    }
    lines.push(``);
    if (skill.body) lines.push(skill.body);
    return lines.join("\n");
  }
  transformWorkflow(wf) {
    const fm = wf.frontmatter;
    const lines = [];
    lines.push(`# ${fm.name}
`);
    if (fm.description) lines.push(`${fm.description}
`);
    lines.push(`## \u6B65\u9AA4
`);
    for (let i = 0; i < fm.steps.length; i++) {
      const step = fm.steps[i];
      lines.push(`${i + 1}. **${step.agent}** \u2192 ${step.action} (${step.autonomy || "\u7EE7\u627F\u9ED8\u8BA4"})`);
      if (step.gate?.message) lines.push(`   - Gate: ${step.gate.message}`);
      if (step.on_fail !== "retry") lines.push(`   - On Fail: ${step.on_fail}`);
    }
    lines.push(``);
    if (wf.body) {
      lines.push(`---
`);
      lines.push(wf.body);
    }
    return lines.join("\n");
  }
};

// ../platform-codex/dist/index.js
import { writeFile as writeFile5 } from "fs/promises";
import { join as join9 } from "path";
var CodexAdapter = class {
  name = "codex";
  async sync(context) {
    const { projectRoot } = context;
    const result = { files: [], warnings: [] };
    const content = this.renderEntryFile(context);
    const filePath = join9(projectRoot, "AGENTS.md");
    await writeFile5(filePath, content, "utf-8");
    result.files.push({ path: "AGENTS.md", action: "created" });
    return result;
  }
  getDefaultConfig() {
    return {
      platform: "codex",
      output: {
        directory: ".",
        entry_file: "AGENTS.md",
        agent_format: "single-file"
      },
      mapping: { skill_injection: "inline" },
      sync: { auto: true, watch: false, on_conflict: "overwrite" },
      platform_specific: {}
    };
  }
  renderEntryFile(context) {
    const { config, agents, skills, workflows, template } = context;
    const vars = {
      ENTRY_FILENAME: "AGENTS.md",
      DEFAULT_AUTONOMY: config.defaults.autonomy,
      ROUND_CAP: String(config.defaults.round_cap),
      CUSTOM_RULES: context.customRules ? context.customRules + "\n\n---\n\n" : "",
      AGENTS_TABLE: this.buildAgentsInline(agents),
      SKILLS_TABLE: this.buildSkillsInline(skills),
      WORKFLOWS_TABLE: this.buildWorkflowsInline(workflows)
    };
    return renderTemplate(template, vars);
  }
  /**
   * Codex 全量 inline：每个 agent 展开完整内容
   */
  buildAgentsInline(agents) {
    if (agents.length === 0) return "\uFF08\u65E0\uFF09";
    const lines = [];
    for (const agent of agents) {
      const fm = agent.frontmatter;
      lines.push(`### ${fm.name}
`);
      if (fm.description) lines.push(`${fm.description}
`);
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
  buildSkillsInline(skills) {
    if (skills.length === 0) return "\uFF08\u65E0\uFF09";
    const lines = [];
    const constraintSkills = skills.filter((s) => s.frontmatter.type === "constraint");
    const capabilitySkills = skills.filter((s) => s.frontmatter.type === "capability");
    if (constraintSkills.length > 0) {
      lines.push(`### \u7EA6\u675F\u7C7B Skills\uFF08\u59CB\u7EC8\u751F\u6548\uFF09
`);
      for (const skill of constraintSkills) {
        lines.push(`#### ${skill.frontmatter.name}
`);
        if (skill.frontmatter.description) lines.push(`${skill.frontmatter.description}
`);
        if (skill.body) {
          lines.push(skill.body);
          lines.push(``);
        }
      }
    }
    if (capabilitySkills.length > 0) {
      lines.push(`### \u80FD\u529B\u7C7B Skills\uFF08\u6309\u9700\u52A0\u8F7D\uFF09
`);
      for (const skill of capabilitySkills) {
        lines.push(`#### ${skill.frontmatter.name}
`);
        if (skill.frontmatter.description) lines.push(`${skill.frontmatter.description}
`);
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
  buildWorkflowsInline(workflows) {
    if (workflows.length === 0) return "\uFF08\u65E0\uFF09";
    const lines = [];
    for (const wf of workflows) {
      const fm = wf.frontmatter;
      lines.push(`### ${fm.name}
`);
      if (fm.description) lines.push(`${fm.description}
`);
      lines.push(`**\u6B65\u9AA4**:
`);
      for (let i = 0; i < fm.steps.length; i++) {
        const step = fm.steps[i];
        lines.push(`${i + 1}. **${step.agent}** \u2192 ${step.action} (${step.autonomy || "\u7EE7\u627F\u9ED8\u8BA4"})`);
      }
      lines.push(``);
      if (wf.body) {
        lines.push(wf.body);
        lines.push(``);
      }
    }
    return lines.join("\n");
  }
};

// src/sync.ts
function getAdapter(platform) {
  switch (platform) {
    case "opencode":
      return new OpenCodeAdapter();
    case "claude-code":
      return new ClaudeCodeAdapter();
    case "codex":
      return new CodexAdapter();
    default:
      throw new Error(`\u672A\u77E5\u5E73\u53F0: ${platform}`);
  }
}
async function syncPlatforms(projectRoot) {
  const context = await loadProjectContext(projectRoot);
  const allResult = { platforms: [], warnings: [] };
  if (context.config.platforms.length === 0) {
    allResult.warnings.push("\u672A\u914D\u7F6E\u4EFB\u4F55\u5E73\u53F0\uFF0C\u8DF3\u8FC7\u540C\u6B65\u3002");
    return allResult;
  }
  const needsAgentsMd = context.config.platforms.filter(
    (p) => p === "opencode" || p === "codex"
  );
  if (needsAgentsMd.length > 1) {
    allResult.warnings.push(
      "OpenCode \u548C Codex \u90FD\u4F7F\u7528 AGENTS.md\uFF0C\u5C06\u751F\u6210\u5171\u7528\u7248\u672C\uFF08\u4EE5 OpenCode \u683C\u5F0F\u4E3A\u51C6\uFF0CCodex \u517C\u5BB9\uFF09\u3002"
    );
  }
  for (const platform of context.config.platforms) {
    const adapter = getAdapter(platform);
    const syncContext = {
      ...context,
      platformConfig: adapter.getDefaultConfig()
    };
    const result = await adapter.sync(syncContext);
    allResult.platforms.push({ name: platform, result });
  }
  return allResult;
}

// src/commands/init.ts
var initCommand = defineCommand({
  meta: {
    name: "init",
    description: "\u521D\u59CB\u5316 KQ-Forge \u5230\u5F53\u524D\u9879\u76EE"
  },
  args: {
    platform: {
      type: "string",
      description: "\u542F\u7528\u7684\u5E73\u53F0\uFF08\u53EF\u591A\u6B21\u6307\u5B9A\uFF09",
      required: false
    },
    name: {
      type: "string",
      description: "\u9879\u76EE\u540D\u79F0\uFF08\u9ED8\u8BA4\u53D6\u76EE\u5F55\u540D\uFF09",
      required: false
    },
    force: {
      type: "boolean",
      description: "\u5F3A\u5236\u8986\u76D6\u6240\u6709\u6587\u4EF6\uFF08\u5305\u62EC\u5DF2\u5BA2\u5236\u5316\u7684 config \u548C custom-rules\uFF09",
      default: false
    }
  },
  async run({ args }) {
    const targetDir = resolve2(".");
    const projectName = args.name || basename(targetDir);
    const platforms = [];
    if (args.platform) {
      const raw = Array.isArray(args.platform) ? args.platform : [args.platform];
      for (const p of raw) {
        for (const name of p.split(",")) {
          const trimmed = name.trim();
          if (!["claude-code", "opencode", "codex"].includes(trimmed)) {
            consola.error(`\u4E0D\u652F\u6301\u7684\u5E73\u53F0: ${trimmed}`);
            consola.info("\u652F\u6301\u7684\u5E73\u53F0: claude-code, opencode, codex");
            process.exit(1);
          }
          if (!platforms.includes(trimmed)) {
            platforms.push(trimmed);
          }
        }
      }
    }
    consola.start(`\u521D\u59CB\u5316 KQ-Forge \u2192 ${targetDir}`);
    try {
      const result = await initProject({
        targetDir,
        projectName,
        platforms,
        force: args.force
      });
      for (const warning of result.warnings) {
        consola.warn(warning);
      }
      for (const file of result.files) {
        if (file.action === "created") {
          consola.success(`\u521B\u5EFA ${file.path}`);
        } else {
          consola.info(`\u4FDD\u7559 ${file.path}\uFF08\u5DF2\u5B58\u5728\uFF0C\u672A\u8986\u76D6\uFF09`);
        }
      }
      if (platforms.length > 0) {
        consola.start("\u540C\u6B65\u5E73\u53F0\u914D\u7F6E...");
        const syncResult = await syncPlatforms(targetDir);
        for (const warning of syncResult.warnings) {
          consola.warn(warning);
        }
        for (const { name, result: platformResult } of syncResult.platforms) {
          for (const file of platformResult.files) {
            consola.success(`[${name}] ${file.action} ${file.path}`);
          }
        }
      }
      consola.box(
        `KQ-Forge \u521D\u59CB\u5316\u5B8C\u6210\uFF01

\u9879\u76EE: ${projectName}
\u5E73\u53F0: ${platforms.length > 0 ? platforms.join(", ") : "\u65E0\uFF08\u7A0D\u540E\u7528 add-platform \u6DFB\u52A0\uFF09"}

\u4E0B\u4E00\u6B65:
  kq-forge add-platform opencode  # \u6DFB\u52A0\u5E73\u53F0
  kq-forge add frontend           # \u6DFB\u52A0\u573A\u666F\u5305
  kq-forge sync                   # \u91CD\u65B0\u540C\u6B65\u5E73\u53F0\u6587\u4EF6
  kq-forge status                 # \u67E5\u770B\u72B6\u6001`
      );
    } catch (e) {
      consola.error(e.message);
      process.exit(1);
    }
  }
});

// src/commands/add-platform.ts
import { defineCommand as defineCommand2 } from "citty";
import { consola as consola2 } from "consola";
import { resolve as resolve3 } from "path";
var addPlatformCommand = defineCommand2({
  meta: {
    name: "add-platform",
    description: "\u6DFB\u52A0\u5E73\u53F0\u9002\u914D\u5668"
  },
  args: {
    name: {
      type: "positional",
      description: "\u5E73\u53F0\u540D\u79F0 (claude-code | opencode | codex)",
      required: true
    }
  },
  async run({ args }) {
    const targetDir = resolve3(".");
    const platform = args.name;
    if (!["claude-code", "opencode", "codex"].includes(platform)) {
      consola2.error(`\u4E0D\u652F\u6301\u7684\u5E73\u53F0: ${platform}`);
      consola2.info("\u652F\u6301\u7684\u5E73\u53F0: claude-code, opencode, codex");
      process.exit(1);
    }
    const result = await addPlatform({ targetDir, platform });
    if (!result.success) {
      consola2.error(result.message);
      process.exit(1);
    }
    consola2.success(result.message);
    consola2.start("\u540C\u6B65\u5E73\u53F0\u914D\u7F6E...");
    try {
      const syncResult = await syncPlatforms(targetDir);
      for (const warning of syncResult.warnings) {
        consola2.warn(warning);
      }
      for (const { name, result: platformResult } of syncResult.platforms) {
        for (const file of platformResult.files) {
          consola2.success(`[${name}] ${file.action} ${file.path}`);
        }
      }
      consola2.success("\u5E73\u53F0\u540C\u6B65\u5B8C\u6210\u3002");
    } catch (e) {
      consola2.warn(`\u540C\u6B65\u5931\u8D25: ${e.message}`);
      consola2.info("\u53EF\u7A0D\u540E\u624B\u52A8\u8FD0\u884C kq-forge sync");
    }
  }
});

// src/commands/add.ts
import { defineCommand as defineCommand3 } from "citty";
import { consola as consola3 } from "consola";
import { resolve as resolve4 } from "path";
var addCommand = defineCommand3({
  meta: {
    name: "add",
    description: "\u6DFB\u52A0\u573A\u666F\u5305"
  },
  args: {
    package: {
      type: "positional",
      description: "\u573A\u666F\u5305\u540D\u79F0 (frontend | api)",
      required: true
    }
  },
  async run({ args }) {
    const targetDir = resolve4(".");
    consola3.start(`\u6DFB\u52A0\u573A\u666F\u5305: ${args.package}`);
    const result = await addPackage({
      targetDir,
      packageName: args.package
    });
    if (!result.success) {
      consola3.error(result.message);
      process.exit(1);
    }
    if (result.addedSkills.length > 0) {
      consola3.success(`\u6DFB\u52A0 skills: ${result.addedSkills.join(", ")}`);
    }
    if (result.addedWorkflows.length > 0) {
      consola3.success(`\u6DFB\u52A0 workflows: ${result.addedWorkflows.join(", ")}`);
    }
    if (result.skipped.length > 0) {
      for (const s of result.skipped) {
        consola3.warn(`\u8DF3\u8FC7: ${s}`);
      }
    }
    consola3.success(result.message);
    if (result.addedSkills.length > 0 || result.addedWorkflows.length > 0) {
      consola3.start("\u540C\u6B65\u5E73\u53F0\u914D\u7F6E...");
      try {
        const syncResult = await syncPlatforms(targetDir);
        for (const { name, result: platformResult } of syncResult.platforms) {
          const newFiles = platformResult.files.length;
          consola3.success(`[${name}] \u540C\u6B65 ${newFiles} \u4E2A\u6587\u4EF6`);
        }
      } catch (e) {
        consola3.warn(`\u540C\u6B65\u5931\u8D25: ${e.message}`);
        consola3.info("\u53EF\u7A0D\u540E\u624B\u52A8\u8FD0\u884C kq-forge sync");
      }
    }
  }
});

// src/commands/list-packages.ts
import { defineCommand as defineCommand4 } from "citty";
import { consola as consola4 } from "consola";
var listPackagesCommand = defineCommand4({
  meta: {
    name: "list-packages",
    description: "\u5217\u51FA\u53EF\u7528\u573A\u666F\u5305"
  },
  async run() {
    const packages = listPackages();
    consola4.info("\u53EF\u7528\u573A\u666F\u5305:\n");
    for (const pkg of packages) {
      console.log(`  ${pkg.name}`);
      console.log(`    ${pkg.description}`);
      if (pkg.skills.length > 0) {
        console.log(`    Skills: ${pkg.skills.join(", ")}`);
      }
      if (pkg.workflows.length > 0) {
        console.log(`    Workflows: ${pkg.workflows.join(", ")}`);
      }
      console.log();
    }
  }
});

// src/commands/status.ts
import { defineCommand as defineCommand5 } from "citty";
import { consola as consola5 } from "consola";
import { resolve as resolve5 } from "path";
import { readdir as readdir3 } from "fs/promises";
import { existsSync as existsSync7 } from "fs";
import { join as join10 } from "path";
var statusCommand = defineCommand5({
  meta: {
    name: "status",
    description: "\u663E\u793A\u5F53\u524D\u914D\u7F6E\u72B6\u6001"
  },
  async run() {
    const targetDir = resolve5(".");
    if (!isInitialized(targetDir)) {
      consola5.error("\u9879\u76EE\u672A\u521D\u59CB\u5316\u3002\u8BF7\u5148\u8FD0\u884C kq-forge init\u3002");
      process.exit(1);
    }
    try {
      const config = await loadConfig(targetDir);
      const kqDir = join10(targetDir, ".kqforge");
      const agentCount = await countFiles(join10(kqDir, "agents"), ".md");
      const workflowCount = await countFiles(join10(kqDir, "workflows"), ".md");
      const skillCount = await countDirs(join10(kqDir, "skills"));
      console.log();
      console.log(`  \u9879\u76EE: ${config.project.name}`);
      if (config.project.description) {
        console.log(`  \u63CF\u8FF0: ${config.project.description}`);
      }
      console.log();
      console.log(`  Autonomy:  ${config.defaults.autonomy}`);
      console.log(`  Workflow:   ${config.defaults.workflow}`);
      console.log(`  Quality:    ${config.quality.model}`);
      console.log(`  Round Cap:  ${config.defaults.round_cap}`);
      console.log(`  Language:   ${config.defaults.language}`);
      console.log();
      console.log(
        `  Platforms:  ${config.platforms.length > 0 ? config.platforms.join(", ") : "\u65E0"}`
      );
      console.log(`  Agents:     ${agentCount}`);
      console.log(`  Skills:     ${skillCount}`);
      console.log(`  Workflows:  ${workflowCount}`);
      console.log();
    } catch (e) {
      consola5.error(e.message);
      process.exit(1);
    }
  }
});
async function countFiles(dir, ext) {
  if (!existsSync7(dir)) return 0;
  const files = await readdir3(dir);
  return files.filter((f) => f.endsWith(ext)).length;
}
async function countDirs(dir) {
  if (!existsSync7(dir)) return 0;
  const entries = await readdir3(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).length;
}

// src/commands/validate.ts
import { defineCommand as defineCommand6 } from "citty";
import { consola as consola6 } from "consola";
import { resolve as resolve6 } from "path";
var validateCommand = defineCommand6({
  meta: {
    name: "validate",
    description: "\u6821\u9A8C\u914D\u7F6E\u6587\u4EF6\u5408\u6CD5\u6027"
  },
  async run() {
    const targetDir = resolve6(".");
    if (!isInitialized(targetDir)) {
      consola6.error("\u9879\u76EE\u672A\u521D\u59CB\u5316\u3002\u8BF7\u5148\u8FD0\u884C kq-forge init\u3002");
      process.exit(1);
    }
    consola6.start("\u6821\u9A8C\u914D\u7F6E...");
    const result = await validateProject(targetDir);
    const errors = result.issues.filter((i) => i.level === "error");
    const warnings = result.issues.filter((i) => i.level === "warning");
    if (errors.length > 0) {
      console.log();
      consola6.error(`\u53D1\u73B0 ${errors.length} \u4E2A\u9519\u8BEF:`);
      for (const issue of errors) {
        console.log(`  \u2717 [${issue.path}] ${issue.message}`);
      }
    }
    if (warnings.length > 0) {
      console.log();
      consola6.warn(`\u53D1\u73B0 ${warnings.length} \u4E2A\u8B66\u544A:`);
      for (const issue of warnings) {
        console.log(`  \u26A0 [${issue.path}] ${issue.message}`);
      }
    }
    console.log();
    if (result.valid) {
      consola6.success(
        `\u6821\u9A8C\u901A\u8FC7 \u2713 (${result.agents.length} agents, ${result.skills.length} skills, ${result.workflows.length} workflows)`
      );
    } else {
      consola6.error("\u6821\u9A8C\u5931\u8D25");
      process.exit(1);
    }
  }
});

// src/commands/sync.ts
import { defineCommand as defineCommand7 } from "citty";
import { consola as consola7 } from "consola";
import { resolve as resolve7 } from "path";
var syncCommand = defineCommand7({
  meta: {
    name: "sync",
    description: "\u5C06 .kqforge/ \u6E90\u6587\u4EF6\u540C\u6B65\u5230\u5404\u5E73\u53F0\u539F\u751F\u683C\u5F0F"
  },
  args: {},
  async run() {
    const targetDir = resolve7(".");
    if (!isInitialized(targetDir)) {
      consola7.error("\u9879\u76EE\u672A\u521D\u59CB\u5316\u3002\u8BF7\u5148\u8FD0\u884C kq-forge init\u3002");
      process.exit(1);
    }
    consola7.start("\u540C\u6B65\u5E73\u53F0\u914D\u7F6E...");
    try {
      const result = await syncPlatforms(targetDir);
      for (const warning of result.warnings) {
        consola7.warn(warning);
      }
      for (const { name, result: platformResult } of result.platforms) {
        consola7.info(`[${name}]`);
        for (const file of platformResult.files) {
          consola7.success(`  ${file.action} ${file.path}`);
        }
        for (const warning of platformResult.warnings) {
          consola7.warn(`  ${warning}`);
        }
      }
      const totalFiles = result.platforms.reduce(
        (sum, p) => sum + p.result.files.length,
        0
      );
      consola7.success(
        `\u540C\u6B65\u5B8C\u6210\uFF1A${result.platforms.length} \u4E2A\u5E73\u53F0\uFF0C${totalFiles} \u4E2A\u6587\u4EF6\u3002`
      );
    } catch (e) {
      consola7.error(e.message);
      process.exit(1);
    }
  }
});

// src/index.ts
var main = defineCommand8({
  meta: {
    name: "kq-forge",
    version: "0.1.0",
    description: "\u6A21\u5757\u5316 AI \u7F16\u7801\u4EE3\u7406 Harness \u2014 \u4E3A\u4EBA\u4E0E AI \u7684\u534F\u4F5C\u63D0\u4F9B\u7ED3\u6784\u5316\u534F\u8BAE\u5C42"
  },
  subCommands: {
    init: initCommand,
    "add-platform": addPlatformCommand,
    add: addCommand,
    "list-packages": listPackagesCommand,
    status: statusCommand,
    validate: validateCommand,
    sync: syncCommand
  }
});
runMain(main);
