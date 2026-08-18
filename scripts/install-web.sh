#!/bin/bash
# ═════════════════════════════════════════════════════════════════════════════
#  Unity CLI Web GUI — Cross-Platform Install Script (Linux + macOS)
#
#  Auto-detects OS and architecture (x86_64 / arm64), installs Node.js,
#  builds the frontend, and sets up a background service.
#
#  Platforms:
#    Linux  x86_64 / arm64  → systemd service
#    macOS  x86_64 / arm64  → launchd plist (LaunchDaemon)
#
#  Usage:
#    curl -fsSL https://raw.githubusercontent.com/song-chaoyang/unity-cli-gui/main/scripts/install-web.sh | sudo bash
#    bash install-web.sh --port 9000 --dir ~/unity-gui
#    bash install-web.sh --update
#
#  Options:
#    --port N       Port (default: 8080)
#    --dir PATH     Install dir (default: /opt/unity-gui on Linux, /usr/local/unity-gui on macOS)
#    --update       Update existing installation (skip service re-creation)
# ═════════════════════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Defaults
PORT="8080"
REPO_URL="https://github.com/song-chaoyang/unity-cli-gui.git"
UPDATE=false

# ─── Platform Detection ──────────────────────────────────────────────────────

OS_TYPE="$(uname -s)"
ARCH="$(uname -m)"

case "$OS_TYPE" in
  Linux*)  OS="linux";  SERVICE_MGR="systemd"; INSTALL_DIR="/opt/unity-gui" ;;
  Darwin*) OS="macos";  SERVICE_MGR="launchd"; INSTALL_DIR="/usr/local/unity-gui" ;;
  *) echo -e "${RED}Unsupported OS: $OS_TYPE (only Linux and macOS are supported)${NC}"; exit 1 ;;
esac

case "$ARCH" in
  x86_64|amd64)  ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo -e "${YELLOW}Warning: Unrecognized architecture '$ARCH'. Will try x64.${NC}"; ARCH="x64" ;;
esac

# ─── Parse Args ───────────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case $1 in
    --port) PORT="$2"; shift 2 ;;
    --dir)  INSTALL_DIR="$2"; shift 2 ;;
    --update) UPDATE=true; shift ;;
    -h|--help)
      echo "Unity CLI Web GUI Installer ($OS/$ARCH)"
      echo ""
      echo "  --port N       Port (default: 8080)"
      echo "  --dir PATH     Install dir (default: $INSTALL_DIR)"
      echo "  --update       Update existing installation"
      echo ""
      echo "Detected: $OS on $ARCH"
      exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ─── Banner ───────────────────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Unity CLI Web GUI — Installer                            ║${NC}"
echo -e "${CYAN}╠═══════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║  Platform:  $OS ($ARCH)${NC}"
echo -e "${CYAN}║  Install:    $INSTALL_DIR${NC}"
echo -e "${CYAN}║  Port:       $PORT${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Check Root ───────────────────────────────────────────────────────────────

IS_ROOT=false
if [ "$EUID" -eq 0 ]; then
  IS_ROOT=true
fi

if [ "$OS" = "linux" ] && [ "$IS_ROOT" = false ]; then
  echo -e "${YELLOW}Note: Not running as root. systemd service setup may fail.${NC}"
  echo -e "${YELLOW}Re-run with sudo if you need the service to start on boot.${NC}"
  echo ""
fi

if [ "$OS" = "macos" ]; then
  # On macOS, prefer not using sudo for the build steps, only for launchd
  if [ "$IS_ROOT" = true ]; then
    echo -e "${YELLOW}Note: Running as root on macOS. LaunchDaemon will be used.${NC}"
  else
    echo -e "${YELLOW}Note: Not root. LaunchAgent (user-level) will be used.${NC}"
  fi
  echo ""
fi

# ─── [1/6] Install Node.js ───────────────────────────────────────────────────

echo -e "${CYAN}[1/6] Checking Node.js...${NC}"

