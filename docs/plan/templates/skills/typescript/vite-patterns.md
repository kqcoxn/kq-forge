---
name: vite-patterns
type: capability
package: typescript
description: Vite 构建工具模式，涵盖项目配置、代码分割、环境变量、代理、插件开发、库模式与 SSR。
---

# Vite 构建工具模式

## 核心原则

1. **开发体验优先** — 利用原生 ESM 实现极速 HMR
2. **按需加载** — 合理分割代码块，减少首屏体积
3. **配置最小化** — 利用约定优于配置，只覆盖必要项
4. **生产优化** — Tree Shaking、压缩、预加载提示

## 项目配置

### React 项目

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@utils': resolve(__dirname, 'src/utils'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
```

### Vue 项目

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({ imports: ['vue', 'vue-router', 'pinia'] }),
    Components({ dirs: ['src/components'] }),
  ],
});
```

## 代码分割与 Tree Shaking

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // 手动分割代码块
        manualChunks: {
          // 第三方库单独打包
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          utils: ['date-fns', 'lodash-es'],
        },
      },
    },
    // 块大小警告阈值
    chunkSizeWarningLimit: 500,
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 生成 sourcemap（生产环境可选）
    sourcemap: false,
  },
});

// 动态导入实现路由级代码分割
const routes = [
  {
    path: '/dashboard',
    component: () => import('./pages/Dashboard'), // 独立 chunk
  },
  {
    path: '/settings',
    component: () => import('./pages/Settings'),
  },
];

// 基于条件的动态分割
function manualChunks(id: string) {
  if (id.includes('node_modules')) {
    if (id.includes('chart.js') || id.includes('d3')) {
      return 'charts'; // 图表库单独打包
    }
    return 'vendor';
  }
}
```

## 环境变量

```typescript
// .env 文件
// VITE_ 前缀的变量会暴露给客户端
// VITE_API_URL=https://api.example.com
// VITE_APP_TITLE=我的应用
// DB_PASSWORD=secret  ← 不会暴露给客户端

// env.d.ts — 类型声明
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_TITLE: string;
  readonly VITE_ENABLE_ANALYTICS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// 使用环境变量
const apiUrl = import.meta.env.VITE_API_URL;
const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;

// 多环境配置
// .env.development — 开发环境
// .env.staging — 预发布环境
// .env.production — 生产环境
// 启动命令: vite --mode staging
```

## 代理配置

```typescript
// vite.config.ts — 开发服务器代理
export default defineConfig({
  server: {
    proxy: {
      // 简单代理
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // 路径重写
      '/service': {
        target: 'http://localhost:9000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/service/, ''),
      },
      // WebSocket 代理
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
      // 带认证的代理
      '/auth-api': {
        target: 'https://api.example.com',
        changeOrigin: true,
        headers: {
          'X-Custom-Header': 'value',
        },
      },
    },
  },
});
```

## 插件开发

```typescript
import type { Plugin, ResolvedConfig } from 'vite';

// 自定义插件 — 自动生成路由
function autoRoutes(): Plugin {
  let config: ResolvedConfig;

  return {
    name: 'vite-plugin-auto-routes',
    // 插件执行顺序
    enforce: 'pre',

    // 获取解析后的配置
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    // 转换模块内容
    transform(code, id) {
      if (id.endsWith('routes.generated.ts')) {
        // 扫描 pages 目录生成路由配置
        const routes = scanPages(config.root);
        return generateRouteCode(routes);
      }
    },

    // 开发服务器钩子
    configureServer(server) {
      // 监听文件变化，触发 HMR
      server.watcher.on('add', (file) => {
        if (file.includes('/pages/')) {
          const module = server.moduleGraph.getModuleById('routes.generated.ts');
          if (module) server.moduleGraph.invalidateModule(module);
        }
      });
    },

    // 构建钩子
    buildStart() {
      console.log('构建开始...');
    },
  };
}

