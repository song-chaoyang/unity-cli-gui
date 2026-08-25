#!/usr/bin/env python3
"""Generate clean, safe mockup screenshots for the Unity CLI GUI README.
All data is fictional placeholder data — NO real user info, paths, or logs."""

from PIL import Image, ImageDraw, ImageFont
import os

# ── Theme colors (matching app dark theme) ──
BG       = (14, 24, 41)
CARD     = (20, 32, 49)
CARD_HD  = (18, 28, 44)
SIDEBAR  = (12, 20, 35)
BORDER   = (33, 48, 68)
TEXT     = (224, 230, 240)
MUTED    = (130, 145, 165)
PRIMARY  = (14, 165, 233)
GREEN    = (74, 222, 128)
YELLOW   = (251, 191, 36)
RED      = (248, 113, 113)
PURPLE   = (168, 85, 247)
TEAL     = (45, 212, 191)
ORANGE   = (251, 146, 60)
ACCENT   = (99, 102, 241)

W, H = 1200, 800
SB_W = 224  # sidebar width
TB_H = 48   # top bar height
ST_H = 28   # status bar height

# ── Font ──
def font(sz, bold=False):
    try:
        path = "/System/Library/Fonts/Helvetica.ttc"
        if bold:
            path = "/System/Library/Fonts/Helvetica.ttc"
        return ImageFont.truetype(path, sz)
    except:
        return ImageFont.load_default()

F_TINY  = font(9)
F_SM    = font(11)
F_MD    = font(12)
F_LG    = font(14)
F_XL    = font(18)
F_TITLE = font(22)
F_MONO  = font(11)

NAV_ITEMS = [
    ("📊", "Dashboard", False),
    ("🎮", "Editors", False),
    ("📁", "Projects", False),
    ("🔨", "Build", False),
    ("🧪", "Test", False),
    ("🤖", "MCP / AI", False),
    ("💬", "AI Chat", False),
    ("⬇️", "Downloads", False),
    ("🖥️", "Terminal", False),
    ("📋", "Logs", False),
    ("⚙️", "Settings", False),
    ("ℹ️", "About", False),
]

def new_canvas():
    return Image.new("RGBA", (W, H), BG + (255,))

def draw_base(d, active_page=0):
    """Draw sidebar, top bar, status bar."""
    # Sidebar
    d.rectangle([0, TB_H, SB_W, H - ST_H], fill=SIDEBAR + (255,))
    d.line([SB_W, TB_H, SB_W, H - ST_H], fill=BORDER + (255,), width=1)
    # Top bar
    d.rectangle([0, 0, W, TB_H], fill=BG + (255,))
    d.line([0, TB_H, W, TB_H], fill=BORDER + (255,), width=1)
    # Status bar
    d.rectangle([0, H - ST_H, W, H], fill=BG + (255,))
    d.line([0, H - ST_H, W, H - ST_H], fill=BORDER + (255,), width=1)

    # Top bar content
    d.text((16, 14), "🎮", font=F_LG, fill=TEXT + (255,))
    d.text((40, 15), "Unity CLI GUI", font=F_LG, fill=TEXT + (255,))
    d.text((150, 16), "v1.0.0", font=F_TINY, fill=MUTED + (255,))
    # CLI status (green dot + text)
    cx = W - 260
    d.ellipse([cx, 18, cx+8, 26], fill=GREEN + (255,))
    d.text((cx + 12, 16), "CLI Connected", font=F_SM, fill=GREEN + (255,))
    # User indicator
    ux = W - 130
    d.ellipse([ux, 18, ux+8, 26], fill=GREEN + (255,))
    d.text((ux + 12, 16), "demo@example.com", font=F_SM, fill=MUTED + (255,))

    # Nav items
    y = TB_H + 8
    for i, (icon, label, _) in enumerate(NAV_ITEMS):
        is_active = (i == active_page)
        if is_active:
            d.rectangle([0, y, SB_W, y + 36], fill=(20, 32, 49, 255))
            d.rectangle([0, y, 3, y + 36], fill=PRIMARY + (255,))
        d.text((20, y + 10), icon, font=F_MD, fill=TEXT + (255,))
        d.text((44, y + 10), label, font=F_MD, fill=TEXT if is_active else MUTED + (255,))
        y += 36

    # Status bar content
    d.text((16, H - ST_H + 6), "CLI v1.0.0-beta.5", font=F_TINY, fill=MUTED + (255,))
    d.ellipse([130, H - ST_H + 8, 138, H - ST_H + 16], fill=GREEN + (255,))
    d.text((142, H - ST_H + 6), "demo@example.com", font=F_TINY, fill=MUTED + (255,))
    d.text((310, H - ST_H + 6), "3 editors installed", font=F_TINY, fill=MUTED + (255,))
    d.text((460, H - ST_H + 6), "5 projects", font=F_TINY, fill=MUTED + (255,))
    d.ellipse([W - 130, H - ST_H + 8, W - 122, H - ST_H + 16], fill=GREEN + (255,))
    d.text((W - 116, H - ST_H + 6), "● CLI Connected", font=F_TINY, fill=GREEN + (255,))

