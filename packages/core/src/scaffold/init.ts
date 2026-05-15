import { mkdir, writeFile, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stringify as stringifyYaml } from "yaml";
import type { KqForgeConfig, PlatformName } from "../config/schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 获取模板根目录（项目仓库根目录）
 *
 * 查找策略：
 * 1. 环境变量 KQ_FORGE_TEMPLATE_ROOT（开发/测试用）
 * 2. 从当前文件位置向上查找包含 agents/ 和 skills/ 的目录
 */
export function getTemplateRoot(): string {
  if (process.env.KQ_FORGE_TEMPLATE_ROOT) {
    return process.env.KQ_FORGE_TEMPLATE_ROOT;
  }

  let current = __dirname;
  for (let i = 0; i < 10; i++) {
    if (
      existsSync(join(current, "agents")) &&
      existsSync(join(current, "skills"))
    ) {
      return current;
    }
    const parent = resolve(current, "..");
    if (parent === current) break;
    current = parent;
  }

  return resolve(__dirname, "..", "..", "..", "..");
}

export interface InitOptions {
  /** 目标项目目录 */
  targetDir: string;
  /** 项目名称 */
  projectName: string;
  /** 要启用的平台 */
  platforms: PlatformName[];
  /** 是否覆盖已有文件 */
  force?: boolean;
}

export interface InitResult {
  files: { path: string; action: "created" | "skipped" }[];
  warnings: string[];
}

/**
 * 初始化 KQ-Forge 到目标项目
 *
 * 只在 .kqforge/ 内部存放源文件（single source of truth）。
 * 平台原生文件由各适配器的 sync() 生成。
 */
export async function initProject(options: InitOptions): Promise<InitResult> {
  const { targetDir, projectName, platforms, force = false } = options;
  const result: InitResult = { files: [], warnings: [] };
  const templateRoot = getTemplateRoot();

  // 检查是否已初始化
  const configDir = join(targetDir, ".kqforge");
  if (existsSync(configDir) && !force) {
    throw new Error(
      "项目已初始化（.kqforge/ 目录已存在）。使用 --force 覆盖。"
    );
  }

  // 1. 创建 .kqforge/ 目录结构
  await mkdir(join(configDir, "memory"), { recursive: true });
  await mkdir(join(configDir, "paradigms"), { recursive: true });
  await mkdir(join(configDir, "platforms"), { recursive: true });
  await mkdir(join(configDir, "agents"), { recursive: true });
  await mkdir(join(configDir, "skills"), { recursive: true });
  await mkdir(join(configDir, "workflows"), { recursive: true });

  // 写入 .gitkeep
  await writeFile(join(configDir, "memory", ".gitkeep"), "");
  await writeFile(join(configDir, "paradigms", ".gitkeep"), "");

  // 2. 生成 config.yaml
  const config: KqForgeConfig = {
    version: 1,
    project: { name: projectName },
    defaults: {
      autonomy: "L1",
      workflow: "feature",
      round_cap: 3,
      reflect_on_error: true,
      language: "zh-CN",
    },
    platforms,
    memory: {
      auto_capture: true,
      max_entries_per_file: 50,
      categories: ["rules", "facts", "lessons"],
    },
    quality: {
      model: "triangle",
      acceptance_criteria: true,
    },
    disabled: { agents: [], skills: [], workflows: [] },
    overrides: [],
  };

  const configPath = join(configDir, "config.yaml");
  await writeFile(configPath, stringifyYaml(config), "utf-8");
  result.files.push({ path: ".kqforge/config.yaml", action: "created" });

  // 3. 复制模板文件到 .kqforge/ 内部（不再复制到项目根）

  // agents/ → .kqforge/agents/
  const agentsSrc = join(templateRoot, "agents");
  const agentsDest = join(configDir, "agents");
  if (existsSync(agentsSrc)) {
    await cp(agentsSrc, agentsDest, { recursive: true, force: true });
    result.files.push({ path: ".kqforge/agents/", action: "created" });
  }

  // workflows/ → .kqforge/workflows/
  const workflowsSrc = join(templateRoot, "workflows");
  const workflowsDest = join(configDir, "workflows");
  if (existsSync(workflowsSrc)) {
    await cp(workflowsSrc, workflowsDest, { recursive: true, force: true });
    result.files.push({ path: ".kqforge/workflows/", action: "created" });
  }

  // skills/ (核心 skills) → .kqforge/skills/
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
    "verify-before-done",
  ];

  for (const skillName of coreSkills) {
    const src = join(templateRoot, "skills", skillName);
    const dest = join(configDir, "skills", skillName);
    if (existsSync(src)) {
      await cp(src, dest, { recursive: true, force: true });
    }
  }
  result.files.push({ path: ".kqforge/skills/", action: "created" });

  // AGENTS.template.md → .kqforge/AGENTS.template.md
  const templateSrc = join(templateRoot, "AGENTS.template.md");
  const templateDest = join(configDir, "AGENTS.template.md");
  if (existsSync(templateSrc)) {
    await cp(templateSrc, templateDest, { force: true });
    result.files.push({ path: ".kqforge/AGENTS.template.md", action: "created" });
  }

  // custom-rules.md → .kqforge/custom-rules.md
  const customRulesDest = join(configDir, "custom-rules.md");
  const defaultCustomRules = `## 自定义规则\n\n全程使用中文。\n`;
  await writeFile(customRulesDest, defaultCustomRules, "utf-8");
  result.files.push({ path: ".kqforge/custom-rules.md", action: "created" });

  return result;
}
