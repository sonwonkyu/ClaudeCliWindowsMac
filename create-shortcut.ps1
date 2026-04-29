$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbsPath = Join-Path $scriptDir "server-toggle.vbs"
$shortcutPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "Claude Code Web Server.lnk"

$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut($shortcutPath)
$s.TargetPath = "wscript.exe"
$s.Arguments = "`"$vbsPath`""
$s.WorkingDirectory = $scriptDir
$s.IconLocation = "$scriptDir\ai-icon.ico"
$s.Description = "Claude Code Web Server Toggle"
$s.Save()

Write-Host "Shortcut created: $shortcutPath"
Read-Host "Press Enter to close"
