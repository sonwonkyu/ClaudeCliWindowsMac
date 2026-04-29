#!/bin/bash
# Mac/Linux: Setup Claude Code statusline for Claude CLI Web
# Run: bash scripts/setup-statusline.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
SETTINGS_PATH="$CLAUDE_DIR/settings.json"

# Ensure ~/.claude/ exists
mkdir -p "$CLAUDE_DIR"

# Copy statusline.sh
cp "$SCRIPT_DIR/statusline.sh" "$CLAUDE_DIR/statusline.sh"
chmod +x "$CLAUDE_DIR/statusline.sh"
echo "[OK] Copied statusline.sh -> $CLAUDE_DIR/statusline.sh"

# Update settings.json
if [ -f "$SETTINGS_PATH" ]; then
    # jq available?
    if command -v jq &>/dev/null; then
        tmp=$(mktemp)
        jq '.statusLine = {"type":"command","command":"~/.claude/statusline.sh"}' "$SETTINGS_PATH" > "$tmp" && mv "$tmp" "$SETTINGS_PATH"
        echo "[OK] Updated $SETTINGS_PATH (via jq)"
    else
        echo "[WARN] jq not found. Please add this to $SETTINGS_PATH manually:"
        echo '  "statusLine": { "type": "command", "command": "~/.claude/statusline.sh" }'
    fi
else
    cat > "$SETTINGS_PATH" << 'SETTINGSEOF'
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh"
  }
}
SETTINGSEOF
    echo "[OK] Created $SETTINGS_PATH"
fi

echo ""
echo "Done! Restart Claude Code to see the statusline."
echo "The S/W gauge in Claude CLI Web (http://localhost:3333) will also start working."
echo ""
echo "Prerequisite: jq must be installed (brew install jq / apt install jq)"
