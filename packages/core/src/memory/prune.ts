import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

export interface PruneResult {
  /** 每个文件的清理结果 */
  pruned: { file: string; removed: number }[];
  /** 总共删除的条目数 */
  totalRemoved: number;
}

/**
 * 条目正则：匹配 `- [YYYY-MM-DD] 内容` 格式
 */
const ENTRY_PATTERN = /^- \[\d{4}-\d{2}-\d{2}\] .+$/;

/**
 * 清理超出 max_entries 限制的旧记忆条目。
 *
 * 逻辑：
 * 1. 读取 .kqforge/memory/ 下所有 .md 文件
 * 2. 解析每个文件的条目（按 `- [` 开头识别）
 * 3. 如果条目数 > maxEntries，保留最新的 N 条（文件末尾的视为最新）
 * 4. 回写文件（保留 frontmatter 不动）
 */
export async function pruneMemories(
  projectRoot: string,
  maxEntries: number
): Promise<PruneResult> {
  const memoryDir = join(projectRoot, ".kqforge", "memory");
  const result: PruneResult = { pruned: [], totalRemoved: 0 };

  if (!existsSync(memoryDir)) {
    return result;
  }

  const entries = await readdir(memoryDir, { withFileTypes: true });
  const mdFiles = entries.filter(
    (e) => e.isFile() && e.name.endsWith(".md")
  );

  for (const file of mdFiles) {
    const filePath = join(memoryDir, file.name);
    const raw = await readFile(filePath, "utf-8");
    const { data: frontmatter, content } = matter(raw);

    // 解析条目：每行一个，匹配 ENTRY_PATTERN
    const lines = content.split("\n");
    const entryLines: string[] = [];
    const nonEntryLines: string[] = [];

    for (const line of lines) {
      if (ENTRY_PATTERN.test(line.trim())) {
        entryLines.push(line);
      } else {
        nonEntryLines.push(line);
      }
    }

    if (entryLines.length <= maxEntries) {
      continue; // 未超限，跳过
    }

    // 保留最新的 N 条（末尾的是最新的）
    const removed = entryLines.length - maxEntries;
    const keptEntries = entryLines.slice(removed);

    // 重建文件内容
    const newContent = [...nonEntryLines.filter((l) => l.trim() !== ""), ...keptEntries].join("\n") + "\n";

    // 重建完整文件（frontmatter + content）
    const hasFrontmatter = Object.keys(frontmatter).length > 0;
    let output: string;
    if (hasFrontmatter) {
      output = matter.stringify(newContent, frontmatter);
    } else {
      output = newContent;
    }

    await writeFile(filePath, output, "utf-8");
    result.pruned.push({ file: file.name, removed });
    result.totalRemoved += removed;
  }

  return result;
}
