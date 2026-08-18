# Unity CLI GUI

Unity CLI 命令行工具的跨平台桌面 GUI，基于 **Tauri 2 + React + TypeScript** 构建。

[English](./README.md) | 中文

## 截图

### 仪表盘
![仪表盘](docs/screenshots/dashboard.png)

仪表盘提供 Unity 环境的完整概览：
- **已安装编辑器数量**，显示默认版本信息
- **项目数量**，显示已收藏数量
- **运行中编辑器**，带实时状态指示器
- **缓存大小**，显示文件数
- **最近操作的项目**，支持一键快捷打开
- **快捷操作**，常用功能入口

### 项目管理
![项目](docs/screenshots/projects.png)

项目页面特色功能：
- **可展开卡片列表** — 点击任意项目展开详情
- **内联版本切换** — 点击版本号直接切换编辑器版本
- **内联目标平台切换** — 点击目标直接切换构建平台
- **Git 信息展示** — 每行显示分支名、仓库地址、干净/未提交状态
- **项目大小** — 直接显示在每个项目卡片上
- **右键上下文菜单** — 打开、带参数打开、在文件管理器中显示、在终端中打开、在代码编辑器中打开、复制路径、项目设置、检查编辑器、磁盘占用、升级版本、固定/取消固定、从 Hub 移除
- **搜索** — 按名称、版本或路径过滤项目
- **排序** — 按名称、版本或修改时间排序
- **自定义元数据** — 自定义名称、图标（emoji/颜色/图片）、备注、打开参数

### AI 对话
![AI 对话](docs/screenshots/aichat.png)

AI 对话模块支持通过自然语言控制 Unity：
- **四标签设置面板**：常规、模型、MCP 服务、技能
- **自定义模型** — 添加/删除模型，每个模型独立 Base URL 和提供商
- **自动保存** — 所有设置自动持久化
- **温度、最大 Token 数、上下文窗口** 控制
- **第三方 MCP 服务** — 支持表单、JSON 粘贴、直接编辑配置文件三种模式
- **自定义技能/提示词** — 定义可复用的 AI 技能提示词
- **"通过 AI 添加"** — 让 AI 助手帮你配置 MCP 服务和技能
- **命令自动执行** — AI 回复中包含的 CLI 命令自动执行，结果内联展示

### 编辑器
![编辑器](docs/screenshots/editors.png)

管理 Unity 编辑器安装：
- **已安装编辑器**列表，显示版本、架构、模块、路径
- **可用版本**，支持 LTS 筛选和版本流筛选
- **运行中编辑器**，实时显示端口/PID/项目状态
- **安装对话框**，支持版本、架构、模块选择
- **模块管理** — 为每个编辑器添加/移除模块
- **升级检测** — 显示可用的补丁升级

### 构建与测试
![构建](docs/screenshots/build.png)

配置并运行项目构建和测试：
- **构建配置**，包含所有 CLI 选项（目标、执行方法、输出路径、Android 选项、版本控制）
- **实时日志流**，支持搜索过滤和暂停/恢复
- **测试配置**，支持 EditMode/PlayMode 测试
- **命令预览** — 执行前查看等效 CLI 命令

### MCP / AI 集成
![MCP/AI](docs/screenshots/mcp.png)

配置 AI 智能体客户端和 Pipeline 监控：
- **已连接的编辑器**，实时状态
- **MCP 客户端配置**，支持 15+ AI 客户端（Claude、Cursor、VS Code、Codex 等）
- **Pipeline 包状态**，支持安装/升级操作
- **自定义命令**浏览器和执行器

### 设置
![设置](docs/screenshots/settings.png)

全面的设置选项包括：
- **许可证管理** — 激活（Personal/序列号/浮动）、归还、状态查看
- **主题** — 深色/浅色/跟随系统
- **语言** — 10 种语言，实时切换
- **代理配置**
- **编辑器安装路径**，支持文件选择器
- **缓存管理**，支持清理
- **CLI 管理** — 检查更新、升级、查看更新日志
- **Hub 检测** — 安装/卸载 Unity Hub
- **诊断** — doctor 和 diagnose 报告

## 功能特性

### 核心功能
- **12 个页面**：仪表盘、编辑器、项目、构建、测试、MCP/AI、AI 对话、下载、终端、日志、设置、关于
- **50+ Unity CLI 命令**，通过 Rust 后端封装
- **国际化**：10 种语言（English、简体中文、繁體中文、日本語、한국어、Deutsch、Español、Français、Português、Русский），支持系统语言检测
- **主题**：深色、浅色、跟随系统

### AI 对话
- 自然语言 → Unity CLI 命令执行
- 支持 OpenAI 兼容 API 网关
- 自定义模型，每个模型独立 Base URL
- 第三方 MCP 服务（表单/JSON/文件编辑三种模式）
- 自定义技能/提示词
- 设置自动保存

### 项目管理
- 通过系统文件选择器添加现有项目文件夹
- 自定义项目名称、图标（emoji/颜色/图片）、备注
- 内联版本和目标平台切换
- Git 信息展示（分支、仓库、状态）
- 项目大小显示
- 可展开卡片视图，完整详情
- 右键上下文菜单，11+ 操作
- 搜索和排序

