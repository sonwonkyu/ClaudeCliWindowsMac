# poll-usage.ps1 — Fetch claude.ai usage via Chrome DevTools Protocol (CDP)
# Requires Chrome or Edge running with --remote-debugging-port=9222 (or 9223)
# Output: JSON string with usage data, "NO_TAB", or "ERR:..."

$ErrorActionPreference = 'Stop'

function Get-ClaudeTab {
    $ports = @(9222, 9223)
    foreach ($port in $ports) {
        try {
            $resp = Invoke-RestMethod -Uri "http://localhost:$port/json" -TimeoutSec 3
            $tab = $resp | Where-Object { $_.url -like '*claude.ai*' -and $_.type -eq 'page' } | Select-Object -First 1
            if ($tab) { return $tab }
        } catch {}
    }
    return $null
}

try {
    $tab = Get-ClaudeTab
    if (-not $tab) {
        Write-Output 'NO_TAB'
        exit 0
    }

    $wsUrl = $tab.webSocketDebuggerUrl
    if (-not $wsUrl) {
        Write-Output 'ERR:no-websocket-url'
        exit 0
    }

    # Connect WebSocket
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $cts = New-Object System.Threading.CancellationTokenSource(10000)
    $ws.ConnectAsync([Uri]$wsUrl, $cts.Token).GetAwaiter().GetResult() | Out-Null

    # JavaScript to execute in the claude.ai tab
    $jsCode = @'
(async()=>{try{var o=await(await fetch('/api/organizations')).json();var u=await(await fetch('/api/organizations/'+o[0].uuid+'/usage')).json();return JSON.stringify({s:u.five_hour?Math.round(u.five_hour.utilization):null,w:u.seven_day?Math.round(u.seven_day.utilization):null,m:u.seven_day_sonnet?Math.round(u.seven_day_sonnet.utilization):null,sReset:u.five_hour?u.five_hour.resets_at:null,wReset:u.seven_day?u.seven_day.resets_at:null,mReset:u.seven_day_sonnet?u.seven_day_sonnet.resets_at:null})}catch(e){return 'ERR:'+e.message}})()
'@

    # Build CDP Runtime.evaluate message
    $jsEsc = $jsCode.Replace('\', '\\').Replace('"', '\"').Replace("`r", '').Replace("`n", '')
    $payload = '{"id":1,"method":"Runtime.evaluate","params":{"expression":"' + $jsEsc + '","awaitPromise":true,"returnByValue":true}}'

    # Send
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $seg = New-Object System.ArraySegment[byte](,$bytes)
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $cts.Token).GetAwaiter().GetResult() | Out-Null

    # Receive (may come in multiple frames)
    $result = ''
    $buf = New-Object byte[] 65536
    do {
        $rseg = New-Object System.ArraySegment[byte](,$buf)
        $rcv = $ws.ReceiveAsync($rseg, $cts.Token).GetAwaiter().GetResult()
        $result += [System.Text.Encoding]::UTF8.GetString($buf, 0, $rcv.Count)
    } while (-not $rcv.EndOfMessage)

    # Close
    try {
        $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, '', [System.Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
    } catch {}

    # Parse CDP response
    $json = $result | ConvertFrom-Json
    if ($json.result.result.value) {
        Write-Output $json.result.result.value
    } else {
        Write-Output 'ERR:no-value'
    }
} catch {
    Write-Output ("ERR:" + $_.Exception.Message)
}
