import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getPackage } from "../registry/packages.js";
import { getTemplateRoot } from "./init.js";

export interface AddPackageOptions {
  targetDir: string;
  packageName: string;
}

export interface AddPackageResult {
  success: boolean;
  message: string;
  addedSkills: string[];
  addedWorkflows: string[];
  skipped: string[];
}

/**
 * 添加场景包到项目（复制到 .kqforge/ 内部）
 */
export async function addPackage(
  options: AddPackageOptions
): Promise<AddPackageResult> {
  const { targetDir, packageName } = options;
  const templateRoot = getTemplateRoot();

  // 检查是否已初始化
  if (!existsSync(join(targetDir, ".kqforge", "config.yaml"))) {
    return {
      success: false,
      message: "项目未初始化。请先运行 kq-forge init。",
      addedSkills: [],
      addedWorkflows: [],
      skipped: [],
    };
  }

  // 查找包
  const pkg = getPackage(packageName);
  if (!pkg) {
    return {
      success: false,
      message: `未找到场景包 "${packageName}"。使用 kq-forge list-packages 查看可用包。`,
      addedSkills: [],
      addedWorkflows: [],
      skipped: [],
    };
  }

  const addedSkills: string[] = [];
  const addedWorkflows: string[] = [];
  const skipped: string[] = [];

  // 复制 skills 到 .kqforge/skills/
  const skillsDir = join(targetDir, ".kqforge", "skills");
  await mkdir(skillsDir, { recursive: true });

  for (const skillName of pkg.skills) {
    const src = join(templateRoot, "skills", skillName);
    const dest = join(skillsDir, skillName);

    if (!existsSync(src)) {
      skipped.push(`skills/${skillName}（模板不存在）`);
      continue;
    }

    if (existsSync(dest)) {
      skipped.push(`skills/${skillName}（已存在）`);
      continue;
    }

    await cp(src, dest, { recursive: true });
    addedSkills.push(skillName);
  }

  // 复制 workflows 到 .kqforge/workflows/
  if (pkg.workflows.length > 0) {
    const workflowsDir = join(targetDir, ".kqforge", "workflows");
    await mkdir(workflowsDir, { recursive: true });

    for (const wfName of pkg.workflows) {
      const src = join(templateRoot, "workflows", `${wfName}.md`);
      const dest = join(workflowsDir, `${wfName}.md`);

      if (!existsSync(src)) {
        skipped.push(`workflows/${wfName}（模板不存在）`);
        continue;
      }

      if (existsSync(dest)) {
        skipped.push(`workflows/${wfName}（已存在）`);
        continue;
      }

      await cp(src, dest);
      addedWorkflows.push(wfName);
    }
  }

  return {
    success: true,
    message: `场景包 "${packageName}" 已添加。`,
    addedSkills,
    addedWorkflows,
    skipped,
  };
}
