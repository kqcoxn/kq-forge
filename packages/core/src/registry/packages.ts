/**
 * 场景包注册表
 */
export interface PackageInfo {
  name: string;
  description: string;
  skills: string[];
  workflows: string[];
}

export const PACKAGES: PackageInfo[] = [
  {
    name: "frontend",
    description: "前端开发场景包（TypeScript、React、CSS、无障碍）",
    skills: ["typescript", "frontend-ui"],
    workflows: [],
  },
  {
    name: "api",
    description: "API 开发场景包（API 设计、数据库、安全）",
    skills: ["api", "database", "security-advanced"],
    workflows: [],
  },
];

export function getPackage(name: string): PackageInfo | undefined {
  return PACKAGES.find((p) => p.name === name);
}

export function listPackages(): PackageInfo[] {
  return PACKAGES;
}
