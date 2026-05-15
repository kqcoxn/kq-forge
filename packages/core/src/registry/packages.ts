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
  {
    name: "python",
    description: "Python 全栈开发场景包（编码规范、测试策略、Web 框架最佳实践）",
    skills: ["python"],
    workflows: [],
  },
  {
    name: "golang",
    description: "Go 语言开发场景包（惯用模式、项目布局、并发与测试）",
    skills: ["golang"],
    workflows: [],
  },
  {
    name: "rust",
    description: "Rust 开发场景包（所有权、错误处理、trait 设计、并发与测试）",
    skills: ["rust"],
    workflows: [],
  },
  {
    name: "java",
    description: "Java/Kotlin 全栈开发场景包（编码规范、Spring Boot、JPA、测试）",
    skills: ["java"],
    workflows: [],
  },
  {
    name: "cpp",
    description: "现代 C++（17/20）开发场景包（编码规范、RAII、智能指针与测试）",
    skills: ["cpp"],
    workflows: [],
  },
  {
    name: "dotnet",
    description: ".NET/C#/F# 开发场景包（框架模式与测试策略）",
    skills: ["dotnet"],
    workflows: [],
  },
  {
    name: "mobile",
    description: "移动端开发场景包（Android、iOS、跨平台框架模式）",
    skills: ["mobile"],
    workflows: [],
  },
  {
    name: "devops",
    description: "DevOps 场景包（CI/CD、容器化、部署策略与生产审计）",
    skills: ["devops"],
    workflows: [],
  },
  {
    name: "ai-ml",
    description: "AI/ML 开发场景包（LLM 管道、ML 工作流、Prompt 优化、PyTorch 模式）",
    skills: ["ai-ml"],
    workflows: [],
  },
  {
    name: "documentation",
    description: "文档工程场景包（代码导览与新人上手指南）",
    skills: ["documentation"],
    workflows: [],
  },
  {
    name: "performance",
    description: "性能工程场景包（基准测试、性能剖析与优化清单）",
    skills: ["performance"],
    workflows: [],
  },
  {
    name: "workflow-advanced",
    description: "高级工作流场景包（架构决策记录与搜索优先策略）",
    skills: ["workflow-advanced"],
    workflows: [],
  },
];

export function getPackage(name: string): PackageInfo | undefined {
  return PACKAGES.find((p) => p.name === name);
}

export function listPackages(): PackageInfo[] {
  return PACKAGES;
}
