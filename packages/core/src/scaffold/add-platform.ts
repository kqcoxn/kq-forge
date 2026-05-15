import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { PlatformName, KqForgeConfig } from "../config/schema.js";
import { KqForgeConfigSchema } from "../config/schema.js";

export interface AddPlatformOptions {
  targetDir: string;
  platform: PlatformName;
}

export interface AddPlatformResult {
  success: boolean;
  message: string;
}

/**
 * 添加平台适配器到已初始化的项目
 */
export async function addPlatform(
  options: AddPlatformOptions
): Promise<AddPlatformResult> {
  const { targetDir, platform } = options;

  // 检查是否已初始化
  const configPath = join(targetDir, ".kqforge", "config.yaml");
  if (!existsSync(configPath)) {
    return {
      success: false,
      message: "项目未初始化。请先运行 kq-forge init。",
    };
  }

  // 读取并解析配置
  const raw = await readFile(configPath, "utf-8");
  const parsed = parseYaml(raw);
  const config = KqForgeConfigSchema.parse(parsed) as KqForgeConfig;

  // 检查是否已添加
  if (config.platforms.includes(platform)) {
    return {
      success: false,
      message: `平台 "${platform}" 已存在于配置中。`,
    };
  }

  // 添加平台
  config.platforms.push(platform);

  // 写回配置
  await writeFile(configPath, stringifyYaml(config), "utf-8");

  // 创建平台配置目录
  const platformsDir = join(targetDir, ".kqforge", "platforms");
  await mkdir(platformsDir, { recursive: true });

  return {
    success: true,
    message: `平台 "${platform}" 已添加。`,
  };
}
