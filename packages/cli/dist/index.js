#!/usr/bin/env node

// src/index.ts
import { defineCommand as defineCommand7, runMain } from "citty";

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
import { readFile as readFile3, writeFile as writeFile2, mkdir as mkdir2 } from "fs/promises";
import { existsSync as existsSync4 } from "fs";
import { join as join4 } from "path";
import { parse as parseYaml2, stringify as stringifyYaml2 } from "yaml";
import { cp as cp2, mkdir as mkdir3 } from "fs/promises";
import { existsSync as existsSync5 } from "fs";
import { join as join5 } from "path";
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
  const agentsDir = join2(projectRoot, "agents");
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
  const skillsDir = join2(projectRoot, "skills");
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
  const workflowsDir = join2(projectRoot, "workflows");
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
async function initProject(options) {
  const { targetDir, projectName, platforms, force = false } = options;
  const result = { files: [], warnings: [] };
  const templateRoot = getTemplateRoot();
  const configDir = join3(targetDir, ".kqforge");
  if (existsSync3(configDir) && !force) {
    throw new Error(
      "\u9879\u76EE\u5DF2\u521D\u59CB\u5316\uFF08.kqforge/ \u76EE\u5F55\u5DF2\u5B58\u5728\uFF09\u3002\u4F7F\u7528 --force \u8986\u76D6\u3002"
    );
  }
  await mkdir(join3(configDir, "memory"), { recursive: true });
  await mkdir(join3(configDir, "paradigms"), { recursive: true });
  await mkdir(join3(configDir, "platforms"), { recursive: true });
  await writeFile(join3(configDir, "memory", ".gitkeep"), "");
  await writeFile(join3(configDir, "paradigms", ".gitkeep"), "");
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
  const configPath = join3(configDir, "config.yaml");
  await writeFile(configPath, stringifyYaml(config), "utf-8");
  result.files.push({ path: ".kqforge/config.yaml", action: "created" });
  await copyDirIfNotExists(
    join3(templateRoot, "agents"),
    join3(targetDir, "agents"),
    force,
    result
  );
  await copyDirIfNotExists(
    join3(templateRoot, "workflows"),
    join3(targetDir, "workflows"),
    force,
    result
  );
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
  const skillsDir = join3(targetDir, "skills");
  await mkdir(skillsDir, { recursive: true });
  for (const skillName of coreSkills) {
    const src = join3(templateRoot, "skills", skillName);
    const dest = join3(skillsDir, skillName);
    if (existsSync3(src)) {
      await copyDirIfNotExists(src, dest, force, result, `skills/${skillName}`);
    }
  }
  const agentsMd = generateAgentsMd(projectName, config);
  const agentsMdPath = join3(targetDir, "AGENTS.md");
  if (!existsSync3(agentsMdPath) || force) {
    await writeFile(agentsMdPath, agentsMd, "utf-8");
    result.files.push({ path: "AGENTS.md", action: "created" });
  } else {
    result.files.push({ path: "AGENTS.md", action: "skipped" });
    result.warnings.push("AGENTS.md \u5DF2\u5B58\u5728\uFF0C\u8DF3\u8FC7\uFF08\u4F7F\u7528 --force \u8986\u76D6\uFF09");
  }
  return result;
}
async function copyDirIfNotExists(src, dest, force, result, prefix) {
  if (!existsSync3(src)) return;
  if (existsSync3(dest) && !force) {
    const relPath2 = prefix || dest;
    result.files.push({ path: relPath2, action: "skipped" });
    result.warnings.push(`${relPath2}/ \u5DF2\u5B58\u5728\uFF0C\u8DF3\u8FC7`);
    return;
  }
  await cp(src, dest, { recursive: true, force });
  const relPath = prefix || dest;
  result.files.push({ path: relPath, action: "created" });
}
function generateAgentsMd(projectName, config) {
  return `# ${projectName} \u2014 Agent Configuration

> \u672C\u9879\u76EE\u4F7F\u7528 [KQ-Forge](https://github.com/kqcoxn/kq-forge) \u7BA1\u7406 AI \u534F\u4F5C\u3002

---

## \u9879\u76EE\u534F\u4F5C\u89C4\u5219

\u4EE5\u4E0B\u89C4\u5219\u5BF9\u6240\u6709 Agent \u751F\u6548\uFF0C\u4E0D\u53EF\u88AB\u5355\u4E2A Agent \u6216 Workflow \u8986\u76D6\u3002

### \u57FA\u672C\u539F\u5219

1. **\u4EE5\u4EBA\u4E3A\u672C** \u2014 \u4EBA\u7C7B\u662F\u6700\u7EC8\u51B3\u7B56\u8005\u3002\u4EFB\u4F55 Agent \u5728\u4E0D\u786E\u5B9A\u65F6\u5E94\u8BF7\u6C42\u6F84\u6E05\u800C\u975E\u731C\u6D4B\u3002
2. **\u56E0\u5730\u5236\u5B9C** \u2014 \u4E0D\u540C\u4EFB\u52A1\u4F7F\u7528\u4E0D\u540C\u7684 autonomy level\uFF0C\u4E0D\u5B58\u5728"\u4E00\u5200\u5207"\u7684\u6700\u4F18\u6A21\u5F0F\u3002
3. **\u5B9E\u4E8B\u6C42\u662F** \u2014 \u72AF\u9519\u4E0D\u53EF\u6015\uFF0C\u9690\u7792\u9519\u8BEF\u4E0D\u53EF\u63A5\u53D7\u3002\u53D1\u73B0\u95EE\u9898\u7ACB\u5373\u4E0A\u62A5\u3002

### Autonomy Level \u7EA6\u5B9A

| \u7B49\u7EA7 | \u6A21\u5F0F | \u4EBA\u7C7B\u89D2\u8272 | \u9002\u7528\u573A\u666F |
|------|------|---------|---------|
| **L0** | \u5168\u624B\u52A8 | Agent \u5EFA\u8BAE\uFF0C\u4EBA\u6267\u884C | \u9AD8\u98CE\u9669\u53D8\u66F4\u3001\u67B6\u6784\u51B3\u7B56 |
| **L1** | \u534A\u81EA\u52A8 | Agent \u6267\u884C\uFF0C\u5173\u952E\u8282\u70B9\u7B49\u4EBA\u786E\u8BA4 | \u5E38\u89C4\u529F\u80FD\u5F00\u53D1 |
| **L2** | \u76D1\u7763\u81EA\u52A8 | Agent \u5168\u81EA\u52A8\uFF0C\u4EBA\u5F02\u6B65 review | \u6279\u91CF\u4EFB\u52A1\u3001\u91CD\u6784 |
| **L3** | \u5168\u81EA\u52A8 | Agent \u81EA\u4E3B\u5B8C\u6210\uFF0C\u4EC5\u5931\u8D25\u65F6\u901A\u77E5 | \u673A\u68B0\u6027\u4EFB\u52A1\u3001\u683C\u5F0F\u5316 |

\u9ED8\u8BA4\u7B49\u7EA7\uFF1A**${config.defaults.autonomy}**

### \u5BF9\u6297\u4E09\u89D2\u7EA6\u5B9A

- Writer\uFF08\u6267\u884C\u8005\uFF09\u4E0D\u80FD review \u81EA\u5DF1\u7684\u4EA7\u51FA
- Reviewer\uFF08\u5BA1\u67E5\u8005\uFF09\u53EA\u8BFB\uFF0C\u4E0D\u80FD\u76F4\u63A5\u4FEE\u6539\u4EE3\u7801
- Judge\uFF08\u88C1\u51B3\u8005\uFF09\u72EC\u7ACB\u4E8E Writer \u548C Reviewer\uFF0C\u505A\u6700\u7EC8\u88C1\u51B3
- \u5BF9\u6297\u8F6E\u6B21\u6709\u4E0A\u9650\uFF08\u9ED8\u8BA4 \`round_cap: ${config.defaults.round_cap}\`\uFF09\uFF0C\u8FBE\u5230\u4E0A\u9650\u540E Judge \u5F3A\u5236\u88C1\u51B3

### \u8BB0\u5FC6\u6C89\u6DC0\u89E6\u53D1\u6761\u4EF6

\u4EE5\u4E0B\u60C5\u51B5\u5FC5\u987B\u89E6\u53D1\u8BB0\u5FC6\u6C89\u6DC0\uFF08\u5199\u5165 \`.kqforge/memory/\`\uFF09\uFF1A

- \u53D1\u73B0\u9879\u76EE\u7EA7\u7EA6\u675F\u6216\u7EA6\u5B9A
- \u72AF\u9519\u540E\u7684\u6839\u56E0\u5206\u6790\u7ED3\u8BBA
- \u4EBA\u7C7B\u660E\u786E\u6307\u51FA\u7684\u504F\u597D\u6216\u89C4\u5219
- \u53CD\u590D\u51FA\u73B0\u7684\u6A21\u5F0F\uFF08\u7B2C\u4E8C\u6B21\u9047\u5230\u65F6\u6C89\u6DC0\uFF09

---

## \u914D\u7F6E

\u6240\u6709\u914D\u7F6E\u4F4D\u4E8E \`.kqforge/config.yaml\`\u3002

## \u5F53\u524D\u72B6\u6001

- Autonomy: ${config.defaults.autonomy}
- Workflow: ${config.defaults.workflow}
- Quality: ${config.quality.model}
- Platforms: ${config.platforms.join(", ") || "\u65E0"}

---

## \u81EA\u5B9A\u4E49\u89C4\u5219

\u5168\u7A0B\u4F7F\u7528\u4E2D\u6587\u3002

---

## Agents

| Agent | \u6587\u4EF6 |
|-------|------|
| lead | [agents/lead.md](agents/lead.md) |
| implementer | [agents/implementer.md](agents/implementer.md) |
| reviewer | [agents/reviewer.md](agents/reviewer.md) |
| judge | [agents/judge.md](agents/judge.md) |

## Workflows

| Workflow | \u6587\u4EF6 |
|----------|------|
| feature | [workflows/feature.md](workflows/feature.md) |
| bugfix | [workflows/bugfix.md](workflows/bugfix.md) |
| longmarch | [workflows/longmarch.md](workflows/longmarch.md) |
`;
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
  const raw = await readFile3(configPath, "utf-8");
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
  const skillsDir = join5(targetDir, "skills");
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
    const workflowsDir = join5(targetDir, "workflows");
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
      description: "\u5F3A\u5236\u8986\u76D6\u5DF2\u6709\u6587\u4EF6",
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
      for (const file of result.files) {
        if (file.action === "created") {
          consola.success(`\u521B\u5EFA ${file.path}`);
        } else {
          consola.warn(`\u8DF3\u8FC7 ${file.path}`);
        }
      }
      for (const warning of result.warnings) {
        consola.warn(warning);
      }
      consola.box(
        `KQ-Forge \u521D\u59CB\u5316\u5B8C\u6210\uFF01

\u9879\u76EE: ${projectName}
\u5E73\u53F0: ${platforms.length > 0 ? platforms.join(", ") : "\u65E0\uFF08\u7A0D\u540E\u7528 add-platform \u6DFB\u52A0\uFF09"}

\u4E0B\u4E00\u6B65:
  kq-forge add-platform opencode  # \u6DFB\u52A0\u5E73\u53F0
  kq-forge add frontend           # \u6DFB\u52A0\u573A\u666F\u5305
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
    if (result.success) {
      consola2.success(result.message);
    } else {
      consola2.error(result.message);
      process.exit(1);
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
import { readdir as readdir2 } from "fs/promises";
import { existsSync as existsSync6 } from "fs";
import { join as join6 } from "path";
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
      const agentCount = await countFiles(join6(targetDir, "agents"), ".md");
      const workflowCount = await countFiles(
        join6(targetDir, "workflows"),
        ".md"
      );
      const skillCount = await countDirs(join6(targetDir, "skills"));
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
  if (!existsSync6(dir)) return 0;
  const files = await readdir2(dir);
  return files.filter((f) => f.endsWith(ext)).length;
}
async function countDirs(dir) {
  if (!existsSync6(dir)) return 0;
  const entries = await readdir2(dir, { withFileTypes: true });
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

// src/index.ts
var main = defineCommand7({
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
    validate: validateCommand
  }
});
runMain(main);
