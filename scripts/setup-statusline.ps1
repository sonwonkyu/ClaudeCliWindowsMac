#!/usr/bin/env pwsh
# Windows: Setup Claude Code statusline for Claude CLI Web
# Run: powershell -ExecutionPolicy Bypass -File scripts/setup-statusline.ps1

$claudeDir = Join-Path $env:USERPROFILE ".claude"
$scriptSrc = Join-Path $PSScriptRoot "statusline.ps1"
$scriptDst = Join-Path $claudeDir "statusline.ps1"
$settingsPath = Join-Path $claudeDir "settings.json"

# Ensure ~/.claude/ exists
if (-not (Test-Path $claudeDir)) {
    New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
    Write-Host "[OK] Created $claudeDir"
}

# Copy statusline.ps1
Copy-Item -Path $scriptSrc -Destination $scriptDst -Force
Write-Host "[OK] Copied statusline.ps1 -> $scriptDst"

# Update settings.json
$command = "powershell -ExecutionPolicy Bypass -Command `\". '$scriptDst'`\""

if (Test-Path $settingsPath) {
    $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json
} else {
    $settings = [PSCustomObject]@{}
}

$statusLine = [PSCustomObject]@{
    type    = "command"
    command = $command
}
if ($settings.PSObject.Properties["statusLine"]) {
    $settings.statusLine = $statusLine
} else {
    $settings | Add-Member -NotePropertyName "statusLine" -NotePropertyValue $statusLine
}

$settings | ConvertTo-Json -Depth 10 | Out-File -FilePath $settingsPath -Encoding UTF8
Write-Host "[OK] Updated $settingsPath"
Write-Host ""
Write-Host "Done! Restart Claude Code to see the statusline."
Write-Host "The S/W gauge in Claude CLI Web (http://localhost:3333) will also start working."
