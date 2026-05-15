export interface TemplateVars {
  /** 入口文件名（AGENTS.md 或 CLAUDE.md） */
  ENTRY_FILENAME: string;
  /** 默认 autonomy 等级 */
  DEFAULT_AUTONOMY: string;
  /** 对抗轮次上限 */
  ROUND_CAP: string;
  /** 自定义规则内容（为空字符串时模板中该区域整体消失） */
  CUSTOM_RULES: string;
  /** Agents 表格 */
  AGENTS_TABLE: string;
  /** Skills 表格 */
  SKILLS_TABLE: string;
  /** Workflows 表格 */
  WORKFLOWS_TABLE: string;
}

/**
 * 将模板中的 {{PLACEHOLDER}} 替换为实际内容
 */
export function renderTemplate(template: string, vars: TemplateVars): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}
