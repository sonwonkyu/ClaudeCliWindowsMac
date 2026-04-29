# build-app.ps1: Build Claude Code Web for Windows using electron-builder
# Run from: desktop/ folder
# PowerShell: Set-ExecutionPolicy -Scope Process Bypass; .\build-app.ps1

$ErrorActionPreference = "Stop"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$SERVER_DIR = Split-Path -Parent $SCRIPT_DIR

Write-Host "[build] Server path: $SERVER_DIR"

# Write server-path.json into app resources (will be embedded at build time)
$serverPathJson = '{ "serverDir": "' + $SERVER_DIR.Replace('\', '\\') + '" }'
# Write UTF-8 without BOM (BOM breaks JSON.parse)
[System.IO.File]::WriteAllText("$SCRIPT_DIR\server-path.json", $serverPathJson, (New-Object System.Text.UTF8Encoding $false))
Write-Host "[build] Embedded server path: $SERVER_DIR"

# Install desktop dependencies
Write-Host "[build] Installing desktop dependencies..."
Set-Location $SCRIPT_DIR
npm install

# Build with electron-builder
Write-Host "[build] Building Windows app..."
npx electron-builder --win

Write-Host ""
Write-Host "[build] Done! Output: $SCRIPT_DIR\dist\"
Write-Host "  - NSIS installer: dist\Claude Code Web Setup 1.0.0.exe"
Write-Host "  - Portable:       dist\Claude Code Web 1.0.0.exe"
