import { defineCommand } from "citty";
import { consola } from "consola";
import { resolve } from "node:path";
import { validateProject, isInitialized } from "@kq-forge/core";

export const validateCommand = defineCommand({
  meta: {
    name: "validate",
    description: "校验配置文件合法性",
  },
  async run() {
    const targetDir = resolve(".");

    if (!isInitialized(targetDir)) {
      consola.error("项目未初始化。请先运行 kq-forge init。");
      process.exit(1);
    }

    consola.start("校验配置...");

    const result = await validateProject(targetDir);

    // 输出结果
    const errors = result.issues.filter((i) => i.level === "error");
    const warnings = result.issues.filter((i) => i.level === "warning");

    if (errors.length > 0) {
      console.log();
      consola.error(`发现 ${errors.length} 个错误:`);
      for (const issue of errors) {
        console.log(`  ✗ [${issue.path}] ${issue.message}`);
      }
    }

    if (warnings.length > 0) {
      console.log();
      consola.warn(`发现 ${warnings.length} 个警告:`);
      for (const issue of warnings) {
        console.log(`  ⚠ [${issue.path}] ${issue.message}`);
      }
    }

    console.log();
    if (result.valid) {
      consola.success(
        `校验通过 ✓ (${result.agents.length} agents, ${result.skills.length} skills, ${result.workflows.length} workflows)`
      );
    } else {
      consola.error("校验失败");
      process.exit(1);
    }
  },
});
