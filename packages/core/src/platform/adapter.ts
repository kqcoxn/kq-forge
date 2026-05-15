import type {
  KqForgeConfig,
  AgentDefinition,
  SkillDefinition,
  WorkflowDefinition,
  PlatformConfig,
  PlatformName,
} from "../config/schema.js";

export interface SyncContext {
  /** 项目根目录 */
  projectRoot: string;
  /** KQ-Forge 主配置 */
  config: KqForgeConfig;
  /** 所有 Agent 定义 */
  agents: AgentDefinition[];
  /** 所有 Skill 定义 */
  skills: SkillDefinition[];
  /** 所有 Workflow 定义 */
  workflows: WorkflowDefinition[];
  /** 平台特定配置 */
  platformConfig: PlatformConfig;
  /** AGENTS.template.md 模板内容（用户可自定义） */
  template: string;
  /** .kqforge/custom-rules.md 的原始内容（为空字符串时不渲染） */
  customRules: string;
}

export interface SyncResult {
  /** 生成/更新的文件列表 */
  files: { path: string; action: "created" | "updated" | "skipped" }[];
  /** 警告信息 */
  warnings: string[];
}

export interface PlatformAdapter {
  /** 平台标识 */
  readonly name: PlatformName;

  /** 将 KQ-Forge 配置同步到平台原生格式 */
  sync(context: SyncContext): Promise<SyncResult>;

  /** 获取平台默认配置 */
  getDefaultConfig(): PlatformConfig;
}
