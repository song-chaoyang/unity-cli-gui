# Unity CLI GUI — uTools 插件

将 [Unity CLI](https://unity.com) 的全部能力封装为 uTools 插件，覆盖编辑器管理、项目管理、构建、测试、MCP/AI 等 36 个 CLI 顶级命令（104 个接口）。

## 架构（共享源码）

```
UnityCLIGUI/                     # 仓库根目录
├── src/                         # 共享前端源码（单一来源）
│   ├── shims/                   # uTools 专用垫片（Tauri 构建自动排除）
│   ├── lib/tauri.ts             # 104 个命令的唯一逻辑来源
│   └── ...                      # components/ pages/ stores/ i18n/ 等
├── src-tauri/                   # Tauri Rust 后端（仅 18 个通用命令）
├── utools/                      # uTools 打包层（薄配置）
│   ├── plugin.json               # 开发模式：main 指向 dev server (localhost:1421)
│   ├── plugin.release.json       # 发布模式：main 指向 dist/index.html
│   ├── preload.js                # Node.js 后端（仅 18 个通用命令）
│   ├── vite.config.ts            # root: '..', shim aliases, dev server :1421, build
│   └── dist/                     # 生产构建产物
├── package.json                 # 统一依赖 + dev/build 脚本
├── tailwind.config.js  postcss.config.js  # 共享样式配置
└── index.html                   # 共享入口
```

**核心思路**：`src/` 是唯一前端源码，Tauri 和 uTools 两个渠道共享。uTools 通过 Vite alias 将 `@tauri-apps/*` 重定向到 `src/shims/` 垫片，垫片把调用转发给 `preload.js`（Node.js）中的 `window.unityAPI`。

## 开发（重要：无需构建，改完即生效）

```bash
# 启动 dev server（端口 1421，HMR 热更新）
pnpm dev:utools
```

保持 dev server 运行。`utools/plugin.json` 的 `main` 已指向 `http://localhost:1421`。

然后在 uTools 开发者工具中添加插件，选择 `utools/` 目录。

**改代码 → 保存 → uTools 界面热更新（HMR 即时生效）。** 无需重启 uTools，更无需手动执行任何 build 命令。

> 只改 `preload.js`（Node 后端）时需要重启 uTools，或重启 dev server —— 因为 preload 是在插件加载时注入的，HMR 不覆盖它。

## 发布 / 上架

```bash
# 1. 生产构建
pnpm build:utools

# 2. 把插件入口切回生产构建
cp utools/plugin.release.json utools/plugin.json

# 3. 在 uTools 开发者工具中打包 .upx，提交市场
```

发布完成后，如需回到开发模式，把 `main` 改回 `http://localhost:1421` 即可。

## 触发词

`unity`、`Unity CLI`、`Unity编辑器`、`Unity GUI`、`Unity管理`、`Unity Hub`

## 平台

macOS (darwin)、Windows (win32)、Linux