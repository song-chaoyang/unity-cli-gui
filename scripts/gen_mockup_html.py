#!/usr/bin/env python3
"""Generate individual HTML files for each page, then Edge headless screenshots."""
import os, shutil

CSS = """
* { margin:0; padding:0; box-sizing:border-box; }
body { width:1200px; height:800px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#0e1829; color:#e0e6f0; overflow:hidden; }
:root { --bg:#0e1829; --card:#142030; --sb:#0c1423; --border:#213044; --text:#e0e6f0; --muted:#8291a5; --primary:#0ea5e9; --green:#4ade80; --yellow:#fbbf24; --red:#f87171; --purple:#a855f7; --teal:#2dd4bf; --orange:#fb923c; }
.app { display:flex; flex-direction:column; height:800px; }
.topbar { height:48px; display:flex; align-items:center; gap:8px; padding:0 16px; border-bottom:1px solid var(--border); }
.sidebar { width:224px; border-right:1px solid var(--border); background:var(--sb); padding:8px 0; flex-shrink:0; }
.main { flex:1; display:flex; overflow:hidden; }
.content { flex:1; padding:16px; overflow:auto; }
.statusbar { height:28px; display:flex; align-items:center; gap:16px; padding:0 16px; border-top:1px solid var(--border); font-size:9px; color:var(--muted); }
.nav-item { display:flex; align-items:center; gap:12px; padding:10px 16px; font-size:12px; color:var(--muted); border-left:2px solid transparent; }
.nav-item.active { background:#142030; color:var(--text); border-left-color:var(--primary); }
.card { background:var(--card); border:1px solid var(--border); border-radius:8px; padding:12px; margin-bottom:12px; }
.card-title { font-size:14px; font-weight:600; margin-bottom:8px; }
.badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:4px; font-size:9px; font-weight:500; }
.badge-primary { background:rgba(14,165,233,.15); color:var(--primary); }
.badge-green { background:rgba(74,222,128,.15); color:var(--green); }
.badge-yellow { background:rgba(251,191,36,.15); color:var(--yellow); }
.badge-red { background:rgba(248,113,113,.15); color:var(--red); }
.badge-muted { background:rgba(130,145,165,.15); color:var(--muted); }
.badge-teal { background:rgba(45,212,191,.15); color:var(--teal); }
.badge-purple { background:rgba(168,85,247,.15); color:var(--purple); }
.btn { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:6px; font-size:11px; border:1px solid var(--border); background:transparent; color:var(--text); }
.btn-primary { background:var(--primary); border-color:var(--primary); color:#fff; }
.stat-card { background:var(--card); border:1px solid var(--border); border-radius:8px; padding:12px; }
.stat-value { font-size:22px; font-weight:700; }
.stat-label { font-size:11px; color:var(--muted); }
.stat-sub { font-size:9px; color:var(--muted); margin-top:2px; }
.row { display:flex; align-items:center; gap:8px; padding:8px 12px; }
.row:hover { background:rgba(33,48,68,.3); }
.mono { font-family:'SF Mono',Menlo,monospace; font-size:10px; }
.input-box { background:transparent; border:1px solid var(--border); border-radius:6px; padding:6px 10px; font-size:11px; color:var(--text); display:inline-flex; align-items:center; gap:6px; }
.chat-msg { padding:8px 12px; border-radius:8px; font-size:12px; }
.chat-user { background:var(--primary); color:#fff; max-width:60%; }
.chat-bot { background:var(--card); }
.cmd-block { background:#080e19; border-radius:6px; padding:8px 12px; font-family:'SF Mono',Menlo,monospace; font-size:10px; color:var(--teal); margin:6px 0; }
"""

NAV = [
    ("dashboard", "📊", "Dashboard"),
    ("editors", "🎮", "Editors"),
    ("projects", "📁", "Projects"),
    ("build", "🔨", "Build"),
    ("test", "🧪", "Test"),
    ("mcp", "🤖", "MCP / AI"),
    ("aichat", "💬", "AI Chat"),
    ("downloads", "⬇️", "Downloads"),
    ("terminal", "🖥️", "Terminal"),
    ("logs", "📋", "Logs"),
    ("settings", "⚙️", "Settings"),
    ("about", "ℹ️", "About"),
]

