import { z } from "zod";

// ============================================================
// 共享类型
// ============================================================

export const AutonomyLevel = z.enum(["L0", "L1", "L2", "L3"]);
export type AutonomyLevel = z.infer<typeof AutonomyLevel>;

export const PlatformName = z.enum(["claude-code", "opencode", "codex"]);
export type PlatformName = z.infer<typeof PlatformName>;

export const QualityModel = z.enum(["triangle", "linear", "none"]);
export type QualityModel = z.infer<typeof QualityModel>;

// ============================================================
// 主配置 .kqforge/config.yaml
// ============================================================

export const ProjectSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

export const DefaultsSchema = z.object({
  autonomy: AutonomyLevel.default("L1"),
  workflow: z.string().default("feature"),
  round_cap: z.number().int().min(1).max(10).default(3),
  reflect_on_error: z.boolean().default(true),
  language: z.string().default("zh-CN"),
});

export const MemoryConfigSchema = z.object({
  auto_capture: z.boolean().default(true),
  max_entries_per_file: z.number().int().min(10).max(200).default(50),
  categories: z.array(z.string()).default(["rules", "facts", "lessons"]),
});

export const QualityConfigSchema = z.object({
  model: QualityModel.default("triangle"),
  acceptance_criteria: z.boolean().default(true),
  round_cap: z.number().int().min(1).max(10).optional(),
});

export const DisabledSchema = z.object({
  agents: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  workflows: z.array(z.string()).default([]),
});

export const OverrideSchema = z.object({
  match: z.string().optional(),
  task: z.string().optional(),
  autonomy: AutonomyLevel.optional(),
  workflow: z.string().optional(),
  round_cap: z.number().int().min(1).max(10).optional(),
  quality: QualityModel.optional(),
});

export const KqForgeConfigSchema = z.object({
  version: z.literal(1),
  project: ProjectSchema,
  defaults: DefaultsSchema.default({}),
  platforms: z.array(PlatformName).default([]),
  memory: MemoryConfigSchema.default({}),
  quality: QualityConfigSchema.default({}),
  disabled: DisabledSchema.default({}),
  overrides: z.array(OverrideSchema).default([]),
});

export type KqForgeConfig = z.infer<typeof KqForgeConfigSchema>;

// ============================================================
// Agent 定义 frontmatter
// ============================================================

export const AgentFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  description: z.string().optional(),
  scope: z.union([z.string(), z.array(z.string())]),
  autonomy: AutonomyLevel.default("L1"),
  required_skills: z.array(z.string()),
  optional_skills: z.array(z.string()).default([]),
  delegates_to: z.array(z.string()).default([]),
  triggers: z
    .array(
      z.object({
        event: z.string(),
        condition: z.string().optional(),
      })
    )
    .default([]),
});

export type AgentFrontmatter = z.infer<typeof AgentFrontmatterSchema>;

export interface AgentDefinition {
  frontmatter: AgentFrontmatter;
  body: string;
  filePath: string;
}

// ============================================================
// Skill 定义 frontmatter
// ============================================================

export const SkillFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  description: z.string().optional(),
  type: z.enum(["constraint", "capability"]),
  applies_to: z.union([z.string(), z.array(z.string())]).optional(),
  priority: z.number().int().min(0).max(100).default(50),
  depends_on: z.array(z.string()).default([]),
});

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

export interface SkillDefinition {
  frontmatter: SkillFrontmatter;
  body: string;
  filePath: string;
  /** 子文件内容（多文件 skill） */
  subFiles?: { name: string; content: string }[];
}

// ============================================================
// Workflow 定义 frontmatter
// ============================================================

export const WorkflowStepSchema = z.object({
  agent: z.string(),
  action: z.string(),
  autonomy: AutonomyLevel.optional(),
  round_cap: z.number().int().min(1).max(10).optional(),
  gate: z
    .object({
      enabled: z.boolean().default(true),
      min_autonomy: AutonomyLevel.default("L1"),
      message: z.string().optional(),
    })
    .optional(),
  on_fail: z.enum(["retry", "skip", "abort", "escalate"]).default("retry"),
  task_tag: z.string().optional(),
  condition: z.string().optional(),
});

export const WorkflowFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  description: z.string().optional(),
  triggers: z.array(z.string()).default([]),
  steps: z.array(WorkflowStepSchema).min(1),
  on_complete: z.enum(["reflect", "summarize", "none"]).default("reflect"),
  loop: z
    .object({
      enabled: z.boolean().default(false),
      max_iterations: z.number().int().min(1).default(5),
      until: z.string().optional(),
    })
    .optional(),
});

export type WorkflowFrontmatter = z.infer<typeof WorkflowFrontmatterSchema>;

export interface WorkflowDefinition {
  frontmatter: WorkflowFrontmatter;
  body: string;
  filePath: string;
}

// ============================================================
// 平台适配器配置
// ============================================================

export const PlatformOutputSchema = z.object({
  directory: z.string(),
  entry_file: z.string().optional(),
  agent_format: z.enum(["single-file", "directory"]).default("single-file"),
});

export const PlatformMappingSchema = z.object({
  autonomy_to_mode: z.record(z.string()).optional(),
  skill_injection: z.enum(["inline", "reference", "append"]).default("inline"),
});

export const PlatformSyncSchema = z.object({
  auto: z.boolean().default(true),
  watch: z.boolean().default(false),
  on_conflict: z.enum(["overwrite", "merge", "ask"]).default("overwrite"),
});

export const PlatformConfigSchema = z.object({
  platform: PlatformName,
  output: PlatformOutputSchema,
  mapping: PlatformMappingSchema.default({}),
  sync: PlatformSyncSchema.default({}),
  platform_specific: z.record(z.unknown()).default({}),
});

export type PlatformConfig = z.infer<typeof PlatformConfigSchema>;
