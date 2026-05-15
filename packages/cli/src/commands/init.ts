import { defineCommand } from "citty";
import { consola } from "consola";
import { resolve, basename } from "node:path";
import { initProject, type PlatformName } from "@kq-forge/core";
import { syncPlatforms } from "../sync.js";

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "初始化 KQ-Forge 到当前项目",
  },
  args: {
    platform: {
      type: "string",
      description: "启用的平台（可多次指定）",
      required: false,
    },
    name: {
      type: "string",
      description: "项目名称（默认取目录名）",
      required: false,
    },
    force: {
      type: "boolean",
      description: "强制覆盖已有文件",
      default: false,
    },
  },
  async run({ args }) {
    const targetDir = resolve(".");
    const projectName = args.name || basename(targetDir);

    // 解析 platforms（支持逗号分隔和多次指定）
    const platforms: PlatformName[] = [];
    if (args.platform) {
      const raw = Array.isArray(args.platform)
        ? args.platform
        : [args.platform];
      for (const p of raw) {
        for (const name of p.split(",")) {
          const trimmed = name.trim() as PlatformName;
          if (!["claude-code", "opencode", "codex"].includes(trimmed)) {
            consola.error(`不支持的平台: ${trimmed}`);
            consola.info("支持的平台: claude-code, opencode, codex");
            process.exit(1);
          }
          if (!platforms.includes(trimmed)) {
            platforms.push(trimmed);
          }
        }
      }
    }

    consola.start(`初始化 KQ-Forge → ${targetDir}`);

    try {
      const result = await initProject({
        targetDir,
        projectName,
        platforms,
        force: args.force,
      });

      // 输出 init 结果
      for (const file of result.files) {
        if (file.action === "created") {
          consola.success(`创建 ${file.path}`);
        } else {
          consola.warn(`跳过 ${file.path}`);
        }
      }

      for (const warning of result.warnings) {
        consola.warn(warning);
      }

      // 如果指定了平台，自动执行 sync
      if (platforms.length > 0) {
        consola.start("同步平台配置...");
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
        `KQ-Forge 初始化完成！\n\n` +
          `项目: ${projectName}\n` +
          `平台: ${platforms.length > 0 ? platforms.join(", ") : "无（稍后用 add-platform 添加）"}\n\n` +
          `下一步:\n` +
          `  kq-forge add-platform opencode  # 添加平台\n` +
          `  kq-forge add frontend           # 添加场景包\n` +
          `  kq-forge sync                   # 重新同步平台文件\n` +
          `  kq-forge status                 # 查看状态`
      );
    } catch (e) {
      consola.error((e as Error).message);
      process.exit(1);
    }
  },
});