PAGES = {
"dashboard": """<h1 style="font-size:18px;font-weight:600;margin-bottom:4px;">📊 Dashboard</h1>
<p style="font-size:11px;color:var(--muted);margin-bottom:16px;">Unity CLI environment overview</p>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;">
  <div class="stat-card"><div class="stat-label">🎮 Installed Editors</div><div class="stat-value" style="color:var(--primary)">3</div><div class="stat-sub">2022.3.20f1 (default)</div></div>
  <div class="stat-card"><div class="stat-label">📁 Projects</div><div class="stat-value" style="color:var(--teal)">5</div><div class="stat-sub">2 pinned</div></div>
  <div class="stat-card"><div class="stat-label">🟢 Running Editors</div><div class="stat-value" style="color:var(--green)">1</div><div class="stat-sub">Editor active</div></div>
  <div class="stat-card"><div class="stat-label">💾 Cache Size</div><div class="stat-value" style="color:var(--orange)">2.4 GB</div><div class="stat-sub">1,247 files</div></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
  <div class="card">
    <div class="card-title">📁 Recent Projects</div>
    <div class="row">🎯 <div><div style="font-size:12px;">My Game Project</div><div style="font-size:9px;color:var(--muted);">2022.3.20f1 · Standalone</div></div><span style="margin-left:auto;font-size:11px;color:var(--muted);">2.3 GB</span></div>
    <div class="row">🏗️ <div><div style="font-size:12px;">AR Experience</div><div style="font-size:9px;color:var(--muted);">2022.3.20f1 · iOS</div></div><span style="margin-left:auto;font-size:11px;color:var(--muted);">1.8 GB</span></div>
    <div class="row">🎮 <div><div style="font-size:12px;">Mobile Runner</div><div style="font-size:9px;color:var(--muted);">2021.3.35f1 · Android</div></div><span style="margin-left:auto;font-size:11px;color:var(--muted);">950 MB</span></div>
    <div class="row">🌐 <div><div style="font-size:12px;">WebGL Demo</div><div style="font-size:9px;color:var(--muted);">2022.3.20f1 · WebGL</div></div><span style="margin-left:auto;font-size:11px;color:var(--muted);">420 MB</span></div>
  </div>
  <div class="card">
    <div class="card-title">⚡ Quick Actions</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div style="border:1px solid var(--border);border-radius:6px;padding:8px;display:flex;gap:8px;align-items:center;">📥 <div><div style="font-size:11px;">Install Editor</div><div style="font-size:9px;color:var(--muted);">Browse & install</div></div></div>
      <div style="border:1px solid var(--border);border-radius:6px;padding:8px;display:flex;gap:8px;align-items:center;">📁 <div><div style="font-size:11px;">Add Project</div><div style="font-size:9px;color:var(--muted);">Add existing folder</div></div></div>
      <div style="border:1px solid var(--border);border-radius:6px;padding:8px;display:flex;gap:8px;align-items:center;">🔨 <div><div style="font-size:11px;">Build</div><div style="font-size:9px;color:var(--muted);">Configure & run</div></div></div>
      <div style="border:1px solid var(--border);border-radius:6px;padding:8px;display:flex;gap:8px;align-items:center;">💬 <div><div style="font-size:11px;">AI Chat</div><div style="font-size:9px;color:var(--muted);">Natural language</div></div></div>
      <div style="border:1px solid var(--border);border-radius:6px;padding:8px;display:flex;gap:8px;align-items:center;">🧪 <div><div style="font-size:11px;">Run Tests</div><div style="font-size:9px;color:var(--muted);">EditMode / PlayMode</div></div></div>
      <div style="border:1px solid var(--border);border-radius:6px;padding:8px;display:flex;gap:8px;align-items:center;">⚙️ <div><div style="font-size:11px;">Settings</div><div style="font-size:9px;color:var(--muted);">Licenses & more</div></div></div>
    </div>
  </div>
</div>""",

"projects": """<h1 style="font-size:18px;font-weight:600;margin-bottom:4px;">📁 Projects</h1>
<p style="font-size:11px;color:var(--muted);margin-bottom:16px;">Manage Unity projects</p>
<div style="display:flex;gap:8px;margin-bottom:16px;">
  <div class="input-box" style="width:240px;">🔍 <span style="color:var(--muted);">Search projects...</span></div>
  <button class="btn">🔄 Refresh</button>
  <button class="btn">📁 Add Project</button>
  <button class="btn">📥 Export</button>
  <button class="btn">📤 Import</button>
</div>
<div class="card" style="padding:0;">
  <div class="row" style="border-bottom:1px solid var(--border);">
    <span style="color:var(--muted);">▾</span> 🎯 <div style="flex:1;"><div style="font-size:12px;">My Game Project</div><div style="display:flex;gap:6px;margin-top:4px;"><span class="badge badge-primary">2022.3.20f1</span><span class="badge badge-teal">Standalone</span></div></div>
    <span style="font-size:11px;color:var(--muted);">⎇ main</span> <span class="badge badge-green" style="margin-left:4px;">● clean</span> <span style="font-size:11px;color:var(--muted);margin-left:8px;">2.3 GB</span>
  </div>
  <div style="padding:8px 12px 12px 36px;border-bottom:1px solid var(--border);font-size:10px;color:var(--muted);">
    <div style="margin-bottom:4px;"><span>Path:</span> <span class="mono">/Users/demo/Projects/MyGameProject</span></div>
    <div><span>Modified:</span> 2 hours ago · <span>Modules:</span> Android, iOS, WebGL</div>
    <div style="display:flex;gap:6px;margin-top:8px;"><button class="btn btn-primary">📂 Open</button><button class="btn">⚙️ Settings</button><button class="btn">📋 Copy Path</button></div>
  </div>
  <div class="row" style="border-bottom:1px solid var(--border);"><span style="color:var(--muted);">▸</span> 🏗️ <div style="flex:1;"><div style="font-size:12px;">AR Experience</div><div style="display:flex;gap:6px;margin-top:4px;"><span class="badge badge-primary">2022.3.20f1</span><span class="badge badge-teal">iOS</span></div></div><span style="font-size:11px;color:var(--muted);">⎇ develop</span> <span style="font-size:11px;color:var(--muted);margin-left:8px;">1.8 GB</span></div>
  <div class="row" style="border-bottom:1px solid var(--border);"><span style="color:var(--muted);">▸</span> 🎮 <div style="flex:1;"><div style="font-size:12px;">Mobile Runner</div><div style="display:flex;gap:6px;margin-top:4px;"><span class="badge badge-primary">2021.3.35f1</span><span class="badge badge-teal">Android</span></div></div><span style="font-size:11px;color:var(--muted);">⎇ feature/ui</span> <span style="font-size:11px;color:var(--muted);margin-left:8px;">950 MB</span></div>
  <div class="row"><span style="color:var(--muted);">▸</span> 🌐 <div style="flex:1;"><div style="font-size:12px;">WebGL Demo</div><div style="display:flex;gap:6px;margin-top:4px;"><span class="badge badge-primary">2022.3.20f1</span><span class="badge badge-teal">WebGL</span></div></div><span style="font-size:11px;color:var(--muted);">⎇ main</span> <span style="font-size:11px;color:var(--muted);margin-left:8px;">420 MB</span></div>
</div>""",

"editors": """<h1 style="font-size:18px;font-weight:600;margin-bottom:4px;">🎮 Editors</h1>
<p style="font-size:11px;color:var(--muted);margin-bottom:16px;">Manage Unity editor installations</p>
<div style="display:flex;gap:24px;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:8px;">
  <span style="font-size:12px;color:var(--primary);border-bottom:2px solid var(--primary);padding-bottom:8px;">Installed</span>
  <span style="font-size:12px;color:var(--muted);">Available</span>
  <span style="font-size:12px;color:var(--muted);">Running</span>
  <button class="btn btn-primary" style="margin-left:auto;">📥 Install Editor</button>
</div>
<div class="card" style="padding:0;">
  <div class="row" style="border-bottom:1px solid var(--border);">
    <span style="color:var(--muted);">▾</span> <div style="flex:1;"><div style="font-size:12px;font-family:monospace;">2022.3.20f1</div><div style="display:flex;gap:6px;margin-top:4px;"><span class="badge badge-green">⭐ Default</span><span class="badge badge-muted">arm64</span></div></div>
    <span style="font-size:11px;color:var(--muted);">3 modules</span>
  </div>
  <div style="padding:8px 12px 12px 36px;border-bottom:1px solid var(--border);">
    <div style="font-size:10px;margin-bottom:4px;"><span style="color:var(--muted);">Path:</span> <span class="mono">/Applications/Unity/Hub/Editor/2022.3.20f1</span></div>
    <div style="font-size:10px;color:var(--muted);margin-bottom:8px;">Modules:</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      <span class="badge badge-green">✓ Android</span><span class="badge badge-green">✓ iOS</span><span class="badge badge-green">✓ WebGL</span><span class="badge badge-muted">+ Windows</span><span class="badge badge-muted">+ Mac</span>
    </div>
  </div>
  <div class="row" style="border-bottom:1px solid var(--border);"><span style="color:var(--muted);">▸</span> <div style="flex:1;"><div style="font-size:12px;font-family:monospace;">2021.3.35f1</div><div style="display:flex;gap:6px;margin-top:4px;"><span class="badge badge-muted">x86_64</span></div></div><span style="font-size:11px;color:var(--muted);">2 modules</span></div>
  <div class="row"><span style="color:var(--muted);">▸</span> <div style="flex:1;"><div style="font-size:12px;font-family:monospace;">2023.1.0b1</div><div style="display:flex;gap:6px;margin-top:4px;"><span class="badge badge-yellow">Beta</span><span class="badge badge-muted">arm64</span></div></div><span style="font-size:11px;color:var(--muted);">no modules</span></div>
</div>""",

"build": """<h1 style="font-size:18px;font-weight:600;margin-bottom:4px;">🔨 Build</h1>
<p style="font-size:11px;color:var(--muted);margin-bottom:16px;">Configure and run project builds</p>
<div class="card">
  <div class="card-title">⚙️ Build Configuration</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    <div><div style="font-size:9px;color:var(--muted);margin-bottom:4px;">Target Platform</div><div class="input-box" style="width:100%;">Standalone (macOS)</div></div>
    <div><div style="font-size:9px;color:var(--muted);margin-bottom:4px;">Editor Version</div><div class="input-box" style="width:100%;">2022.3.20f1</div></div>
    <div><div style="font-size:9px;color:var(--muted);margin-bottom:4px;">Execute Method</div><div class="input-box" style="width:100%;">MyBuildScript.BuildMethod</div></div>
    <div><div style="font-size:9px;color:var(--muted);margin-bottom:4px;">Output Path</div><div class="input-box" style="width:100%;">Builds/MyGameProject</div></div>
  </div>
  <div style="margin-top:12px;font-size:9px;color:var(--muted);">Command Preview:</div>
  <div class="cmd-block">unity build --target standalone-osx --editor-version 2022.3.20f1 --output Builds/MyGameProject</div>
  <div style="display:flex;gap:8px;margin-top:12px;"><button class="btn btn-primary">🔨 Start Build</button><button class="btn">📋 Copy Command</button></div>
</div>
<div class="card">
  <div class="card-title">📋 Build Log</div>
  <div style="background:#080e19;border-radius:6px;padding:12px;font-family:monospace;font-size:10px;min-height:120px;">
    <div style="color:var(--muted);">⏳ Waiting for build to start...</div>
  </div>
</div>""",

"mcp": """<h1 style="font-size:18px;font-weight:600;margin-bottom:4px;">🤖 MCP / AI Integration</h1>
<p style="font-size:11px;color:var(--muted);margin-bottom:16px;">Configure AI agent clients and Pipeline</p>
<div class="card">
  <div class="card-title">🟢 Connected Editors</div>
  <div class="row"><span style="font-family:monospace;font-size:12px;">2022.3.20f1</span> <span class="badge badge-green">Ready</span> <span style="font-size:11px;color:var(--muted);margin-left:auto;">Port: 12345 · PID: 12345</span></div>
</div>
<div class="card">
  <div class="card-title">🔧 MCP Client Configuration</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
    <div style="border:1px solid var(--border);border-radius:6px;padding:8px;"><div style="font-size:12px;">🤖 Claude</div><span class="badge badge-green" style="margin-top:4px;">✓ Configured</span></div>
    <div style="border:1px solid var(--border);border-radius:6px;padding:8px;"><div style="font-size:12px;">🖱️ Cursor</div><span class="badge badge-green" style="margin-top:4px;">✓ Configured</span></div>
    <div style="border:1px solid var(--border);border-radius:6px;padding:8px;"><div style="font-size:12px;">💻 VS Code</div><span class="badge badge-yellow" style="margin-top:4px;">⚠ Not configured</span></div>
    <div style="border:1px solid var(--border);border-radius:6px;padding:8px;"><div style="font-size:12px;">📝 Codex</div><span class="badge badge-green" style="margin-top:4px;">✓ Configured</span></div>
    <div style="border:1px solid var(--border);border-radius:6px;padding:8px;"><div style="font-size:12px;">🏄 Windsurf</div><span class="badge badge-red" style="margin-top:4px;">✗ File not found</span></div>
    <div style="border:1px solid var(--border);border-radius:6px;padding:8px;"><div style="font-size:12px;">⏩ Continue</div><span class="badge badge-green" style="margin-top:4px;">✓ Configured</span></div>
    <div style="border:1px solid var(--border);border-radius:6px;padding:8px;"><div style="font-size:12px;">⚡ Zed</div><span class="badge badge-yellow" style="margin-top:4px;">⚠ Not configured</span></div>
    <div style="border:1px solid var(--border);border-radius:6px;padding:8px;"><div style="font-size:12px;">📝 Neovim</div><span class="badge badge-red" style="margin-top:4px;">✗ Not installed</span></div>
  </div>
</div>""",

"aichat": """<h1 style="font-size:18px;font-weight:600;margin-bottom:4px;">💬 AI Chat</h1>
<p style="font-size:11px;color:var(--muted);margin-bottom:12px;">Control Unity through natural language</p>
<div style="display:flex;gap:8px;margin-bottom:12px;">
  <span class="badge badge-purple" style="font-size:11px;padding:4px 10px;">🤖 claude-sonnet-4-5</span>
  <button class="btn" style="margin-left:auto;">🗑️ Clear Chat</button>
  <button class="btn">⚙️ Settings</button>
</div>
<div style="background:#0a121e;border:1px solid var(--border);border-radius:8px;padding:16px;height:480px;overflow-y:auto;">
  <div style="display:flex;gap:8px;margin-bottom:12px;">
    <div style="width:32px;height:32px;border-radius:50%;background:rgba(14,165,233,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">🤖</div>
    <div class="chat-msg chat-bot">Hello! I can help you manage Unity. Ask me anything about editors, projects, or builds. 🎮</div>
  </div>
  <div style="display:flex;gap:8px;margin-bottom:12px;justify-content:flex-end;">
    <div class="chat-msg chat-user">List all installed editors</div>
  </div>
  <div style="display:flex;gap:8px;margin-bottom:12px;">
    <div style="width:32px;height:32px;border-radius:50%;background:rgba(14,165,233,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">🤖</div>
    <div style="flex:1;">
      <div class="chat-msg chat-bot">I'll list all installed editors for you:</div>
      <div class="cmd-block">$ unity editors --json --no-banner</div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">📋 Result (3 editors):</div>
      <div style="font-size:11px;color:var(--green);">✓ 2022.3.20f1 (default, arm64) — 3 modules</div>
      <div style="font-size:11px;color:var(--text);">• 2021.3.35f1 (x86_64) — 2 modules</div>
      <div style="font-size:11px;color:var(--text);">• 2023.1.0b1 (arm64) — no modules</div>
    </div>
  </div>
</div>
<div style="display:flex;gap:8px;margin-top:12px;">
  <div class="input-box" style="flex:1;">Ask anything about Unity... 💭</div>
  <button class="btn btn-primary">🚀 Send</button>
</div>""",

"settings": """<h1 style="font-size:18px;font-weight:600;margin-bottom:4px;">⚙️ Settings</h1>
<p style="font-size:11px;color:var(--muted);margin-bottom:16px;">Configure Unity CLI GUI</p>
<div class="card">
  <div class="card-title">🎨 Theme</div>
  <div style="display:flex;gap:8px;"><button class="btn btn-primary">🌙 Dark</button><button class="btn">☀️ Light</button><button class="btn">💻 System</button></div>
</div>
<div class="card">
  <div class="card-title">🌐 Language</div>
  <div class="input-box" style="width:240px;">🌐 English (auto-detected)</div>
  <span style="font-size:9px;color:var(--muted);margin-left:12px;">10 languages available</span>
</div>
<div class="card">
  <div class="card-title">🔑 License Management</div>
  <div style="display:flex;gap:12px;align-items:center;font-size:11px;">
    <span>Status:</span> <span class="badge badge-green">✓ Active</span>
    <span style="margin-left:16px;">Type: Personal</span>
    <span style="margin-left:16px;">Expiry: 2026-12-31</span>
    <button class="btn" style="margin-left:auto;">🔑 Activate</button>
    <button class="btn">↩️ Return</button>
  </div>
</div>
<div class="card">
  <div class="card-title">📦 CLI Management</div>
  <div style="display:flex;gap:12px;align-items:center;font-size:11px;">
    <span class="badge badge-green">v1.0.0-beta.5</span>
    <span style="color:var(--muted);">Auto-update: Enabled</span>
    <button class="btn" style="margin-left:auto;">🔄 Check Update</button>
    <button class="btn">📋 Changelog</button>
    <button class="btn btn-primary">⬆️ Upgrade</button>
  </div>
</div>
<div class="card">
  <div class="card-title">💾 Cache Management</div>
  <div style="display:flex;gap:12px;align-items:center;font-size:11px;">
    <span style="font-size:12px;">📦 2.4 GB (1,247 files)</span>
    <span class="mono" style="color:var(--muted);">~/.unity/cache</span>
    <button class="btn" style="margin-left:auto;">🗑️ Clean Cache</button>
  </div>
</div>""",
}


