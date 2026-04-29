const path = require('path');
const { execSync } = require('child_process');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appDir = context.appOutDir;
  const appName = context.packager.appInfo.productFilename;
  const infoPlistPath = path.join(appDir, appName + '.app', 'Contents', 'Info.plist');

  // asar:false 빌드 시 default_app.asar 파일이 없는데
  // electron-builder가 ElectronAsarIntegrity 키를 Info.plist에 남겨두면
  // Electron이 시작 시 해시 검증에 실패해 ElectronMain+124에서 SIGTRAP 발생
  // → 키를 제거해 검증 자체를 건너뜀
  try {
    execSync(
      '/usr/libexec/PlistBuddy -c "Delete :ElectronAsarIntegrity" "' + infoPlistPath + '"',
      { stdio: 'ignore' }
    );
    console.log('[afterPack] Removed ElectronAsarIntegrity from Info.plist (' + appName + ')');
  } catch (e) {
    // 키가 없으면 무시
  }
};
