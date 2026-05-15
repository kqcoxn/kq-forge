import { defineCommand } from "citty";
import { consola } from "consola";
import { resolve } from "node:path";
import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, isInitialized } from "@kq-forge/core";

export const statusCommand = defineCommand({
  meta: {
    name: "status",
    description: "显示当前配置状态",
  },
  async run() {
    const targetDir = resolve(".");

    if (!isInitialized(targetDir)) {
      consola.error("项目未初始化。请先运行 kq-forge init。");
      process.exit(1);
    }

    try {
      const config = await loadConfig(targetDir);

      // 统计 .kqforge/ 内各目录文件数
      const kqDir = join(targetDir, ".kqforge");
      const agentCount = await countFiles(join(kqDir, "agents"), ".md");
      const workflowCount = await countFiles(join(kqDir, "workflows"), ".md");
      const skillCount = await countDirs(join(kqDir, "skills"));

      console.log();
      console.log(`  项目: ${config.project.name}`);
      if (config.project.description) {
        console.log(`  描述: ${config.project.description}`);
      }
      console.log();
      console.log(`  Autonomy:  ${config.defaults.autonomy}`);
      console.log(`  Workflow:   ${config.defaults.workflow}`);
      console.log(`  Quality:    ${config.quality.model}`);
      console.log(`  Round Cap:  ${config.defaults.round_cap}`);
      console.log(`  Language:   ${config.defaults.language}`);
      console.log();
      console.log(
        `  Platforms:  ${config.platforms.length > 0 ? config.platforms.join(", ") : "无"}`
      );
      console.log(`  Agents:     ${agentCount}`);
      console.log(`  Skills:     ${skillCount}`);
      console.log(`  Workflows:  ${workflowCount}`);
      console.log();
    } catch (e) {
      consola.error((e as Error).message);
      process.exit(1);
    }
  },
});

async function countFiles(dir: string, ext: string): Promise<number> {
  if (!existsSync(dir)) return 0;
  const files = await readdir(dir);
  return files.filter((f) => f.endsWith(ext)).length;
}

async function countDirs(dir: string): Promise<number> {
  if (!existsSync(dir)) return 0;
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).length;
}
