import { defineCommand } from "citty";
import { consola } from "consola";
import { resolve } from "node:path";
import { addPackage } from "@kq-forge/core";
import { syncPlatforms } from "../sync.js";

export const addCommand = defineCommand({
  meta: {
    name: "add",
    description: "添加场景包（支持同时添加多个）",
  },
  args: {
    packages: {
      type: "positional",
      description: "场景包名称，支持多个（如 frontend python golang）",
      required: true,
    },
  },
  async run({ args }) {
    const targetDir = resolve(".");
    // citty 的 _ 包含所有 positional 参数，去重以防重复
    const packageNames = [
      ...new Set([
        args.packages as string,
        ...((args._ as string[]) || []),
      ]),
    ];

    let hasNewContent = false;

    for (const packageName of packageNames) {
      consola.start(`添加场景包: ${packageName}`);

      const result = await addPackage({
        targetDir,
        packageName,
      });

      if (!result.success) {
        consola.error(result.message);
        process.exit(1);
      }

      if (result.addedSkills.length > 0) {
        consola.success(`添加 skills: ${result.addedSkills.join(", ")}`);
        hasNewContent = true;
      }
      if (result.addedWorkflows.length > 0) {
        consola.success(`添加 workflows: ${result.addedWorkflows.join(", ")}`);
        hasNewContent = true;
      }
      if (result.skipped.length > 0) {
        for (const s of result.skipped) {
          consola.warn(`跳过: ${s}`);
        }
      }

      consola.success(result.message);
    }

    // 所有包添加完毕后统一 sync 一次
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
  },
});
