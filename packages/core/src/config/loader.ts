import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import matter from "gray-matter";
import {
  KqForgeConfigSchema,
  AgentFrontmatterSchema,
  SkillFrontmatterSchema,
  WorkflowFrontmatterSchema,
  PlatformConfigSchema,
  type KqForgeConfig,
  type AgentDefinition,
  type SkillDefinition,
  type WorkflowDefinition,
  type PlatformConfig,
} from "./schema.js";

/**
 * 加载并校验 .kqforge/config.yaml
 */
export async function loadConfig(projectRoot: string): Promise<KqForgeConfig> {
  const configPath = join(projectRoot, ".kqforge", "config.yaml");
  if (!existsSync(configPath)) {
    throw new Error(`配置文件不存在: ${configPath}`);
  }
  const raw = await readFile(configPath, "utf-8");
  const parsed = parseYaml(raw);
  return KqForgeConfigSchema.parse(parsed);
}

/**
 * 加载单个 Agent 定义文件
 */
export async function loadAgent(filePath: string): Promise<AgentDefinition> {
  const raw = await readFile(filePath, "utf-8");
  const { data, content } = matter(raw);
  const frontmatter = AgentFrontmatterSchema.parse(data);
  return { frontmatter, body: content.trim(), filePath };
}

/**
 * 加载单个 Skill 定义文件
 */
export async function loadSkill(filePath: string): Promise<SkillDefinition> {
  const raw = await readFile(filePath, "utf-8");
  const { data, content } = matter(raw);
  const frontmatter = SkillFrontmatterSchema.parse(data);
  return { frontmatter, body: content.trim(), filePath };
}

/**
 * 加载单个 Workflow 定义文件
 */
export async function loadWorkflow(
  filePath: string
): Promise<WorkflowDefinition> {
  const raw = await readFile(filePath, "utf-8");
  const { data, content } = matter(raw);
  const frontmatter = WorkflowFrontmatterSchema.parse(data);
  return { frontmatter, body: content.trim(), filePath };
}

/**
 * 加载平台配置
 */
export async function loadPlatformConfig(
  filePath: string
): Promise<PlatformConfig> {
  const raw = await readFile(filePath, "utf-8");
  const parsed = parseYaml(raw);
  return PlatformConfigSchema.parse(parsed);
}

/**
 * 检查项目是否已初始化
 */
export function isInitialized(projectRoot: string): boolean {
  return existsSync(join(projectRoot, ".kqforge", "config.yaml"));
}
