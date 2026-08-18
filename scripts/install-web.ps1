#Requires -Version 5.1
<# ═════════════════════════════════════════════════════════════════════════════
#  Unity CLI Web GUI — Windows Install Script (PowerShell)
#
#  Installs the web server version of Unity CLI GUI on Windows.
#  After installation, access the GUI from any device's browser.
#
#  Usage:
#    # Run as Administrator:
#    irm https://raw.githubusercontent.com/song-chaoyang/unity-cli-gui/main/scripts/install-web.ps1 | iex
#
#    # Or download and run:
#    powershell -ExecutionPolicy Bypass -File install-web.ps1
#
#  Options:
#    -Port 8080           Port (default: 8080)
#    -Dir "C:\unity-gui"  Install dir (default: C:\unity-gui)
#    -Update              Update existing installation
# ═════════════════════════════════════════════════════════════════════════════ #>

param(
  [string]$Port = "8080",
  [string]$Dir = "C:\unity-gui",
  [switch]$Update
)

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/song-chaoyang/unity-cli-gui.git"
$ServiceName = "UnityGui"

# ─── Platform Detection ──────────────────────────────────────────────────────

$Arch = if ([Environment]::Is64BitOperatingSystem) {
  if ([Environment]::Is64BitProcess) { "x64" } else { "x64" }
} else { "x86" }

# Check for ARM64
if ($env:PROCESSOR_ARCHITECTURE -match "ARM") { $Arch = "arm64" }

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Unity CLI Web GUI — Windows Installer                    ║" -ForegroundColor Cyan
Write-Host "╠═══════════════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║  Platform:  Windows ($Arch)                                ║" -ForegroundColor Cyan
Write-Host "║  Install:   $Dir".PadRight(60) "║" -ForegroundColor Cyan
Write-Host "║  Port:      $Port".PadRight(60) "║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ─── Check Administrator ──────────────────────────────────────────────────────

$IsAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $IsAdmin) {
  Write-Host "Note: Not running as Administrator. Service setup may fail." -ForegroundColor Yellow
  Write-Host "Re-run in an elevated PowerShell: Right-click → Run as Administrator" -ForegroundColor Yellow
  Write-Host ""
}

# ─── [1/6] Install Node.js ──────────────────────────────────────────────────

Write-Host "[1/6] Checking Node.js..." -ForegroundColor Cyan

function Install-NodeJS {
  # Try winget first
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if ($winget) {
    Write-Host "  Installing Node.js via winget..." -ForegroundColor Yellow
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements 2>$null
    if ($LASTEXITCODE -eq 0) { return $true }
  }

  # Fallback: direct download .msi
  Write-Host "  winget failed, downloading Node.js .msi..." -ForegroundColor Yellow
  $msiUrl = if ($Arch -eq "arm64") {
    "https://nodejs.org/dist/v20.18.0/node-v20.18.0-arm64.msi"
  } else {
    "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
  }
  $msiPath = "$env:TEMP\node-v20.18.0.msi"
  try {
    Invoke-WebRequest -Uri $msiUrl -OutFile $msiPath -UseBasicParsing
    Write-Host "  Installing .msi..." -ForegroundColor Yellow
    Start-Process msiexec.exe -ArgumentList "/i `"$msiPath`" /quiet /norestart" -Wait
    Remove-Item $msiPath -Force -ErrorAction SilentlyContinue
    return $true
  } catch {
    Write-Host "  Direct download failed: $_" -ForegroundColor Red
    return $false
  }
}

# Refresh PATH (so newly installed node is found)
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
  $nodeVersion = (& node -v) -replace "v", ""
  $nodeMajor = $nodeVersion.Split(".")[0]
  if ([int]$nodeMajor -ge 18) {
    Write-Host "  ✓ Node.js v$nodeVersion ($Arch)" -ForegroundColor Green
  } else {
    Write-Host "  Node.js v$nodeVersion found, need v18+. Upgrading..." -ForegroundColor Yellow
    Install-NodeJS
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
    Write-Host "  ✓ Node.js $(& node -v) installed" -ForegroundColor Green
  }
} else {
  Write-Host "  Node.js not found. Installing v20 LTS ($Arch)..." -ForegroundColor Yellow
  Install-NodeJS
  $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCmd) {
    Write-Host "  ✓ Node.js $(& node -v) installed" -ForegroundColor Green
  } else {
    Write-Host "  ✗ Failed to install Node.js" -ForegroundColor Red
    exit 1
  }
}

# ─── Install pnpm ──────────────────────────────────────────────────────────────

$pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmCmd) {
  Write-Host "  Installing pnpm..." -ForegroundColor Yellow
  npm install -g pnpm 2>$null
}
Write-Host "  ✓ pnpm $(& pnpm --version)" -ForegroundColor Green

# ─── Install git if missing ───────────────────────────────────────────────────

$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitCmd) {
  Write-Host "  Installing git..." -ForegroundColor Yellow
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if ($winget) {
    winget install Git.Git --accept-package-agreements --accept-source-agreements 2>$null
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
  }
}

# ─── [2/6] Clone or Update Repository ────────────────────────────────────────

Write-Host ""
Write-Host "[2/6] $(if ($Update) {'Updating'} else {'Cloning'}) repository..." -ForegroundColor Cyan

if (-not (Test-Path $Dir)) {
  New-Item -ItemType Directory -Path $Dir -Force | Out-Null
}

if (Test-Path "$Dir\.git") {
  Push-Location $Dir
  git pull --ff-only 2>$null
  Pop-Location
  Write-Host "  ✓ Updated at $Dir" -ForegroundColor Green
} else {
  git clone --depth 1 $RepoUrl $Dir 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Failed to clone repository." -ForegroundColor Red
    exit 1
  }
  Write-Host "  ✓ Cloned to $Dir" -ForegroundColor Green
}

Push-Location $Dir

# ─── [3/6] Install Dependencies ──────────────────────────────────────────────

Write-Host ""
Write-Host "[3/6] Installing dependencies..." -ForegroundColor Cyan
pnpm install --frozen-lockfile 2>$null
if ($LASTEXITCODE -ne 0) {
  pnpm install 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  pnpm failed, trying npm..." -ForegroundColor Yellow
    npm install 2>$null
  }
}
Write-Host "  ✓ Dependencies installed" -ForegroundColor Green

# ─── [4/6] Build Frontend ─────────────────────────────────────────────────────

Write-Host ""
Write-Host "[4/6] Building frontend (web mode)..." -ForegroundColor Cyan
pnpm build:web 2>&1 | Select-Object -Last 5
Write-Host "  ✓ Frontend built to dist\" -ForegroundColor Green

# ─── [5/6] Set Up Windows Service ─────────────────────────────────────────────

Write-Host ""
Write-Host "[5/6] Setting up Windows service..." -ForegroundColor Cyan

$nodePath = (Get-Command node).Source
$serverScript = "$Dir\web\server.mjs"

# Check if nssm (Non-Sucking Service Manager) is available
$nssm = Get-Command nssm -ErrorAction SilentlyContinue

if ($nssm) {
  # Use NSSM to create the service
  if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    nssm remove $ServiceName confirm 2>$null
  }
  nssm install $ServiceName $nodePath $serverScript
  nssm set $ServiceName AppDirectory $Dir
  nssm set $ServiceName AppEnvironmentExtra PORT=$Port NODE_ENV=production
  nssm set $ServiceName Start SERVICE_AUTO_START
  nssm set $ServiceName Description "Unity CLI Web GUI"
  nssm start $ServiceName
  Write-Host "  ✓ Windows service '$ServiceName' installed and started (via NSSM)" -ForegroundColor Green
} else {
  # Fallback: use a Scheduled Task that runs at logon
  $taskName = "UnityGui"
  $action = New-ScheduledTaskAction -Execute $nodePath -Argument "`"$serverScript`"" -WorkingDirectory $Dir
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  $envVars = @{
    PORT = $Port
    NODE_ENV = "production"
  }

  # Remove existing task
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

  # Register new task
  if ($IsAdmin) {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest -Description "Unity CLI Web GUI" -Force
  } else {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Unity CLI Web GUI" -Force
  }

  # Set environment variables for the task via registry
  $taskEnvKey = "HKCU:\Environment"
  [Environment]::SetEnvironmentVariable("PORT", $Port, "User")
  [Environment]::SetEnvironmentVariable("NODE_ENV", "production", "User")

  # Start the task now
  Start-ScheduledTask -TaskName $taskName
  Write-Host "  ✓ Scheduled task '$taskName' installed and started" -ForegroundColor Green
  Write-Host "  Note: For a true background service, install NSSM: winget install nssm" -ForegroundColor Yellow
}

# ─── [6/6] Verify ─────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "[6/6] Verifying installation..." -ForegroundColor Cyan

Start-Sleep -Seconds 3

# Get server IP
$serverIP = "localhost"
try {
  $ipConfig = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "127.*" } | Select-Object -First 1
  if ($ipConfig) { $serverIP = $ipConfig.IPAddress }
} catch {}

