// Config
export {
  KqForgeConfigSchema,
  AgentFrontmatterSchema,
  SkillFrontmatterSchema,
  WorkflowFrontmatterSchema,
  PlatformConfigSchema,
  AutonomyLevel,
  PlatformName,
  QualityModel,
} from "./config/schema.js";
export type {
  KqForgeConfig,
  AgentFrontmatter,
  AgentDefinition,
  SkillFrontmatter,
  SkillDefinition,
  WorkflowFrontmatter,
  WorkflowDefinition,
  PlatformConfig,
} from "./config/schema.js";

export {
  loadConfig,
  loadAgent,
  loadSkill,
  loadWorkflow,
  loadPlatformConfig,
  isInitialized,
} from "./config/loader.js";

export { validateProject } from "./config/validator.js";
export type { ValidationIssue, ValidationResult } from "./config/validator.js";

// Scaffold
export { initProject, getTemplateRoot } from "./scaffold/init.js";
export type { InitOptions, InitResult } from "./scaffold/init.js";

export { addPlatform } from "./scaffold/add-platform.js";
export type { AddPlatformOptions, AddPlatformResult } from "./scaffold/add-platform.js";

export { addPackage } from "./scaffold/add-package.js";
export type { AddPackageOptions, AddPackageResult } from "./scaffold/add-package.js";

// Platform
export type { PlatformAdapter, SyncContext, SyncResult } from "./platform/adapter.js";

// Context
export { loadProjectContext } from "./context.js";

// Template
export { renderTemplate } from "./template.js";
export type { TemplateVars } from "./template.js";

// Registry
export { listPackages, getPackage } from "./registry/packages.js";
export type { PackageInfo } from "./registry/packages.js";
