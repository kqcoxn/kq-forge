import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  clean: true,
  splitting: false,
  // 把 workspace 内部包打包进 bundle
  noExternal: [
    "@kq-forge/core",
    "@kq-forge/platform-opencode",
    "@kq-forge/platform-codex",
    "@kq-forge/platform-claude-code",
  ],
  // 第三方依赖保持 external（由根 package.json dependencies 提供）
  external: [
    "yaml",
    "zod",
    "gray-matter",
    "citty",
    "consola",
  ],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
