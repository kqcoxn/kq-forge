import { mkdir, writeFile, readdir, readFile, cp, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stringify as stringifyYaml } from "yaml";
import type { KqForgeConfig, PlatformName } from "../config/schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 获取模板根目录（项目仓库根目录）
 * 由于模板保留在项目根，CLI 通过环境变量或相对路径定位模板。
 *
 * 查找策略：
 * 1. 环境变量 KQ_FORGE_TEMPLATE_ROOT（开发/测试用）
 * 2. 从当前文件位置向上查找包含 agents/ 和 skills/ 的目录
 */
export function getTemplateRoot(): string {
  if (process.env.KQ_FORGE_TEMPLATE_ROOT) {
    return process.env.KQ_FORGE_TEMPLATE_ROOT;
  }

  // 从当前文件向上查找仓库根（包含 agents/ 和 skills/ 目录）
  let current = __dirname;
  for (let i = 0; i < 10; i++) {
    if (
      existsSync(join(current, "agents")) &&
      existsSync(join(current, "skills"))
    ) {
      return current;
    }
    const parent = resolve(current, "..");
    if (parent === current) break; // 到达文件系统根
    current = parent;
  }

  // 最终回退：假设从 packages/cli/dist/ 运行
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

  // 3. 复制核心模板文件
  // agents/
  await copyDirIfNotExists(
    join(templateRoot, "agents"),
    join(targetDir, "agents"),
    force,
    result
  );

  // workflows/
  await copyDirIfNotExists(
    join(templateRoot, "workflows"),
    join(targetDir, "workflows"),
    force,
    result
  );

  // skills/ (核心 skills)
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
  const skillsDir = join(targetDir, "skills");
  await mkdir(skillsDir, { recursive: true });

  for (const skillName of coreSkills) {
    const src = join(templateRoot, "skills", skillName);
    const dest = join(skillsDir, skillName);
    if (existsSync(src)) {
      await copyDirIfNotExists(src, dest, force, result, `skills/${skillName}`);
    }
  }

  // 4. 生成 AGENTS.md 入口文件
  const agentsMd = generateAgentsMd(projectName, config);
  const agentsMdPath = join(targetDir, "AGENTS.md");
  if (!existsSync(agentsMdPath) || force) {
    await writeFile(agentsMdPath, agentsMd, "utf-8");
    result.files.push({ path: "AGENTS.md", action: "created" });
  } else {
    result.files.push({ path: "AGENTS.md", action: "skipped" });
    result.warnings.push("AGENTS.md 已存在，跳过（使用 --force 覆盖）");
  }

  return result;
}

/**
 * 复制目录（不覆盖已有文件）
 */
async function copyDirIfNotExists(
  src: string,
  dest: string,
  force: boolean,
  result: InitResult,
  prefix?: string
): Promise<void> {
  if (!existsSync(src)) return;

  if (existsSync(dest) && !force) {
    const relPath = prefix || dest;
    result.files.push({ path: relPath, action: "skipped" });
    result.warnings.push(`${relPath}/ 已存在，跳过`);
    return;
  }

  await cp(src, dest, { recursive: true, force });
  const relPath = prefix || dest;
  result.files.push({ path: relPath, action: "created" });
}

/**
 * 生成 AGENTS.md 入口文件内容
 */
function generateAgentsMd(projectName: string, config: KqForgeConfig): string {
  return `# ${projectName} — Agent Configuration

> 本项目使用 [KQ-Forge](https://github.com/kqcoxn/kq-forge) 管理 AI 协作。

---

## 项目协作规则

以下规则对所有 Agent 生效，不可被单个 Agent 或 Workflow 覆盖。

### 基本原则

1. **以人为本** — 人类是最终决策者。任何 Agent 在不确定时应请求澄清而非猜测。
2. **因地制宜** — 不同任务使用不同的 autonomy level，不存在"一刀切"的最优模式。
3. **实事求是** — 犯错不可怕，隐瞒错误不可接受。发现问题立即上报。

### Autonomy Level 约定

| 等级 | 模式 | 人类角色 | 适用场景 |
|------|------|---------|---------|
| **L0** | 全手动 | Agent 建议，人执行 | 高风险变更、架构决策 |
| **L1** | 半自动 | Agent 执行，关键节点等人确认 | 常规功能开发 |
| **L2** | 监督自动 | Agent 全自动，人异步 review | 批量任务、重构 |
| **L3** | 全自动 | Agent 自主完成，仅失败时通知 | 机械性任务、格式化 |

默认等级：**${config.defaults.autonomy}**

### 对抗三角约定

- Writer（执行者）不能 review 自己的产出
- Reviewer（审查者）只读，不能直接修改代码
- Judge（裁决者）独立于 Writer 和 Reviewer，做最终裁决
- 对抗轮次有上限（默认 \`round_cap: ${config.defaults.round_cap}\`），达到上限后 Judge 强制裁决

### 记忆沉淀触发条件

以下情况必须触发记忆沉淀（写入 \`.kqforge/memory/\`）：

- 发现项目级约束或约定
- 犯错后的根因分析结论
- 人类明确指出的偏好或规则
- 反复出现的模式（第二次遇到时沉淀）

---

## 配置

所有配置位于 \`.kqforge/config.yaml\`。

## 当前状态

- Autonomy: ${config.defaults.autonomy}
- Workflow: ${config.defaults.workflow}
- Quality: ${config.quality.model}
- Platforms: ${config.platforms.join(", ") || "无"}

---

## 自定义规则

全程使用中文。

---

## Agents

| Agent | 文件 |
|-------|------|
| lead | [agents/lead.md](agents/lead.md) |
| implementer | [agents/implementer.md](agents/implementer.md) |
| reviewer | [agents/reviewer.md](agents/reviewer.md) |
| judge | [agents/judge.md](agents/judge.md) |

## Workflows

| Workflow | 文件 |
|----------|------|
| feature | [workflows/feature.md](workflows/feature.md) |
| bugfix | [workflows/bugfix.md](workflows/bugfix.md) |
| longmarch | [workflows/longmarch.md](workflows/longmarch.md) |
`;
}