// 虚拟模块插件
function virtualModule(): Plugin {
  const virtualId = 'virtual:app-config';
  const resolvedVirtualId = '\0' + virtualId;

  return {
    name: 'vite-plugin-virtual',
    resolveId(id) {
      if (id === virtualId) return resolvedVirtualId;
    },
    load(id) {
      if (id === resolvedVirtualId) {
        return `export const config = ${JSON.stringify({ version: '1.0.0' })}`;
      }
    },
  };
}
```

## 库模式

```typescript
// vite.config.ts — 打包为库
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MyLib',
      formats: ['es', 'cjs'],
      fileName: (format) => `my-lib.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      // 外部化不打包的依赖
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
});

// package.json 配置
// {
//   "type": "module",
//   "main": "./dist/my-lib.cjs",
//   "module": "./dist/my-lib.mjs",
//   "types": "./dist/index.d.ts",
//   "exports": {
//     ".": {
//       "import": "./dist/my-lib.mjs",
//       "require": "./dist/my-lib.cjs",
//       "types": "./dist/index.d.ts"
//     }
//   }
// }
```

## SSR 配置

```typescript
// vite.config.ts
export default defineConfig({
  ssr: {
    // 不打包的外部依赖（Node.js 运行时加载）
    external: ['express'],
    // 强制打包的依赖（ESM 兼容问题）
    noExternal: ['some-esm-only-package'],
  },
});

// server.ts — SSR 入口
import express from 'express';
import { createServer as createViteServer } from 'vite';

async function createServer() {
  const app = express();

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });

  app.use(vite.middlewares);

  app.use('*', async (req, res) => {
    const url = req.originalUrl;
    // 加载服务端入口
    const { render } = await vite.ssrLoadModule('/src/entry-server.tsx');
    const html = await render(url);
    res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
  });

  app.listen(3000);
}

createServer();
```

## HMR 模式

```typescript
// 自定义 HMR 处理
if (import.meta.hot) {
  // 接受自身模块更新
  import.meta.hot.accept();

  // 接受依赖模块更新
  import.meta.hot.accept('./module.ts', (newModule) => {
    if (newModule) {
      // 使用新模块
      updateState(newModule.default);
    }
  });

  // 清理副作用
  import.meta.hot.dispose((data) => {
    // 保存状态供下次 HMR 使用
    data.savedState = currentState;
    // 清理定时器、事件监听等
    clearInterval(timer);
  });

  // 恢复状态
  if (import.meta.hot.data.savedState) {
    restoreState(import.meta.hot.data.savedState);
  }
}
```

## 构建分析

```typescript
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    // 生成构建分析报告
    visualizer({
      open: true,
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    // 报告压缩后大小
    reportCompressedSize: true,
    // 最小化配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 移除 console
        drop_debugger: true,
      },
    },
  },
});
```

## 路径别名配置

```typescript
// vite.config.ts
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '~': resolve(__dirname, 'src'),
    },
  },
});

// tsconfig.json — 同步配置
// {
//   "compilerOptions": {
//     "baseUrl": ".",
//     "paths": {
//       "@/*": ["src/*"],
//       "~/*": ["src/*"]
//     }
//   }
// }
```

## 检查清单

- [ ] 路径别名在 vite.config.ts 和 tsconfig.json 中同步配置
- [ ] 环境变量使用 VITE_ 前缀暴露给客户端，敏感信息不加前缀
- [ ] 第三方库通过 manualChunks 合理分割
- [ ] 路由级组件使用动态 import 实现懒加载
- [ ] 开发代理配置正确，避免 CORS 问题
- [ ] 库模式正确配置 external 和 exports
- [ ] 构建产物使用 visualizer 分析，无异常大块
- [ ] 生产构建移除 console 和 debugger
- [ ] SSR 配置区分 external 和 noExternal
- [ ] HMR 自定义处理正确清理副作用