install_node_linux() {
  local need_sudo=""
  [ "$IS_ROOT" = false ] && need_sudo="sudo"

  # Try NodeSource first (Ubuntu/Debian — supports both x64 and arm64)
  if command -v apt-get &>/dev/null; then
    echo -e "  ${YELLOW}Installing Node.js v20 via NodeSource (apt)...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | $need_sudo bash - >/dev/null 2>&1
    $need_sudo apt-get install -y -qq nodejs >/dev/null 2>&1 && return 0
  fi

  # Try yum/dnf (CentOS/RHEL/Fedora — NodeSource may not have arm64)
  if command -v dnf &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | $need_sudo bash - >/dev/null 2>&1
    $need_sudo dnf install -y -q nodejs >/dev/null 2>&1 && return 0
  elif command -v yum &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | $need_sudo bash - >/dev/null 2>&1
    $need_sudo yum install -y -q nodejs >/dev/null 2>&1 && return 0
  fi

  # Fallback: nvm (works on all distros and architectures)
  echo -e "  ${YELLOW}Package manager install failed, trying nvm...${NC}"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash >/dev/null 2>&1
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install 20 >/dev/null 2>&1 && return 0

  # Last resort: direct binary download
  echo -e "  ${YELLOW}nvm failed, trying direct binary download...${NC}"
  local NODE_URL="https://nodejs.org/dist/v20.18.0/node-v20.18.0-linux-${ARCH}.tar.xz"
  curl -fsSL "$NODE_URL" | $need_sudo tar -xJ -C /usr/local --strip-components=1 >/dev/null 2>&1 && return 0

  return 1
}

install_node_macos() {
  # Homebrew (preferred — installs native arm64 or x64 automatically)
  if command -v brew &>/dev/null; then
    echo -e "  ${YELLOW}Installing Node.js via Homebrew...${NC}"
    brew install node >/dev/null 2>&1 && return 0
  fi

  # Fallback: official .pkg installer (supports arm64 and x64)
  echo -e "  ${YELLOW}Homebrew not found, installing official Node.js .pkg...${NC}"
  local PKG_URL="https://nodejs.org/dist/v20.18.0/node-v20.18.0.pkg"
  local TMP_PKG="/tmp/node-v20.18.0.pkg"
  curl -fsSL "$PKG_URL" -o "$TMP_PKG" 2>/dev/null
  if [ -f "$TMP_PKG" ]; then
    sudo installer -pkg "$TMP_PKG" -target / >/dev/null 2>&1
    rm -f "$TMP_PKG"
    return 0
  fi

  # Last resort: nvm
  echo -e "  ${YELLOW}.pkg failed, trying nvm...${NC}"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash >/dev/null 2>&1
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install 20 >/dev/null 2>&1 && return 0

  return 1
}

# Check existing Node.js
if command -v node &>/dev/null; then
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -ge 18 ]; then
    echo -e "  ${GREEN}✓${NC} Node.js $(node -v) ($ARCH)"
  else
    echo -e "  ${YELLOW}Node.js v$NODE_VERSION found, need v18+. Upgrading...${NC}"
    if [ "$OS" = "linux" ]; then
      install_node_linux || { echo -e "${RED}Failed to install Node.js${NC}"; exit 1; }
    else
      install_node_macos || { echo -e "${RED}Failed to install Node.js${NC}"; exit 1; }
    fi
    echo -e "  ${GREEN}✓${NC} Node.js $(node -v) installed"
  fi
else
  echo -e "  ${YELLOW}Node.js not found. Installing v20 LTS ($OS/$ARCH)...${NC}"
  if [ "$OS" = "linux" ]; then
    install_node_linux || { echo -e "${RED}Failed to install Node.js${NC}"; exit 1; }
  else
    install_node_macos || { echo -e "${RED}Failed to install Node.js${NC}"; exit 1; }
  fi
  echo -e "  ${GREEN}✓${NC} Node.js $(node -v) installed"
fi

# Check node arch matches system arch (especially on macOS x86_64 mode)
NODE_ARCH=$(node -p 'process.arch' 2>/dev/null || echo "unknown")
if [ "$NODE_ARCH" != "$ARCH" ] && [ "$ARCH" = "arm64" ]; then
  echo -e "  ${YELLOW}Note: Node.js is running as $NODE_ARCH on an $ARCH system (Rosetta/translation).${NC}"
fi

# ─── Install pnpm ──────────────────────────────────────────────────────────────

if ! command -v pnpm &>/dev/null; then
  echo -e "  ${YELLOW}Installing pnpm...${NC}"
  npm install -g pnpm >/dev/null 2>&1
fi
echo -e "  ${GREEN}✓${NC} pnpm $(pnpm --version)"

# ─── Install git if missing ───────────────────────────────────────────────────

