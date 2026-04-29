#!/usr/bin/env pwsh
# Claude Code Statusline for Windows (PowerShell)
# Setup: copy to ~/.claude/statusline.ps1
# Settings.json: { "statusLine": { "type": "command", "command": "powershell -ExecutionPolicy Bypass -Command \". '%USERPROFILE%\\.claude\\statusline.ps1'\"" } }
# NOTE: -Command (dot-source) is required. -File does not pass stdin on Windows.

$input = [Console]::In.ReadToEnd()

# Save raw JSON for Claude CLI Web
$tempPath = Join-Path $env:TEMP "claude-statusline.json"
[System.IO.File]::WriteAllText($tempPath, $input)

try {
    $data = $input | ConvertFrom-Json
} catch {
    Write-Host "[Claude] no data"
    exit 0
}

$model = $data.model.display_name
$session = $data.rate_limits.five_hour.used_percentage
$weekly = $data.rate_limits.seven_day.used_percentage
$sReset = $data.rate_limits.five_hour.resets_at
$wReset = $data.rate_limits.seven_day.resets_at
$context = $data.context_window.used_percentage
if (-not $context) { $context = 0 }

function Get-Gauge {
    param([double]$pct, [int]$width = 10)
    $filled = [math]::Round($pct * $width / 100)
    $empty = $width - $filled
    $bar = ([char]0x2588).ToString() * $filled + ([char]0x2591).ToString() * $empty
    return $bar
}

function Get-Remaining {
    param($resetEpoch)
    if (-not $resetEpoch) { return "" }
    $now = [int][double]::Parse((Get-Date -UFormat %s))
    $diff = $resetEpoch - $now
    if ($diff -le 0) { return "now" }
    $days = [math]::Floor($diff / 86400)
    $hours = [math]::Floor(($diff % 86400) / 3600)
    $mins = [math]::Floor(($diff % 3600) / 60)
    if ($days -gt 0) { return "${days}d${hours}h" }
    elseif ($hours -gt 0) { return "${hours}h${mins}m" }
    else { return "${mins}m" }
}

if ($session -and $weekly) {
    $sPct = [math]::Round($session)
    $wPct = [math]::Round($weekly)
    $cPct = [math]::Round($context)
    $sRem = Get-Remaining $sReset
    $wRem = Get-Remaining $wReset
    $sBar = Get-Gauge $sPct
    $wBar = Get-Gauge $wPct
    $cBar = Get-Gauge $cPct
    Write-Host "[$model] S:$sBar ${sPct}% $sRem | W:$wBar ${wPct}% $wRem | C:$cBar ${cPct}%"
} else {
    $cPct = [math]::Round($context)
    $cBar = Get-Gauge $cPct
    Write-Host "[$model] C:$cBar ${cPct}%"
}
