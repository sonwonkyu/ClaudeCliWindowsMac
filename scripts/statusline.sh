#!/bin/bash
# Claude Code Statusline for Mac/Linux
# Setup: copy to ~/.claude/statusline.sh && chmod +x ~/.claude/statusline.sh
# Settings.json: { "statusLine": { "type": "command", "command": "~/.claude/statusline.sh" } }

input=$(cat)

# Save raw JSON for Claude CLI Web
echo "$input" > /tmp/claude-statusline.json

MODEL=$(echo "$input" | jq -r '.model.display_name')
SESSION=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
WEEKLY=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
S_RESET=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
W_RESET=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')
CONTEXT=$(echo "$input" | jq -r '.context_window.used_percentage // 0')

gauge() {
  local pct=${1%.*}
  local width=10
  local filled=$(( pct * width / 100 ))
  local empty=$(( width - filled ))
  local bar=""
  [ "$filled" -gt 0 ] && bar=$(printf '%0.s█' $(seq 1 $filled))
  [ "$empty" -gt 0 ] && bar="${bar}$(printf '%0.s░' $(seq 1 $empty))"
  echo -n "$bar"
}

remaining() {
  local reset=$1
  if [ -z "$reset" ]; then echo ""; return; fi
  local now=$(date +%s)
  local diff=$(( reset - now ))
  if [ "$diff" -le 0 ]; then echo "now"; return; fi
  local days=$(( diff / 86400 ))
  local hours=$(( (diff % 86400) / 3600 ))
  local mins=$(( (diff % 3600) / 60 ))
  if [ "$days" -gt 0 ]; then
    printf "%dd%dh" "$days" "$hours"
  elif [ "$hours" -gt 0 ]; then
    printf "%dh%dm" "$hours" "$mins"
  else
    printf "%dm" "$mins"
  fi
}

if [ -n "$SESSION" ] && [ -n "$WEEKLY" ]; then
    S_PCT=$(printf "%.0f" "$SESSION")
    W_PCT=$(printf "%.0f" "$WEEKLY")
    C_PCT=$(printf "%.0f" "$CONTEXT")
    S_REM=$(remaining "$S_RESET")
    W_REM=$(remaining "$W_RESET")
    printf "[%s] S:%s %d%% %s │ W:%s %d%% %s │ C:%s %d%%\n" \
        "$MODEL" "$(gauge $S_PCT)" "$S_PCT" "$S_REM" "$(gauge $W_PCT)" "$W_PCT" "$W_REM" "$(gauge $C_PCT)" "$C_PCT"
else
    C_PCT=$(printf "%.0f" "$CONTEXT")
    printf "[%s] C:%s %d%%\n" "$MODEL" "$(gauge $C_PCT)" "$C_PCT"
fi
