import { defineCommand } from "citty";
import { consola } from "consola";
import { resolve } from "node:path";
import { addPlatform, type PlatformName } from "@kq-forge/core";

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

    if (result.success) {
      consola.success(result.message);
    } else {
      consola.error(result.message);
      process.exit(1);
    }
  },
});