def build_html(page_id: str, content: str) -> str:
    nav_html = ""
    for pid, icon, label in NAV:
        active = " active" if pid == page_id else ""
        nav_html += f'<div class="nav-item{active}">{icon} <span>{label}</span></div>\n'

    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>{CSS}</style></head>
<body><div class="app">
<div class="topbar"><span style="font-size:14px;">🎮</span><span style="font-size:14px;font-weight:600;">Unity CLI GUI</span><span style="font-size:9px;color:var(--muted);">v1.0.0</span><div style="margin-left:auto;display:flex;align-items:center;gap:16px;"><div style="display:flex;align-items:center;gap:6px;"><div style="width:8px;height:8px;border-radius:50%;background:var(--green);"></div><span style="font-size:11px;color:var(--green);">CLI Connected</span></div><div style="display:flex;align-items:center;gap:6px;"><div style="width:8px;height:8px;border-radius:50%;background:var(--green);"></div><span style="font-size:11px;color:var(--muted);">demo@example.com</span></div></div></div>
<div class="main"><div class="sidebar">{nav_html}</div><div class="content">{content}</div></div>
<div class="statusbar"><span>CLI v1.0.0-beta.5</span><span style="display:flex;align-items:center;gap:4px;"><span style="width:6px;height:6px;border-radius:50%;background:var(--green);display:inline-block;"></span> demo@example.com</span><span>3 editors installed</span><span>5 projects</span><span style="margin-left:auto;color:var(--green);">● CLI Connected</span></div>
</div></body></html>"""


if __name__ == "__main__":
    os.makedirs("scripts/mockup_pages", exist_ok=True)
    for page_id, content in PAGES.items():
        html = build_html(page_id, content)
        path = f"scripts/mockup_pages/{page_id}.html"
        with open(path, "w") as f:
            f.write(html)
        print(f"✓ {path}")
