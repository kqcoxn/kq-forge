import { defineCommand } from "citty";
import { consola } from "consola";
import { resolve } from "node:path";
import { addPackage } from "@kq-forge/core";
import { syncPlatforms } from "../sync.js";

export const addCommand = defineCommand({
  meta: {
    name: "add",
    description: "添加场景包",
  },
  args: {
    package: {
      type: "positional",
      description: "场景包名称 (frontend | api)",
      required: true,
    },
  },
  async run({ args }) {
    const targetDir = resolve(".");

    consola.start(`添加场景包: ${args.package}`);

    const result = await addPackage({
      targetDir,
      packageName: args.package,
    });

    if (!result.success) {
      consola.error(result.message);
      process.exit(1);
    }

    if (result.addedSkills.length > 0) {
      consola.success(`添加 skills: ${result.addedSkills.join(", ")}`);
    }
    if (result.addedWorkflows.length > 0) {
      consola.success(`添加 workflows: ${result.addedWorkflows.join(", ")}`);
    }
    if (result.skipped.length > 0) {
      for (const s of result.skipped) {
        consola.warn(`跳过: ${s}`);
      }
    }

    consola.success(result.message);

    // 自动 sync 平台文件（新增的 skills 需要同步到平台目录）
    if (result.addedSkills.length > 0 || result.addedWorkflows.length > 0) {
      consola.start("同步平台配置...");
      try {
        const syncResult = await syncPlatforms(targetDir);
        for (const { name, result: platformResult } of syncResult.platforms) {
          const newFiles = platformResult.files.length;
          consola.success(`[${name}] 同步 ${newFiles} 个文件`);
        }
      } catch (e) {
        consola.warn(`同步失败: ${(e as Error).message}`);
        consola.info("可稍后手动运行 kq-forge sync");
      }
    }
  },
});
