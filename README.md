# Unity CLI GUI

A cross-platform desktop GUI for the [Unity CLI](https://discussions.unity.com/threads/unity-cli.1640035/) tool, built with **Tauri 2 + React + TypeScript**.

[中文文档](./README_zh.md) | English

## Screenshots

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)

The dashboard provides an overview of your Unity environment:
- **Installed editors count** with default version info
- **Projects count** with pinned count
- **Running editors** with live status indicator
- **Cache size** with file count
- **Recent projects** with one-click quick open shortcuts
- **Quick actions** for common tasks

### Projects Management
![Projects](docs/screenshots/projects.png)

The projects page features:
- **Expandable card list** — click any project to expand details
- **Inline version switching** — click the version number to switch editor version directly
- **Inline target platform switching** — click the target to change build platform
- **Git info display** — branch name, repo URL, and dirty/clean status on each row
- **Project size** — displayed directly on each project card
- **Right-click context menu** — Open, Open with Parameters, Reveal in File Manager, Open in Terminal, Open in Code Editor, Copy Path, Project Settings, Check Editor, Disk Usage, Upgrade Version, Pin/Unpin, Remove from Hub
- **Search** — filter projects by name, version, or path
- **Sort** — by name, version, or modified date
- **Custom metadata** — custom names, icons (emoji/color/image), notes, and open parameters

### AI Chat
![AI Chat](docs/screenshots/aichat.png)

The AI Chat module allows controlling Unity through natural language:
- **4-tab settings panel**: General, Models, MCP Services, Skills
- **Custom models** — add/remove models with per-model Base URL and provider
- **Auto-save** — all settings persist automatically
- **Temperature, max tokens, context window** controls
- **Third-party MCP services** — configure via Form, JSON paste, or direct config file editing
- **Custom skills/prompts** — define reusable AI skill prompts
- **"Add via AI"** — let the AI assistant help configure MCP services and skills
- **Command auto-execution** — AI responses containing CLI commands are automatically executed with results shown inline

### Editors
![Editors](docs/screenshots/editors.png)

Manage Unity editor installations:
- **Installed editors** list with version, architecture, modules, and path
- **Available releases** with LTS filter and stream filter
- **Running editors** with live port/PID/project status
- **Install dialog** with version, architecture, and module selection
- **Module management** — add/remove modules per editor
- **Upgrade detection** — shows available patch upgrades

### Build & Test
![Build](docs/screenshots/build.png)

Configure and run project builds and tests:
- **Build configuration** with all CLI options (target, execute method, output path, Android options, versioning)
- **Live log streaming** with search filter and pause/resume
- **Test configuration** for EditMode/PlayMode tests
- **Command preview** — see the equivalent CLI command before executing

### MCP / AI Integration
![MCP/AI](docs/screenshots/mcp.png)

Configure AI agent clients and monitor Pipeline:
- **Connected editors** with live status
- **MCP client configuration** for 15+ AI clients (Claude, Cursor, VS Code, Codex, etc.)
- **Pipeline package status** with install/upgrade actions
- **Custom commands** browser and executor

### Settings
![Settings](docs/screenshots/settings.png)

Comprehensive settings including:
- **License management** — activate (Personal/Serial/Floating), return, status
- **Theme** — Dark/Light/System
- **Language** — 10 languages with real-time switching
- **Proxy configuration**
- **Editor install path** with file picker
- **Cache management** with clean button
- **CLI management** — check updates, upgrade, view changelog
- **Hub detection** — install/uninstall Unity Hub
- **Diagnostics** — doctor and diagnose reports

## Features

### Core
- **12 pages**: Dashboard, Editors, Projects, Build, Test, MCP/AI, AI Chat, Downloads, Terminal, Logs, Settings, About
- **50+ Unity CLI commands** wrapped via Rust backend
- **i18n**: 10 languages (English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Español, Français, Português, Русский) with system language detection
- **Theme**: Dark, Light, and System-follow modes

### AI Chat
- Natural language → Unity CLI command execution
- OpenAI-compatible API gateway support
- Custom models with per-model Base URL
- Third-party MCP services (Form/JSON/File editing modes)
- Custom skills/prompts
- Auto-save settings

### Project Management
- Add existing project folders via system file picker
- Custom project names, icons (emoji/color/image), and notes
- Inline version and target platform switching
- Git info display (branch, repo, dirty status)
- Project size display
- Expandable card view with full details
- Right-click context menu with 11+ actions
- Search and sort

### System Integration
- **macOS**: `⌘,` shortcut to Settings, Terminal integration
- **Windows**: `Ctrl+,` shortcut, cmd terminal integration
- **Linux**: Multi-terminal support, xdg integration
- **Code editor**: VS Code / Cursor / Zed auto-detection
- System file picker for folder selection
- Reveal in file manager (Finder/Explorer/File Manager)

## Prerequisites

- [Node.js](https://nodejs.org/) v18+ (v24 recommended)
- [pnpm](https://pnpm.io/) v9+
- [Rust](https://rustup.rs/) (stable toolchain)
- [Unity CLI](https://discussions.unity.com/threads/unity-cli.1640035/) installed and on PATH

### Platform-specific requirements

| Platform | Requirements |
|----------|-------------|
| macOS | Xcode Command Line Tools |
| Linux | `webkit2gtk-4.1`, `libgtk-3`, `libayatana-appindicator3` |
| Windows | Microsoft Visual C++ Build Tools, WebView2 |

## Getting Started

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm tauri dev

# Build for production
pnpm tauri build
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Framework | Tauri 2.0 |
| Frontend | React 18 + TypeScript |
| Backend | Rust |
| UI | Tailwind CSS + Custom Components |
| State Management | Zustand |
| HTTP Client | reqwest (Rust) |
| Build Tool | Vite 5 |

## Architecture

```
┌─────────────────────────────────────────┐
│         React + TypeScript (Frontend)     │
│  Dashboard │ Editors │ Projects │ AI Chat │
└───────────────────┬─────────────────────┘
                    │ Tauri IPC
┌───────────────────┴─────────────────────┐
│              Rust Backend (Tauri)         │
│  cli_executor │ streaming_process        │
│  ai_chat │ file_io │ git_info            │
└───────────────────┬─────────────────────┘
                    │ spawn
┌───────────────────┴─────────────────────┐
│          Unity CLI (`unity` binary)       │
└─────────────────────────────────────────┘
```

## License

MIT
