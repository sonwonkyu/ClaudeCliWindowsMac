#!/bin/bash
# build-app.sh: Build Claude Code Web.app using npm Electron.app as base (macOS 26 compatible)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ELECTRON_APP="$SCRIPT_DIR/node_modules/electron/dist/Electron.app"
OUT_DIR="$SCRIPT_DIR/dist/mac-arm64"
APP_NAME="Claude Code Web"
APP_OUT="$OUT_DIR/$APP_NAME.app"
SERVER_DIR="$SCRIPT_DIR/.."

echo "[build] Cleaning..."
rm -rf "$APP_OUT"
mkdir -p "$OUT_DIR"

echo "[build] Copying Electron.app base..."
cp -r "$ELECTRON_APP" "$APP_OUT"

# Rename binary
mv "$APP_OUT/Contents/MacOS/Electron" "$APP_OUT/Contents/MacOS/$APP_NAME"

echo "[build] Updating Info.plist..."
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName $APP_NAME" "$APP_OUT/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleExecutable $APP_NAME" "$APP_OUT/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName $APP_NAME" "$APP_OUT/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.claudecodeweb.app" "$APP_OUT/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString 1.0.0" "$APP_OUT/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion 1.0.0" "$APP_OUT/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :LSApplicationCategoryType public.app-category.productivity" "$APP_OUT/Contents/Info.plist"

# App icon
if [ -f "$SCRIPT_DIR/ai-icon.icns" ]; then
  cp "$SCRIPT_DIR/ai-icon.icns" "$APP_OUT/Contents/Resources/Claude Code Web.icns"
  /usr/libexec/PlistBuddy -c "Set :CFBundleIconFile Claude Code Web.icns" "$APP_OUT/Contents/Info.plist"
elif [ -f "$SCRIPT_DIR/ai-icon.png" ]; then
  # Convert png to icns if sips is available
  mkdir -p /tmp/Claude Code Web.iconset
  sips -z 512 512 "$SCRIPT_DIR/ai-icon.png" --out /tmp/Claude Code Web.iconset/icon_512x512.png 2>/dev/null || true
  iconutil -c icns /tmp/Claude Code Web.iconset -o "$APP_OUT/Contents/Resources/Claude Code Web.icns" 2>/dev/null || true
  if [ -f "$APP_OUT/Contents/Resources/Claude Code Web.icns" ]; then
    /usr/libexec/PlistBuddy -c "Set :CFBundleIconFile Claude Code Web.icns" "$APP_OUT/Contents/Info.plist"
  fi
fi

echo "[build] Installing app code..."
rm -rf "$APP_OUT/Contents/Resources/default_app.asar"
# Remove ASAR integrity check (we don't use ASAR)
/usr/libexec/PlistBuddy -c "Delete :ElectronAsarIntegrity" "$APP_OUT/Contents/Info.plist" 2>/dev/null || true
mkdir -p "$APP_OUT/Contents/Resources/app"
cp "$SCRIPT_DIR/main.js" "$APP_OUT/Contents/Resources/app/"
cp "$SCRIPT_DIR/preload.js" "$APP_OUT/Contents/Resources/app/"
cp "$SCRIPT_DIR/loading.html" "$APP_OUT/Contents/Resources/app/"
cp "$SCRIPT_DIR/ai-icon.png" "$APP_OUT/Contents/Resources/app/" 2>/dev/null || true
cp "$SCRIPT_DIR/ai-icon.ico" "$APP_OUT/Contents/Resources/app/" 2>/dev/null || true

# app/package.json (minimal)
cat > "$APP_OUT/Contents/Resources/app/package.json" << 'EOF'
{
  "name": "claude-code-web",
  "version": "1.0.0",
  "main": "main.js"
}
EOF

# 서버 경로를 앱 안에 직접 기록 (빌드 시점 경로)
cat > "$APP_OUT/Contents/Resources/app/server-path.json" << EOF
{ "serverDir": "$(dirname "$SCRIPT_DIR")" }
EOF
echo "[build] Server path embedded: $(dirname "$SCRIPT_DIR")"

# app/node_modules (tree-kill only)
mkdir -p "$APP_OUT/Contents/Resources/app/node_modules"
cp -r "$SCRIPT_DIR/node_modules/tree-kill" "$APP_OUT/Contents/Resources/app/node_modules/"


echo "[build] Removing quarantine..."
xattr -cr "$APP_OUT"

echo "[build] Done: $APP_OUT"
echo ""
echo "Run with:"
echo "  open \"$APP_OUT\""
echo "  or double-click in Finder"