if ! command -v git &>/dev/null; then
  echo -e "  ${YELLOW}Installing git...${NC}"
  if [ "$OS" = "linux" ]; then
    local local_sudo=""
    [ "$IS_ROOT" = false ] && local_sudo="sudo"
    $local_sudo apt-get install -y -qq git >/dev/null 2>&1 || $local_sudo yum install -y -q git >/dev/null 2>&1 || true
  else
    brew install git >/dev/null 2>&1 || true
  fi
fi

# ─── [2/6] Clone or Update Repository ────────────────────────────────────────

echo ""
echo -e "${CYAN}[2/6] ${UPDATE:+Updating}${UPDATE:-Cloning} repository...${NC}"

# Create install dir if it doesn't exist
if [ ! -d "$INSTALL_DIR" ]; then
  if [ "$IS_ROOT" = true ]; then
    mkdir -p "$INSTALL_DIR"
  else
    sudo mkdir -p "$INSTALL_DIR" 2>/dev/null || mkdir -p "$INSTALL_DIR"
    [ "$IS_ROOT" = false ] && [ "$OS" = "linux" ] && sudo chown -R "$USER":"$USER" "$INSTALL_DIR" 2>/dev/null || true
  fi
fi

if [ -d "$INSTALL_DIR/.git" ]; then
  cd "$INSTALL_DIR"
  git pull --ff-only 2>/dev/null || true
  echo -e "  ${GREEN}✓${NC} Updated at $INSTALL_DIR"
else
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR" 2>/dev/null || {
    echo -e "${RED}Failed to clone repository. Check your network connection.${NC}"
    exit 1
  }
  echo -e "  ${GREEN}✓${NC} Cloned to $INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# ─── [3/6] Install Dependencies ──────────────────────────────────────────────

echo ""
echo -e "${CYAN}[3/6] Installing dependencies...${NC}"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install 2>/dev/null || {
  echo -e "${YELLOW}pnpm install failed, trying npm...${NC}"
  npm install 2>/dev/null
}
echo -e "  ${GREEN}✓${NC} Dependencies installed"

# ─── [4/6] Build Frontend ─────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}[4/6] Building frontend (web mode)...${NC}"
pnpm build:web 2>&1 | tail -5
echo -e "  ${GREEN}✓${NC} Frontend built to dist/"

# ─── [5/6] Set Up Background Service ──────────────────────────────────────────

echo ""
echo -e "${CYAN}[5/6] Setting up $SERVICE_MGR service...${NC}"

NODE_BIN=$(which node)
SERVICE_NAME="unity-gui"
PLIST_LABEL="com.unity-gui"

# Detect Unity CLI binary path for systemd PATH
UNITY_BIN_PATH=""
for candidate in \
  "/usr/local/bin/unity" "/usr/bin/unity" \
  "$HOME/.unity/bin/unity" "$HOME/.local/bin/unity" \
  "/home/*/.unity/bin/unity" "/root/.unity/bin/unity"; do
  for path in $candidate; do
    if [ -x "$path" ] 2>/dev/null; then
      UNITY_BIN_PATH="$(dirname "$path")"
      break 2
    fi
  done
done

# Build PATH environment for systemd service
EXTRA_PATH=""
if [ -n "$UNITY_BIN_PATH" ]; then
  EXTRA_PATH=":${UNITY_BIN_PATH}"
fi

setup_systemd() {
  local SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

  cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Unity CLI Web GUI
After=network.target

[Service]
Type=simple
ExecStart=${NODE_BIN} ${INSTALL_DIR}/web/server.mjs
WorkingDirectory=${INSTALL_DIR}
Environment=PORT=${PORT}
Environment=NODE_ENV=production
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin${EXTRA_PATH}
Environment=HOME=${HOME}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME"
  systemctl restart "$SERVICE_NAME"
  echo -e "  ${GREEN}✓${NC} systemd service '${SERVICE_NAME}' installed and started"
}