def draw_card(d, x, y, w, h, title=None):
    """Draw a card with optional title."""
    d.rounded_rectangle([x, y, x + w, y + h], radius=6, fill=CARD + (255,), outline=BORDER + (255,), width=1)
    if title:
        d.text((x + 12, y + 10), title, font=F_LG, fill=TEXT + (255,))

def draw_badge(d, x, y, text, color=PRIMARY):
    """Draw a small badge."""
    tw = d.textlength(text, font=F_TINY)
    d.rounded_rectangle([x, y, x + tw + 12, y + 18], radius=4, fill=color + (40,))
    d.text((x + 6, y + 3), text, font=F_TINY, fill=color + (255,))

def draw_button(d, x, y, text, w=80, variant="outline"):
    h = 28
    if variant == "primary":
        d.rounded_rectangle([x, y, x+w, y+h], radius=5, fill=PRIMARY + (255,))
        tc = (255, 255, 255)
    elif variant == "success":
        d.rounded_rectangle([x, y, x+w, y+h], radius=5, fill=GREEN + (255,))
        tc = (10, 20, 30)
    else:
        d.rounded_rectangle([x, y, x+w, y+h], radius=5, outline=BORDER + (255,), width=1)
        tc = TEXT
    tw = d.textlength(text, font=F_SM)
    d.text((x + (w - tw) / 2, y + 7), text, font=F_SM, fill=tc + (255,))

