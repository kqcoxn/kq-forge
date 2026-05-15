import { defineCommand } from "citty";
import { consola } from "consola";
import { resolve } from "node:path";
import { isInitialized } from "@kq-forge/core";
import { syncPlatforms } from "../sync.js";

export const syncCommand = defineCommand({
  meta: {
    name: "sync",
    description: "将 .kqforge/ 源文件同步到各平台原生格式",
  },
  args: {},
  async run() {
    const targetDir = resolve(".");

    if (!isInitialized(targetDir)) {
      consola.error("项目未初始化。请先运行 kq-forge init。");
      process.exit(1);
    }

    consola.start("同步平台配置...");

    try {
      const result = await syncPlatforms(targetDir);

      for (const warning of result.warnings) {
        consola.warn(warning);
      }

      for (const { name, result: platformResult } of result.platforms) {
        consola.info(`[${name}]`);
        for (const file of platformResult.files) {
          consola.success(`  ${file.action} ${file.path}`);
        }
        for (const warning of platformResult.warnings) {
          consola.warn(`  ${warning}`);
        }
      }

      const totalFiles = result.platforms.reduce(
        (sum, p) => sum + p.result.files.length,
        0
      );
      consola.success(
        `同步完成：${result.platforms.length} 个平台，${totalFiles} 个文件。`
      );
    } catch (e) {
      consola.error((e as Error).message);
      process.exit(1);
    }
  },
});