# Test HTTP
try {
  $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 5
  if ($response.StatusCode -eq 200) {
    Write-Host "  ✓ HTTP server responding on port $Port" -ForegroundColor Green
  }
} catch {
  Write-Host "  ⚠ HTTP not responding yet. May need a moment." -ForegroundColor Yellow
}

# ─── Done ─────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✓ Installation Complete!                                 ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Access the GUI from any device's browser:"
Write-Host ""
Write-Host "    http://$serverIP:$Port" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Service management:"
if ($nssm) {
  Write-Host "    Start:   nssm start $ServiceName"
  Write-Host "    Stop:    nssm stop $ServiceName"
  Write-Host "    Restart: nssm restart $ServiceName"
  Write-Host "    Remove:  nssm remove $ServiceName confirm"
} else {
  Write-Host "    Start:   Start-ScheduledTask -TaskName $taskName"
  Write-Host "    Stop:    Stop-ScheduledTask -TaskName $taskName"
  Write-Host "    Status:  Get-ScheduledTask -TaskName $taskName"
  Write-Host "    Remove:  Unregister-ScheduledTask -TaskName $taskName -Confirm:`$false"
}
Write-Host ""
Write-Host "  Configuration:"
Write-Host "    Install dir:  $Dir"
Write-Host "    Port:         $Port"
Write-Host "    Platform:     Windows ($Arch)"
Write-Host ""
Write-Host "  To update later:"
Write-Host "    powershell -ExecutionPolicy Bypass -File $Dir\scripts\install-web.ps1 -Update"
Write-Host ""

# Check Unity CLI
$unityCmd = Get-Command unity -ErrorAction SilentlyContinue
if ($unityCmd) {
  Write-Host "  ✓ Unity CLI: $($unityCmd.Source)" -ForegroundColor Green
} else {
  $unityPath = "$env:USERPROFILE\.unity\bin\unity.exe"
  if (Test-Path $unityPath) {
    Write-Host "  ✓ Unity CLI: $unityPath" -ForegroundColor Green
  } else {
    Write-Host "  ⚠ Unity CLI not found." -ForegroundColor Yellow
    Write-Host "     Install: irm https://public-cdn.cloud.unity3d.com/hub/prod/cli/install.ps1 | iex"
    Write-Host "     Or use the GUI's Settings page."
  }
}
Write-Host ""

Pop-Location