# ════════════════════════════════════════════════════════════════════════════
# 1. Dashboard
# ════════════════════════════════════════════════════════════════════════════
def gen_dashboard():
    img = new_canvas()
    d = ImageDraw.Draw(img)
    draw_base(d, active_page=0)

    # Page header
    d.text((SB_W + 16, TB_H + 12), "Dashboard", font=F_XL, fill=TEXT + (255,))
    d.text((SB_W + 16, TB_H + 38), "Unity CLI environment overview", font=F_SM, fill=MUTED + (255,))

    # Stat cards row
    cards = [
        ("Installed Editors", "3", PRIMARY, "2022.3.20f1 (default)"),
        ("Projects", "5", TEAL, "2 pinned"),
        ("Running Editors", "1", GREEN, "Editor active"),
        ("Cache Size", "2.4 GB", ORANGE, "1,247 files"),
    ]
    cx = SB_W + 16
    cw = 218
    for title, value, color, sub in cards:
        draw_card(d, cx, TB_H + 64, cw, 80)
        d.text((cx + 12, TB_H + 74), title, font=F_SM, fill=MUTED + (255,))
        d.text((cx + 12, TB_H + 92), value, font=F_TITLE, fill=color + (255,))
        d.text((cx + 12, TB_H + 122), sub, font=F_TINY, fill=MUTED + (255,))
        cx += cw + 12

    # Recent projects
    draw_card(d, SB_W + 16, TB_H + 160, 552, 260, "Recent Projects")
    projects = [
        ("🎯", "My Game Project", "2022.3.20f1", "Standalone", "2.3 GB"),
        ("🏗️", "AR Experience", "2022.3.20f1", "iOS", "1.8 GB"),
        ("🎮", "Mobile Runner", "2021.3.35f1", "Android", "950 MB"),
        ("🌐", "WebGL Demo", "2022.3.20f1", "WebGL", "420 MB"),
    ]
    for i, (icon, name, ver, target, size) in enumerate(projects):
        py = TB_H + 190 + i * 50
        d.text((SB_W + 28, py), icon, font=F_MD, fill=TEXT + (255,))
        d.text((SB_W + 52, py), name, font=F_MD, fill=TEXT + (255,))
        d.text((SB_W + 52, py + 16), f"{ver} · {target}", font=F_TINY, fill=MUTED + (255,))
        d.text((SB_W + 380, py + 4), size, font=F_SM, fill=MUTED + (255,))
        if i < 3:
            d.line([(SB_W + 28, py + 38), (SB_W + 548, py + 38)], fill=BORDER + (200,), width=1)

    # Quick actions
    draw_card(d, SB_W + 580, TB_H + 160, 588, 260, "Quick Actions")
    actions = [
        ("📥", "Install Editor", "Browse and install Unity versions"),
        ("📁", "Add Project", "Add existing Unity project folder"),
        ("🔨", "Build Project", "Configure and run builds"),
        ("💬", "AI Chat", "Control Unity via natural language"),
        ("🧪", "Run Tests", "Execute EditMode / PlayMode tests"),
        ("⚙️", "Settings", "Configure licenses, themes, and more"),
    ]
    for i, (icon, title, desc) in enumerate(actions):
        ax = SB_W + 596 + (i % 2) * 280
        ay = TB_H + 196 + (i // 2) * 64
        d.rounded_rectangle([ax, ay, ax + 266, ay + 54], radius=5, outline=BORDER + (255,), width=1)
        d.text((ax + 8, ay + 8), icon, font=F_LG, fill=TEXT + (255,))
        d.text((ax + 36, ay + 8), title, font=F_SM, fill=TEXT + (255,))
        d.text((ax + 36, ay + 24), desc, font=F_TINY, fill=MUTED + (255,))

    img.save("docs/screenshots/dashboard.png")
    print("✓ dashboard.png")

# ════════════════════════════════════════════════════════════════════════════
# 2. Projects
# ════════════════════════════════════════════════════════════════════════════
def gen_projects():
    img = new_canvas()
    d = ImageDraw.Draw(img)
    draw_base(d, active_page=2)

    d.text((SB_W + 16, TB_H + 12), "Projects", font=F_XL, fill=TEXT + (255,))
    d.text((SB_W + 16, TB_H + 38), "Manage Unity projects", font=F_SM, fill=MUTED + (255,))

    # Toolbar
    tools_y = TB_H + 64
    # Search box
    d.rounded_rectangle([SB_W + 16, tools_y, SB_W + 260, tools_y + 28], radius=5, outline=BORDER + (255,), width=1)
    d.text((SB_W + 24, tools_y + 7), "🔍 Search projects...", font=F_SM, fill=MUTED + (255,))
    draw_button(d, SB_W + 280, tools_y, "Refresh", 80)
    draw_button(d, SB_W + 372, tools_y, "Add Project", 110)
    draw_button(d, SB_W + 494, tools_y, "Export", 70)
    draw_button(d, SB_W + 576, tools_y, "Import", 70)

    # Project cards
    projects = [
        ("🎯", "My Game Project", "2022.3.20f1", "Standalone", "main", "2.3 GB", True),
        ("🏗️", "AR Experience", "2022.3.20f1", "iOS", "develop", "1.8 GB", True),
        ("🎮", "Mobile Runner", "2021.3.35f1", "Android", "feature/ui", "950 MB", False),
        ("🌐", "WebGL Demo", "2022.3.20f1", "WebGL", "main", "420 MB", False),
    ]
    cy = tools_y + 40
    for icon, name, ver, target, branch, size, expanded in projects:
        ch = 100 if expanded else 52
        draw_card(d, SB_W + 16, cy, W - SB_W - 32, ch)
        d.text((SB_W + 28, cy + 10), "▸" if not expanded else "▾", font=F_SM, fill=MUTED + (255,))
        d.text((SB_W + 48, cy + 8), icon, font=F_LG, fill=TEXT + (255,))
        d.text((SB_W + 76, cy + 8), name, font=F_MD, fill=TEXT + (255,))
        draw_badge(d, SB_W + 76, cy + 28, ver, PRIMARY)
        draw_badge(d, SB_W + 180, cy + 28, target, TEAL)
        # Git info
        d.text((SB_W + 300, cy + 8), "⎇", font=F_MD, fill=MUTED + (255,))
        d.text((SB_W + 316, cy + 8), branch, font=F_SM, fill=MUTED + (255,))
        if expanded:
            d.ellipse([SB_W + 316, cy + 28, SB_W + 322, cy + 34], fill=GREEN + (255,))
            d.text((SB_W + 326, cy + 26), "clean", font=F_TINY, fill=MUTED + (255,))
        # Size
        d.text((W - 80, cy + 12), size, font=F_SM, fill=MUTED + (255,))

        if expanded:
            # Expanded content
            ey = cy + 52
            d.line([(SB_W + 28, ey), (W - 28, ey)], fill=BORDER + (200,), width=1)
            d.text((SB_W + 48, ey + 8), "Path:", font=F_TINY, fill=MUTED + (255,))
            d.text((SB_W + 84, ey + 8), "/Users/demo/Projects/MyGameProject", font=F_MONO, fill=MUTED + (255,))
            d.text((SB_W + 48, ey + 24), "Modified:", font=F_TINY, fill=MUTED + (255,))
            d.text((SB_W + 100, ey + 24), "2 hours ago", font=F_TINY, fill=MUTED + (255,))
            d.text((SB_W + 220, ey + 24), "Modules: Android, iOS, WebGL", font=F_TINY, fill=MUTED + (255,))
            draw_button(d, W - 220, ey + 6, "Open", 60, "primary")
            draw_button(d, W - 150, ey + 6, "Settings", 70)
        cy += ch + 8

    img.save("docs/screenshots/projects.png")
    print("✓ projects.png")

# ════════════════════════════════════════════════════════════════════════════
# 3. Editors
# ════════════════════════════════════════════════════════════════════════════
def gen_editors():
    img = new_canvas()
    d = ImageDraw.Draw(img)
    draw_base(d, active_page=1)

    d.text((SB_W + 16, TB_H + 12), "Editors", font=F_XL, fill=TEXT + (255,))
    d.text((SB_W + 16, TB_H + 38), "Manage Unity editor installations", font=F_SM, fill=MUTED + (255,))

    # Tabs
    tab_y = TB_H + 64
    tabs = [("Installed", True), ("Available", False), ("Running", False)]
    tx = SB_W + 16
    for label, active in tabs:
        color = PRIMARY if active else MUTED
        d.text((tx, tab_y), label, font=F_MD, fill=color + (255,))
        if active:
            d.line([tx, tab_y + 20, tx + d.textlength(label, font=F_MD), tab_y + 20], fill=PRIMARY + (255,), width=2)
        tx += d.textlength(label, font=F_MD) + 24

    # Editor cards
    editors = [
        ("2022.3.20f1", "arm64", True, True, "Android, iOS, WebGL"),
        ("2021.3.35f1", "x86_64", False, False, "Android, WebGL"),
        ("2023.1.0b1", "arm64", False, False, "—"),
    ]
    ey = tab_y + 32
    for ver, arch, is_default, expanded, modules in editors:
        ch = 120 if expanded else 52
        draw_card(d, SB_W + 16, ey, W - SB_W - 32, ch)
        d.text((SB_W + 28, ey + 10), "▾" if expanded else "▸", font=F_SM, fill=MUTED + (255,))
        d.text((SB_W + 48, ey + 8), ver, font=F_MD, fill=TEXT + (255,))
        if is_default:
            draw_badge(d, SB_W + 48, ey + 28, "Default", GREEN)
        draw_badge(d, SB_W + 160, ey + 28, arch, MUTED)
        d.text((SB_W + 260, ey + 12), f"{modules} modules", font=F_SM, fill=MUTED + (255,))

        if expanded:
            # Module groups
            iy = ey + 52
            d.line([(SB_W + 28, iy), (W - 28, iy)], fill=BORDER + (200,), width=1)
            d.text((SB_W + 48, iy + 8), "Path:", font=F_TINY, fill=MUTED + (255,))
            d.text((SB_W + 84, iy + 8), "/Applications/Unity/Hub/Editor/2022.3.20f1", font=F_MONO, fill=MUTED + (255,))
            # Module chips
            mods = [("✓ Android", GREEN), ("✓ iOS", GREEN), ("✓ WebGL", GREEN), ("+ Windows", MUTED), ("+ Mac", MUTED)]
            mx = SB_W + 48
            my = iy + 30
            for mod_label, mod_color in mods:
                mw = d.textlength(mod_label, font=F_TINY) + 16
                d.rounded_rectangle([mx, my, mx + mw, my + 20], radius=4, fill=mod_color + (30,))
                d.text((mx + 8, my + 4), mod_label, font=F_TINY, fill=mod_color + (255,))
                mx += mw + 6
        ey += ch + 8

    # Install button
    draw_button(d, W - 160, TB_H + 64, "Install Editor", 130, "primary")

    img.save("docs/screenshots/editors.png")
    print("✓ editors.png")

# ════════════════════════════════════════════════════════════════════════════
# 4. Build
# ════════════════════════════════════════════════════════════════════════════
def gen_build():
    img = new_canvas()
    d = ImageDraw.Draw(img)
    draw_base(d, active_page=3)

    d.text((SB_W + 16, TB_H + 12), "Build", font=F_XL, fill=TEXT + (255,))
    d.text((SB_W + 16, TB_H + 38), "Configure and run project builds", font=F_SM, fill=MUTED + (255,))

    # Build config card
    draw_card(d, SB_W + 16, TB_H + 64, W - SB_W - 32, 220, "Build Configuration")
    fields = [
        ("Target Platform", "Standalone (macOS)"),
        ("Editor Version", "2022.3.20f1"),
        ("Execute Method", "MyBuildScript.BuildMethod"),
        ("Output Path", "Builds/MyGameProject"),
        ("Development Build", "✓ Enabled"),
        ("Android Options", "—"),
    ]
    for i, (label, value) in enumerate(fields):
        fx = SB_W + 36 + (i % 2) * 280
        fy = TB_H + 100 + (i // 2) * 36
        d.text((fx, fy), label, font=F_TINY, fill=MUTED + (255,))
        d.rounded_rectangle([fx, fy + 14, fx + 260, fy + 32], radius=4, outline=BORDER + (255,), width=1)
        d.text((fx + 8, fy + 18), value, font=F_SM, fill=TEXT + (255,))

    # Command preview
    d.text((SB_W + 36, TB_H + 220), "Command Preview:", font=F_TINY, fill=MUTED + (255,))
    d.rounded_rectangle([SB_W + 36, TB_H + 236, W - 52, TB_H + 268], radius=4, fill=(8, 14, 25, 255))
    cmd = "unity build --target standalone-osx --editor-version 2022.3.20f1 --output Builds/MyGameProject"
    d.text((SB_W + 44, TB_H + 244), cmd, font=F_MONO, fill=TEAL + (255,))

    draw_button(d, SB_W + 16, TB_H + 300, "Start Build", 100, "primary")

    # Log stream placeholder (clean, no real logs)
    draw_card(d, SB_W + 16, TB_H + 340, W - SB_W - 32, 200, "Build Log")
    # Just show a "waiting" state
    d.text((SB_W + 36, TB_H + 380), "⏳ Waiting for build to start...", font=F_SM, fill=MUTED + (255,))

    img.save("docs/screenshots/build.png")
    print("✓ build.png")

# ════════════════════════════════════════════════════════════════════════════
# 5. MCP / AI
# ════════════════════════════════════════════════════════════════════════════
def gen_mcp():
    img = new_canvas()
    d = ImageDraw.Draw(img)
    draw_base(d, active_page=5)

    d.text((SB_W + 16, TB_H + 12), "MCP / AI Integration", font=F_XL, fill=TEXT + (255,))
    d.text((SB_W + 16, TB_H + 38), "Configure AI agent clients and Pipeline", font=F_SM, fill=MUTED + (255,))

    # Connected editors
    draw_card(d, SB_W + 16, TB_H + 64, W - SB_W - 32, 70, "Connected Editors")
    d.text((SB_W + 36, TB_H + 94), "2022.3.20f1", font=F_SM, fill=TEXT + (255,))
    draw_badge(d, SB_W + 140, TB_H + 92, "Ready", GREEN)
    d.text((SB_W + 210, TB_H + 94), "Port: 12345", font=F_SM, fill=MUTED + (255,))
    d.text((SB_W + 310, TB_H + 94), "PID: 12345", font=F_SM, fill=MUTED + (255,))

    # MCP client config
    draw_card(d, SB_W + 16, TB_H + 150, W - SB_W - 32, 340, "MCP Client Configuration")
    clients = [
        ("Claude", "✓ Configured", GREEN),
        ("Cursor", "✓ Configured", GREEN),
        ("VS Code", "⚠ Not configured", YELLOW),
        ("Codex", "✓ Configured", GREEN),
        ("Windsurf", "✗ File not found", RED),
        ("Continue", "✓ Configured", GREEN),
        ("Zed", "⚠ Not configured", YELLOW),
        ("Neovim", "✗ Not installed", RED),
    ]
    for i, (name, status, color) in enumerate(clients):
        cx = SB_W + 36 + (i % 2) * 280
        cy = TB_H + 186 + (i // 2) * 72
        d.rounded_rectangle([cx, cy, cx + 264, cy + 60], radius=5, outline=BORDER + (255,), width=1)
        d.text((cx + 10, cy + 8), name, font=F_MD, fill=TEXT + (255,))
        draw_badge(d, cx + 10, cy + 28, status, color)
        d.text((cx + 160, cy + 10), "Edit", font=F_TINY, fill=PRIMARY + (255,))
        d.text((cx + 200, cy + 10), "Open", font=F_TINY, fill=PRIMARY + (255,))

    img.save("docs/screenshots/mcp.png")
    print("✓ mcp.png")

# ════════════════════════════════════════════════════════════════════════════
# 6. AI Chat
# ════════════════════════════════════════════════════════════════════════════
def gen_aichat():
    img = new_canvas()
    d = ImageDraw.Draw(img)
    draw_base(d, active_page=6)

    d.text((SB_W + 16, TB_H + 12), "AI Chat", font=F_XL, fill=TEXT + (255,))
    d.text((SB_W + 16, TB_H + 38), "Control Unity through natural language", font=F_SM, fill=MUTED + (255,))

    # Model badge
    draw_badge(d, W - 200, TB_H + 16, "claude-sonnet-4-5", PURPLE)
    draw_button(d, W - 100, TB_H + 12, "Settings", 80)
    draw_button(d, W - 200, TB_H + 44, "Clear Chat", 80)

    # Chat area
    chat_x = SB_W + 16
    chat_w = W - SB_W - 32
    d.rounded_rectangle([chat_x, TB_H + 80, chat_x + chat_w, H - ST_H - 60], radius=8, fill=(10, 18, 30, 255), outline=BORDER + (255,), width=1)

    # Assistant welcome message
    msg_y = TB_H + 100
    d.ellipse([chat_x + 16, msg_y, chat_x + 40, msg_y + 24], fill=PRIMARY + (60,))
    d.text((chat_x + 22, msg_y + 4), "🤖", font=F_SM, fill=TEXT + (255,))
    d.rounded_rectangle([chat_x + 48, msg_y, chat_x + chat_w - 24, msg_y + 40], radius=6, fill=CARD + (255,))
    d.text((chat_x + 60, msg_y + 8), "Hello! I can help you manage Unity.", font=F_SM, fill=TEXT + (255,))
    d.text((chat_x + 60, msg_y + 24), "Ask me anything about editors, projects, or builds.", font=F_TINY, fill=MUTED + (255,))

    # User message
    msg_y = TB_H + 160
    d.rounded_rectangle([chat_x + chat_w - 300, msg_y, chat_x + chat_w - 24, msg_y + 32], radius=6, fill=PRIMARY + (255,))
    d.text((chat_x + chat_w - 288, msg_y + 8), "List all installed editors", font=F_SM, fill=(255, 255, 255, 255))

    # Assistant response with command
    msg_y = TB_H + 210
    d.ellipse([chat_x + 16, msg_y, chat_x + 40, msg_y + 24], fill=PRIMARY + (60,))
    d.text((chat_x + 22, msg_y + 4), "🤖", font=F_SM, fill=TEXT + (255,))
    d.rounded_rectangle([chat_x + 48, msg_y, chat_x + chat_w - 24, msg_y + 130], radius=6, fill=CARD + (255,))
    d.text((chat_x + 60, msg_y + 8), "I'll list all installed editors for you:", font=F_SM, fill=TEXT + (255,))
    # Command block
    d.rounded_rectangle([chat_x + 60, msg_y + 32, chat_x + chat_w - 40, msg_y + 56], radius=4, fill=(8, 14, 25, 255))
    d.text((chat_x + 68, msg_y + 38), "$ unity editors --json --no-banner", font=F_MONO, fill=TEAL + (255,))
    # Result block
    d.text((chat_x + 60, msg_y + 66), "📋 Result (3 editors):", font=F_TINY, fill=MUTED + (255,))
    d.text((chat_x + 60, msg_y + 82), "• 2022.3.20f1 (default, arm64) — 3 modules", font=F_SM, fill=GREEN + (255,))
    d.text((chat_x + 60, msg_y + 98), "• 2021.3.35f1 (x86_64) — 2 modules", font=F_SM, fill=TEXT + (255,))
    d.text((chat_x + 60, msg_y + 114), "• 2023.1.0b1 (arm64) — no modules", font=F_SM, fill=TEXT + (255,))

    # Input
    d.rounded_rectangle([chat_x, H - ST_H - 48, chat_x + chat_w, H - ST_H - 16], radius=6, outline=BORDER + (255,), width=1)
    d.text((chat_x + 12, H - ST_H - 40), "Ask anything about Unity...", font=F_SM, fill=MUTED + (255,))
    draw_button(d, chat_x + chat_w - 90, H - ST_H - 48, "Send", 70, "primary")

    img.save("docs/screenshots/aichat.png")
    print("✓ aichat.png")

# ════════════════════════════════════════════════════════════════════════════
# 7. Settings
# ════════════════════════════════════════════════════════════════════════════
def gen_settings():
    img = new_canvas()
    d = ImageDraw.Draw(img)
    draw_base(d, active_page=10)

    d.text((SB_W + 16, TB_H + 12), "Settings", font=F_XL, fill=TEXT + (255,))
    d.text((SB_W + 16, TB_H + 38), "Configure Unity CLI GUI", font=F_SM, fill=MUTED + (255,))

    # Theme card
    draw_card(d, SB_W + 16, TB_H + 64, W - SB_W - 32, 70, "Theme")
    draw_button(d, SB_W + 36, TB_H + 96, "🌙 Dark", 80, "primary")
    draw_button(d, SB_W + 128, TB_H + 96, "☀️ Light", 80)
    draw_button(d, SB_W + 220, TB_H + 96, "💻 System", 80)

    # Language card
    draw_card(d, SB_W + 16, TB_H + 150, W - SB_W - 32, 60, "Language")
    d.text((SB_W + 36, TB_H + 182), "🌐 English (auto-detected)", font=F_SM, fill=TEXT + (255,))
    d.text((SB_W + 280, TB_H + 182), "10 languages available", font=F_TINY, fill=MUTED + (255,))

    # License card
    draw_card(d, SB_W + 16, TB_H + 226, W - SB_W - 32, 100, "License Management")
    d.text((SB_W + 36, TB_H + 258), "Status:", font=F_SM, fill=MUTED + (255,))
    draw_badge(d, SB_W + 84, TB_H + 256, "Active", GREEN)
    d.text((SB_W + 36, TB_H + 280), "Type: Personal", font=F_SM, fill=MUTED + (255,))
    d.text((SB_W + 200, TB_H + 280), "Expiry: 2026-12-31", font=F_SM, fill=MUTED + (255,))
    draw_button(d, SB_W + 360, TB_H + 254, "Activate", 80)
    draw_button(d, SB_W + 452, TB_H + 254, "Return", 70)

    # CLI Management
    draw_card(d, SB_W + 16, TB_H + 342, W - SB_W - 32, 100, "CLI Management")
    d.text((SB_W + 36, TB_H + 374), "Version:", font=F_SM, fill=MUTED + (255,))
    draw_badge(d, SB_W + 88, TB_H + 372, "v1.0.0-beta.5", GREEN)
    d.text((SB_W + 36, TB_H + 396), "Auto-update: Enabled", font=F_SM, fill=MUTED + (255,))
    draw_button(d, SB_W + 220, TB_H + 370, "Check Update", 110)
    draw_button(d, SB_W + 344, TB_H + 370, "Changelog", 90)
    draw_button(d, SB_W + 448, TB_H + 370, "Upgrade", 80, "primary")

    # Cache
    draw_card(d, SB_W + 16, TB_H + 458, W - SB_W - 32, 60, "Cache Management")
    d.text((SB_W + 36, TB_H + 490), "2.4 GB (1,247 files)", font=F_SM, fill=TEXT + (255,))
    d.text((SB_W + 200, TB_H + 490), "~/.unity/cache", font=F_MONO, fill=MUTED + (255,))
    draw_button(d, W - 120, TB_H + 486, "Clean Cache", 90)

    img.save("docs/screenshots/settings.png")
    print("✓ settings.png")

# ── Generate all ──
if __name__ == "__main__":
    os.makedirs("docs/screenshots", exist_ok=True)
    gen_dashboard()
    gen_projects()
    gen_editors()
    gen_build()
    gen_mcp()
    gen_aichat()
    gen_settings()
    print("\n✅ All 7 mockup screenshots generated successfully")
