import { loadProjectContext } from "@kq-forge/core";
import type { PlatformAdapter, SyncResult, PlatformName } from "@kq-forge/core";
import { OpenCodeAdapter } from "@kq-forge/platform-opencode";
import { ClaudeCodeAdapter } from "@kq-forge/platform-claude-code";
import { CodexAdapter } from "@kq-forge/platform-codex";

/**
 * 获取平台适配器实例
 */
function getAdapter(platform: PlatformName): PlatformAdapter {
  switch (platform) {
    case "opencode":
      return new OpenCodeAdapter();
    case "claude-code":
      return new ClaudeCodeAdapter();
    case "codex":
      return new CodexAdapter();
    default:
      throw new Error(`未知平台: ${platform}`);
  }
}

export interface SyncAllResult {
  platforms: { name: PlatformName; result: SyncResult }[];
  warnings: string[];
}

/**
 * 同步所有已启用平台的配置文件
 *
 * 从 .kqforge/ 读取源文件，调用各平台适配器生成原生格式文件。
 */
export async function syncPlatforms(projectRoot: string): Promise<SyncAllResult> {
  const context = await loadProjectContext(projectRoot);
  const allResult: SyncAllResult = { platforms: [], warnings: [] };

  if (context.config.platforms.length === 0) {
    allResult.warnings.push("未配置任何平台，跳过同步。");
    return allResult;
  }

  // 检查 AGENTS.md 冲突（OpenCode + Codex 都需要 AGENTS.md）
  const needsAgentsMd = context.config.platforms.filter(
    (p) => p === "opencode" || p === "codex"
  );
  if (needsAgentsMd.length > 1) {
    allResult.warnings.push(
      "OpenCode 和 Codex 都使用 AGENTS.md，将生成共用版本（以 OpenCode 格式为准，Codex 兼容）。"
    );
  }

  for (const platform of context.config.platforms) {
    const adapter = getAdapter(platform);
    const syncContext = {
      ...context,
      platformConfig: adapter.getDefaultConfig(),
    };
    const result = await adapter.sync(syncContext);
    allResult.platforms.push({ name: platform, result });
  }

  return allResult;
}