### 系统集成
- **macOS**：`⌘,` 快捷键打开设置、终端集成
- **Windows**：`Ctrl+,` 快捷键、cmd 终端集成
- **Linux**：多终端支持、xdg 集成
- **代码编辑器**：自动检测 VS Code / Cursor / Zed
- 系统文件选择器选择文件夹
- 在文件管理器中显示（Finder/资源管理器/文件管理器）

## 前置要求

- [Node.js](https://nodejs.org/) v18+（推荐 v24）
- [pnpm](https://pnpm.io/) v9+
- [Rust](https://rustup.rs/)（stable 工具链）
- [Unity CLI](https://discussions.unity.com/threads/unity-cli.1640035/) 已安装并在 PATH 中

### 平台特定要求

| 平台 | 要求 |
|------|------|
| macOS | Xcode Command Line Tools |
| Linux | `webkit2gtk-4.1`、`libgtk-3`、`libayatana-appindicator3` |
| Windows | Microsoft Visual C++ Build Tools、WebView2 |

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm tauri dev

# 生产构建
pnpm tauri build
```

## Web 服务器模式（无头服务器）

对于没有桌面环境的服务器（如远程 Linux 服务器、CI 机器），GUI 可以作为 **Web 服务器**运行 —— 从任意设备的浏览器访问。

### 一键安装

**Linux / macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/song-chaoyang/unity-cli-gui/main/scripts/install-web.sh | sudo bash
```

**Windows (以管理员身份运行 PowerShell):**
```powershell
irm https://raw.githubusercontent.com/song-chaoyang/unity-cli-gui/main/scripts/install-web.ps1 | iex
```

脚本自动检测平台（Linux/macOS/Windows）和架构（x64/arm64）：

| 步骤 | Linux | macOS | Windows |
|------|-------|-------|---------|
| Node.js | apt/NodeSource（x64+arm64），或 nvm 回退 | Homebrew 或 .pkg 安装包 | winget 或 .msi 下载 |
| 服务 | systemd | launchd | 计划任务 或 NSSM |
| 安装目录 | `/opt/unity-gui` | `/usr/local/unity-gui` | `C:\unity-gui` |

安装完成后，从任意浏览器访问：

```
http://<服务器IP>:8080
```

### 安装选项

```bash
# Linux/macOS
bash install-web.sh --port 9000 --dir ~/unity-gui
bash install-web.sh --update

# Windows
powershell -File install-web.ps1 -Port 9000 -Dir "C:\unity-gui"
powershell -File install-web.ps1 -Update
```

### 服务管理

**Linux (systemd):**
```bash
systemctl status  unity-gui
systemctl restart unity-gui
journalctl -u     unity-gui -f
```

**macOS (launchd):**
```bash
launchctl list          com.unity-gui
launchctl kickstart -k  com.unity-gui   # 重启
tail -f /tmp/unity-gui.log
```

**Windows (计划任务 / NSSM):**
```powershell
Start-ScheduledTask -TaskName UnityGui
Stop-ScheduledTask  -TaskName UnityGui
# NSSM: nssm start/stop/restart UnityGui
```

### 手动安装

```bash
git clone https://github.com/song-chaoyang/unity-cli-gui.git
cd unity-cli-gui
pnpm install
pnpm build:web
node web/server.mjs
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2.0 |
| Web 服务器 | Node.js（内置 `http` + SSE） |
| 前端 | React 18 + TypeScript |
| 后端 | Rust (Tauri) / Node.js (Web) |
| UI | Tailwind CSS + 自定义组件 |
| 状态管理 | Zustand |
| HTTP 客户端 | reqwest (Rust) / fetch (Web) |
| 构建工具 | Vite 5 |

## 架构

```
                           ┌─────────────┐
                           │   浏览器     │  (Web 模式 — 任意设备)
                           └──────┬──────┘
                                  │ HTTP + SSE
┌─────────────────────────────────┴───────────────────────────┐
│                    React + TypeScript (前端)                 │
│  仪表盘 │ 编辑器 │ 项目 │ 构建 │ 测试 │ AI 对话 ...         │
└───────────────────┬───────────────────────────┬──────────────┘
                    │ Tauri IPC (invoke/listen)  │ fetch/SSE
┌───────────────────┴──────────────┐ ┌──────────┴──────────────┐
│       Rust 后端 (Tauri)           │ │  Node.js 服务器 (Web)   │
│  cli_executor │ streaming_process │ │  run_unity_json │ SSE   │
│  ai_chat │ file_io │ git_info    │ │  ai_chat │ fs │ spawn   │
└───────────────────┬──────────────┘ └──────────┬──────────────┘
                    │ spawn                      │ spawn
                    └──────────┬────────────────┘
                               │
              ┌────────────────┴────────────────┐
              │     Unity CLI (`unity` 二进制)    │
              └─────────────────────────────────┘
```

前端 (`tauri.ts`) 是**唯一真相源** —— 104 条命令映射到 18 个通用原语。三个构建目标通过 Vite 别名共享同一份前端代码：

| 构建目标 | invoke() → | listen() → | open() → |
|---------|-----------|------------|---------|
| Tauri（桌面） | Rust IPC | Tauri 事件 | 原生对话框 |
| uTools | preload.js | preload.js | uTools 对话框 |
| Web（服务器） | HTTP fetch | SSE EventSource | 浏览器 prompt() |

## 许可证

MIT