setup_launchd() {
  local PLIST_FILE

  if [ "$IS_ROOT" = true ]; then
    PLIST_FILE="/Library/LaunchDaemons/${PLIST_LABEL}.plist"
  else
    PLIST_FILE="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
    mkdir -p "$HOME/Library/LaunchAgents"
  fi

  cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${INSTALL_DIR}/web/server.mjs</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${INSTALL_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key>
    <string>${PORT}</string>
    <key>NODE_ENV</key>
    <string>production</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/unity-gui.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/unity-gui.error.log</string>
</dict>
</plist>
EOF

  # Unload if already loaded
  launchctl unload "$PLIST_FILE" 2>/dev/null || true
  # Load the service
  launchctl load "$PLIST_FILE"
  echo -e "  ${GREEN}✓${NC} launchd service '${PLIST_LABEL}' installed and started"
}

if [ "$UPDATE" = true ] && { [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ] || [ -f "/Library/LaunchDaemons/${PLIST_LABEL}.plist" ] || [ -f "$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist" ]; }; then
  echo -e "  ${YELLOW}Service already exists, skipping creation (--update)${NC}"
else
  if [ "$OS" = "linux" ]; then
    setup_systemd
  else
    setup_launchd
  fi
fi

# ─── [6/6] Verify ─────────────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}[6/6] Verifying installation...${NC}"

sleep 2

# Check if service is running
if [ "$OS" = "linux" ]; then
  if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Service is running"
  else
    echo -e "  ${YELLOW}⚠${NC} Service may not have started. Check: journalctl -u ${SERVICE_NAME} -e${NC}"
  fi
else
  if launchctl list "$PLIST_LABEL" &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Service is running"
  else
    echo -e "  ${YELLOW}⚠${NC} Service may not have started. Check: /tmp/unity-gui.error.log${NC}"
  fi
fi

# Get server IP — detect Colima/VM environments where localhost is the correct access URL
SERVER_IP=""
if [ "$OS" = "linux" ]; then
  # Check if running inside Colima VM (port is forwarded to host)
  if [ -f /.colima ] || grep -q "colima" /proc/version 2>/dev/null || hostname 2>/dev/null | grep -qi "colima"; then
    SERVER_IP="localhost"
  else
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  fi
else
  SERVER_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
fi
[ -z "$SERVER_IP" ] && SERVER_IP="localhost"

# Test HTTP
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "  ${GREEN}✓${NC} HTTP server responding on port ${PORT}"
else
  echo -e "  ${YELLOW}⚠${NC} HTTP not responding yet (code: $HTTP_CODE). May need a moment.${NC}"
fi

# ─── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Installation Complete!                                 ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Access the GUI from any device's browser:"
echo ""
echo -e "    ${CYAN}http://${SERVER_IP}:${PORT}${NC}"
echo ""
echo "  Service management:"
if [ "$OS" = "linux" ]; then
  echo "    systemctl status  $SERVICE_NAME"
  echo "    systemctl restart $SERVICE_NAME"
  echo "    systemctl stop    $SERVICE_NAME"
  echo "    journalctl -u     $SERVICE_NAME -f"
else
  echo "    launchctl list          $PLIST_LABEL"
  echo "    launchctl kickstart -k  $PLIST_LABEL   # restart"
  echo "    launchctl unload        $PLIST_FILE    # stop"
  echo "    launchctl load          $PLIST_FILE    # start"
  echo "    tail -f /tmp/unity-gui.log"
fi
echo ""
echo "  Configuration:"
echo "    Install dir:  $INSTALL_DIR"
echo "    Port:         $PORT"
echo "    Platform:     $OS ($ARCH)"
echo ""
echo "  To update later:"
echo "    bash $INSTALL_DIR/scripts/install-web.sh --update"
echo ""

# Check Unity CLI — search PATH + all common locations including other users' home dirs
UNITY_FOUND=""
if command -v unity &>/dev/null; then
  UNITY_FOUND="$(which unity)"
else
  for p in \
    "$HOME/.unity/bin/unity" "$HOME/.local/bin/unity" \
    "/usr/local/bin/unity" "/usr/bin/unity" \
    /home/*/.unity/bin/unity /home/*/.local/bin/unity \
    /root/.unity/bin/unity; do
    if [ -x "$p" ] 2>/dev/null; then UNITY_FOUND="$p"; break; fi
  done
fi
if [ -n "$UNITY_FOUND" ]; then
  UNITY_VER=$("$UNITY_FOUND" --version 2>/dev/null || echo "version unknown")
  echo -e "  ${GREEN}✓${NC} Unity CLI: $UNITY_FOUND ($UNITY_VER)"
else
  echo -e "  ${YELLOW}⚠${NC} Unity CLI not found."
  echo "     Install: curl -fsSL https://public-cdn.cloud.unity3d.com/hub/prod/cli/install.sh | UNITY_CLI_CHANNEL=beta bash"
  echo "     Or use the GUI's Settings page."
fi
echo ""
