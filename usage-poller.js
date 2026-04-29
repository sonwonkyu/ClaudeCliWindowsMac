const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");

const IS_WIN = process.platform === "win32";
const IS_MAC = process.platform === "darwin";
const STATUSLINE_PATH = path.join(IS_WIN ? os.tmpdir() : "/tmp", "claude-statusline.json");
const USAGE_PATH = path.join(IS_WIN ? os.tmpdir() : "/tmp", "claude-usage-poll.json");

const CDP_PORT = 9222;
const CHROME_USER_DATA_DIR = "C:/ChromeCDP";

let intervalId = null;
let cdpChromeProc = null;

// macOS: fetch usage via claude.ai internal API from any open claude.ai tab in Chrome
function pollViaChromeAppleScript() {
  // Step 1: get org UUID from any claude.ai tab
  // Step 2: fetch /api/organizations/{uuid}/usage
  // Step 3: return parsed result
  // All done via JS executed in an existing claude.ai tab — no new tabs needed
  const script = `
tell application "Google Chrome"
  repeat with w in windows
    set tabCount to count of tabs of w
    repeat with i from 1 to tabCount
      set t to tab i of w
      if URL of t contains "claude.ai" then
        tell t to execute javascript "window.__usageResult = null;"
        tell t to execute javascript "
          (async()=>{
            try {
              var orgs = await (await fetch('/api/organizations')).json();
              var uuid = orgs[0].uuid;
              var usage = await (await fetch('/api/organizations/'+uuid+'/usage')).json();
              var r = {
                s: usage.five_hour ? Math.round(usage.five_hour.utilization) : null,
                w: usage.seven_day ? Math.round(usage.seven_day.utilization) : null,
                m: usage.seven_day_sonnet ? Math.round(usage.seven_day_sonnet.utilization) : null,
                sReset: usage.five_hour ? usage.five_hour.resets_at : null,
                wReset: usage.seven_day ? usage.seven_day.resets_at : null,
                mReset: usage.seven_day_sonnet ? usage.seven_day_sonnet.resets_at : null
              };
              window.__usageResult = JSON.stringify(r);
            } catch(e) {
              window.__usageResult = 'ERR:' + e.message;
            }
          })()
        "
        delay 3
        set resultText to (execute of t javascript "window.__usageResult || 'WAIT'")
        return resultText
      end if
    end repeat
  end repeat
  return "NO_TAB"
end tell
`;
  try {
    const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      timeout: 15000,
      encoding: "utf-8",
    }).trim();

    if (result === "NO_TAB") {
      console.log("[usage-poller] No claude.ai tab found in Chrome");
      return null;
    }
    if (result.startsWith("ERR:") || result === "WAIT") {
      console.error("[usage-poller] JS error:", result);
      return null;
    }

    return JSON.parse(result);
  } catch (err) {
    console.error("[usage-poller] AppleScript error:", err.message?.split("\n")[0]);
    return null;
  }
}

// Windows: check if CDP port is already open
function isCdpReady() {
  try {
    execSync(`powershell -NoProfile -Command "Invoke-RestMethod -Uri 'http://localhost:${CDP_PORT}/json/version' -TimeoutSec 2 | Out-Null"`, { timeout: 5000, encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
}

// Windows: find Chrome executable path
function findChromePath() {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(os.homedir(), "AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Windows: launch Chrome with CDP enabled (separate user-data-dir)
function launchCdpChrome() {
  if (isCdpReady()) {
    console.log("[usage-poller] CDP Chrome already running on port", CDP_PORT);
    return true;
  }

  const chromePath = findChromePath();
  if (!chromePath) {
    console.error("[usage-poller] Chrome not found. Install Chrome or launch manually with --remote-debugging-port=9222");
    return false;
  }

  console.log("[usage-poller] Launching CDP Chrome...");
  cdpChromeProc = spawn(chromePath, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${CHROME_USER_DATA_DIR}`,
    "https://claude.ai"
  ], {
    detached: true,
    stdio: "ignore",
  });
  cdpChromeProc.unref();
  console.log(`[usage-poller] CDP Chrome launched (port: ${CDP_PORT}, profile: ${CHROME_USER_DATA_DIR})`);
  console.log("[usage-poller] claude.ai 탭에서 로그인해주세요.");
  return true;
}

// Windows: fetch usage via Chrome DevTools Protocol (CDP)
function pollViaWindows() {
  const scriptPath = path.join(__dirname, "scripts", "poll-usage.ps1");
  try {
    const result = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
      { timeout: 15000, encoding: "utf-8" }
    ).trim();

    if (result === "NO_TAB") {
      console.log("[usage-poller] No claude.ai tab found in CDP Chrome. claude.ai에 로그인되어 있는지 확인하세요.");
      return null;
    }
    if (result.startsWith("ERR:") || result === "WAIT") {
      console.error("[usage-poller] CDP error:", result);
      return null;
    }

    return JSON.parse(result);
  } catch (err) {
    console.error("[usage-poller] Windows CDP error:", err.message?.split("\n")[0]);
    return null;
  }
}

function poll() {
  const data = IS_MAC ? pollViaChromeAppleScript() : IS_WIN ? pollViaWindows() : null;
  if (!data || (data.s == null && data.w == null)) return;

  try {
    const usageData = {
      five_hour: data.s != null ? { used_percentage: data.s, resets_at_iso: data.sReset } : null,
      seven_day: data.w != null ? { used_percentage: data.w, resets_at_iso: data.wReset } : null,
      seven_day_sonnet: data.m != null ? { used_percentage: data.m, resets_at_iso: data.mReset } : null,
      last_updated: Date.now(),
    };
    fs.writeFileSync(USAGE_PATH, JSON.stringify(usageData));
    console.log(`[usage-poller] Updated: S=${data.s}% W=${data.w}% M=${data.m}%`);
  } catch (err) {
    console.error("[usage-poller] File write error:", err.message);
  }
}

function startPoller(intervalMs = 60000) {
  if (!IS_MAC && !IS_WIN) {
    console.log("[usage-poller] Polling not supported on this platform.");
    return false;
  }

  // Windows: auto-launch CDP Chrome
  if (IS_WIN) {
    launchCdpChrome();
  }

  const method = IS_MAC ? "AppleScript" : "CDP (Chrome DevTools Protocol)";
  console.log(`[usage-poller] Starting (interval: ${intervalMs / 1000}s, method: ${method})`);
  // Windows: 첫 폴링은 Chrome 로딩 시간을 위해 10초 후 실행
  if (IS_WIN) {
    setTimeout(() => poll(), 10000);
  } else {
    poll();
  }
  intervalId = setInterval(poll, intervalMs);
  return true;
}

function stopPoller() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
  console.log("[usage-poller] Stopped");
}

function isPollerActive() {
  return !!intervalId;
}

module.exports = { startPoller, stopPoller, isPollerActive, poll };
