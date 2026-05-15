import { defineCommand } from "citty";
import { consola } from "consola";
import { resolve } from "node:path";
import { addPlatform, type PlatformName } from "@kq-forge/core";
import { syncPlatforms } from "../sync.js";

export const addPlatformCommand = defineCommand({
  meta: {
    name: "add-platform",
    description: "添加平台适配器",
  },
  args: {
    name: {
      type: "positional",
      description: "平台名称 (claude-code | opencode | codex)",
      required: true,
    },
  },
  async run({ args }) {
    const targetDir = resolve(".");
    const platform = args.name as PlatformName;

    if (!["claude-code", "opencode", "codex"].includes(platform)) {
      consola.error(`不支持的平台: ${platform}`);
      consola.info("支持的平台: claude-code, opencode, codex");
      process.exit(1);
    }

    const result = await addPlatform({ targetDir, platform });

    if (!result.success) {
      consola.error(result.message);
      process.exit(1);
    }

    consola.success(result.message);

    // 自动执行 sync
    consola.start("同步平台配置...");
    try {
      const syncResult = await syncPlatforms(targetDir);

      for (const warning of syncResult.warnings) {
        consola.warn(warning);
      }

      for (const { name, result: platformResult } of syncResult.platforms) {
        for (const file of platformResult.files) {
          consola.success(`[${name}] ${file.action} ${file.path}`);
        }
      }

      consola.success("平台同步完成。");
    } catch (e) {
      consola.warn(`同步失败: ${(e as Error).message}`);
      consola.info("可稍后手动运行 kq-forge sync");
    }
  },
});
