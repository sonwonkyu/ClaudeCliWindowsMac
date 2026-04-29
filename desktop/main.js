const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  shell,
  dialog,
  ipcMain,
} = require("electron");
const path = require("path");
const { spawn, exec } = require("child_process");
const http = require("http");
const fs = require("fs");
const os = require("os");
const kill = require("tree-kill");

// ── Debug log ──
const DEBUG_LOG = "/tmp/claude-code-web-debug.txt";
function dbg(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(" ")}\n`;
  try { fs.appendFileSync(DEBUG_LOG, line); } catch {}
  console.log(...args);
}
fs.writeFileSync(DEBUG_LOG, `=== Claude Code Web start ${new Date().toISOString()} ===\n`);

// ── Constants ──
const APP_NAME = "Claude Code Web";
const SERVER_PORT = 3333;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const IS_MAC = process.platform === "darwin";
const IS_WIN = process.platform === "win32";
const IS_PACKAGED = app.isPackaged;

// ── Server path config ──
// Stored in ~/Library/Application Support/Claude Code Web/config.json
// First run: user selects directory via dialog
const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveConfig(data) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

// Dev mode: use parent directory; Packaged: read embedded server-path.json
const SERVER_DIR_DEV = path.join(__dirname, "..");
const EMBEDDED_PATH = path.join(__dirname, "server-path.json");
let SERVER_DIR = fs.existsSync(path.join(SERVER_DIR_DEV, "server.js"))
  ? SERVER_DIR_DEV  // running as `electron .` in dev
  : fs.existsSync(EMBEDDED_PATH)
    ? JSON.parse(fs.readFileSync(EMBEDDED_PATH, "utf-8")).serverDir
    : (loadConfig().serverDir || "");

dbg("IS_PACKAGED:", IS_PACKAGED);
dbg("SERVER_DIR:", SERVER_DIR);
dbg("CONFIG_PATH:", CONFIG_PATH);

// ── Usage polling via hidden BrowserWindow ──
const USAGE_PATH = path.join(os.platform() === "win32" ? os.tmpdir() : "/tmp", "claude-usage-poll.json");
let usageWindow = null;
let usagePollInterval = null;

const USAGE_JS = `
(async () => {
  try {
    const orgs = await (await fetch('/api/organizations')).json();
    if (!orgs || !orgs[0]) return 'NOT_LOGGED_IN';
    const uuid = orgs[0].uuid;
    const usage = await (await fetch('/api/organizations/' + uuid + '/usage')).json();
    return JSON.stringify({
      s: usage.five_hour ? Math.round(usage.five_hour.utilization) : null,
      w: usage.seven_day ? Math.round(usage.seven_day.utilization) : null,
      m: usage.seven_day_sonnet ? Math.round(usage.seven_day_sonnet.utilization) : null,
      sReset: usage.five_hour ? usage.five_hour.resets_at : null,
      wReset: usage.seven_day ? usage.seven_day.resets_at : null,
      mReset: usage.seven_day_sonnet ? usage.seven_day_sonnet.resets_at : null,
    });
  } catch(e) {
    return 'ERR:' + e.message;
  }
})()
`;

async function pollUsageFromWindow() {
  if (!usageWindow || usageWindow.isDestroyed()) return;
  try {
    const result = await usageWindow.webContents.executeJavaScript(USAGE_JS);
    if (!result || result === 'NOT_LOGGED_IN' || result.startsWith('ERR:')) {
      console.log('[Usage] Poll result:', result);
      // If not logged in, briefly show the window so user can log in
      if (result === 'NOT_LOGGED_IN' && !usageWindow.isVisible()) {
        usageWindow.show();
        usageWindow.focus();
      }
      return;
    }
    const data = JSON.parse(result);
    const usageData = {
      five_hour: data.s != null ? { used_percentage: data.s, resets_at_iso: data.sReset } : null,
      seven_day: data.w != null ? { used_percentage: data.w, resets_at_iso: data.wReset } : null,
      seven_day_sonnet: data.m != null ? { used_percentage: data.m, resets_at_iso: data.mReset } : null,
      last_updated: Date.now(),
    };
    fs.writeFileSync(USAGE_PATH, JSON.stringify(usageData));
    console.log(`[Usage] S=${data.s}% W=${data.w}% M=${data.m}%`);
  } catch (err) {
    console.error('[Usage] Error:', err.message);
  }
}

function createUsageWindow() {
  usageWindow = new BrowserWindow({
    width: 480,
    height: 700,
    show: false,
    title: 'Claude Code Web - Claude.ai 로그인',
    webPreferences: {
      partition: 'persist:claudeai',  // 세션 영구 저장
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  usageWindow.loadURL('https://claude.ai');

  // 페이지 로딩 완료 시마다 로그인 여부를 API로 확인
  usageWindow.webContents.on('did-finish-load', async () => {
    const url = usageWindow.webContents.getURL();
    console.log('[Usage] Loaded:', url);
    if (!url.includes('claude.ai')) return;
    // 잠시 후 API 폴링 시도
    setTimeout(async () => {
      const result = await usageWindow.webContents.executeJavaScript(USAGE_JS).catch(() => null);
      if (result && result !== 'NOT_LOGGED_IN' && !result.startsWith('ERR:')) {
        // 로그인 성공 → 숨기고 데이터 저장
        if (usageWindow && !usageWindow.isDestroyed()) usageWindow.hide();
        try {
          const data = JSON.parse(result);
          const usageData = {
            five_hour: data.s != null ? { used_percentage: data.s, resets_at_iso: data.sReset } : null,
            seven_day: data.w != null ? { used_percentage: data.w, resets_at_iso: data.wReset } : null,
            seven_day_sonnet: data.m != null ? { used_percentage: data.m, resets_at_iso: data.mReset } : null,
            last_updated: Date.now(),
          };
          fs.writeFileSync(USAGE_PATH, JSON.stringify(usageData));
          console.log(`[Usage] S=${data.s}% W=${data.w}% M=${data.m}%`);
        } catch {}
      }
    }, 2000);
  });

  usageWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      usageWindow.hide();
    }
  });

  usageWindow.on('closed', () => {
    usageWindow = null;
  });

  // 페이지 로딩 완료 후 첫 폴링 시도
  usageWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => pollUsageFromWindow(), 2000);
  });

  // 주기적 폴링 (60초)
  usagePollInterval = setInterval(() => pollUsageFromWindow(), 60000);
}

function stopUsagePoller() {
  if (usagePollInterval) {
    clearInterval(usagePollInterval);
    usagePollInterval = null;
  }
}

// ── State ──
let mainWindow = null;
let tray = null;
let serverProcess = null;
let serverRunning = false;
let isQuitting = false;

// ── Single instance lock ──
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  // Another instance is running — bring it to front and exit
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
dbg("Single instance lock acquired:", gotTheLock);

// ── Icon helper ──
function getIcon() {
  const iconName = IS_WIN ? "ai-icon.ico" : "ai-icon.png";
  const iconPath = path.join(__dirname, iconName);
  let icon = nativeImage.createFromPath(iconPath);
  // Tray icon should be small
  if (!icon.isEmpty()) {
    icon = icon.resize({ width: 18, height: 18 });
  }
  return icon;
}

function getWindowIcon() {
  const iconName = IS_WIN ? "ai-icon.ico" : "ai-icon.png";
  return path.join(__dirname, iconName);
}

// ── Port kill utility ──
function killPort(port) {
  return new Promise((resolve) => {
    if (IS_WIN) {
      exec(
        `for /f "tokens=5" %a in ('netstat -aon ^| findstr :${port} ^| findstr LISTENING') do taskkill /F /PID %a`,
        { shell: "cmd.exe", windowsHide: true },
        () => resolve()
      );
    } else {
      exec(`lsof -ti :${port} | xargs kill -9 2>/dev/null`, () => resolve());
    }
  });
}

// ── Server health check ──
function checkServer(url, timeout = 2000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

// ── Wait for server to be ready ──
function waitForServer(url, maxAttempts = 30, interval = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      checkServer(url).then((ok) => {
        if (ok) {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error("서버 시작 시간이 초과되었습니다."));
        } else {
          setTimeout(check, interval);
        }
      });
    };
    check();
  });
}

// ── Start server ──
async function startServer() {
  if (serverRunning && serverProcess) {
    console.log("[Claude Code Web] Server already running");
    return;
  }

  // Kill anything on the port first
  await killPort(SERVER_PORT);
  await new Promise((r) => setTimeout(r, 500));

  return new Promise((resolve, reject) => {
    // Find node binary - app bundles have limited PATH
    let nodePath = IS_WIN ? "node.exe" : "/opt/homebrew/bin/node";
    if (!IS_WIN && !fs.existsSync(nodePath)) {
      const fallbacks = ["/usr/local/bin/node", "/usr/bin/node"];
      for (const p of fallbacks) {
        if (fs.existsSync(p)) { nodePath = p; break; }
      }
    }
    dbg("Using node:", nodePath);
    const serverScript = path.join(SERVER_DIR, "server.js");

    dbg(`Starting server: ${nodePath} ${serverScript}`);
    dbg(`Working directory: ${SERVER_DIR}`);

    serverProcess = spawn(nodePath, [serverScript], {
      cwd: SERVER_DIR,
      env: { ...process.env, PORT: String(SERVER_PORT), ELECTRON_APP: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      detached: !IS_WIN,
      windowsHide: true,
    });

    serverProcess.stdout.on("data", (data) => {
      dbg(`[Server] ${data.toString().trim()}`);
    });

    serverProcess.stderr.on("data", (data) => {
      dbg(`[Server ERR] ${data.toString().trim()}`);
    });

    serverProcess.on("error", (err) => {
      console.error("[Claude Code Web] Failed to start server:", err.message);
      serverRunning = false;
      serverProcess = null;
      reject(err);
    });

    serverProcess.on("exit", (code, signal) => {
      console.log(
        `[Claude Code Web] Server exited: code=${code}, signal=${signal}`
      );
      serverRunning = false;
      serverProcess = null;

      if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.executeJavaScript(`
          document.title = "Claude Code Web - 서버 중지됨";
        `).catch(() => {});
      }
    });

    // Wait for the server to respond
    waitForServer(SERVER_URL, 30, 1000)
      .then(() => {
        serverRunning = true;
        dbg("Server is ready!");
        updateTrayMenu();
        resolve();
      })
      .catch((err) => {
        dbg("Server failed to start:", err.message);
        reject(err);
      });
  });
}

// ── Stop server ──
function stopServer() {
  return new Promise((resolve) => {
    if (!serverProcess) {
      serverRunning = false;
      resolve();
      return;
    }

    const pid = serverProcess.pid;
    console.log(`[Claude Code Web] Stopping server (PID: ${pid})`);

    kill(pid, "SIGTERM", (err) => {
      if (err) {
        console.error("[Claude Code Web] Error killing server:", err.message);
        // Force kill
        kill(pid, "SIGKILL", () => {});
      }
      serverProcess = null;
      serverRunning = false;
      updateTrayMenu();
      resolve();
    });
  });
}

// ── Restart server ──
async function restartServer() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadFile(path.join(__dirname, "loading.html"));
  }
  await stopServer();
  await new Promise((r) => setTimeout(r, 1000));
  try {
    await startServer();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(SERVER_URL);
    }
  } catch (err) {
    showError("서버 재시작 실패", err.message);
  }
}

// ── Error dialog ──
function showError(title, message) {
  dialog.showMessageBox(mainWindow, {
    type: "error",
    title: title,
    message: message,
    buttons: ["재시작", "종료"],
    defaultId: 0,
  }).then((result) => {
    if (result.response === 0) {
      restartServer();
    } else {
      app.quit();
    }
  });
}

// ── Create main window ──
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: APP_NAME,
    icon: getWindowIcon(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
    backgroundColor: "#1a1a2e",
  });

  // Show loading screen first
  mainWindow.loadFile(path.join(__dirname, "loading.html"));
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // macOS: hide window instead of closing
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      if (IS_MAC) {
        mainWindow.hide();
      } else {
        // Windows: minimize to tray
        mainWindow.hide();
      }
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── Tray ──
function createTray() {
  tray = new Tray(getIcon());
  tray.setToolTip(APP_NAME);
  updateTrayMenu();

  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });

  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;

  const statusLabel = serverRunning ? "서버 실행 중" : "서버 중지됨";
  const contextMenu = Menu.buildFromTemplate([
    { label: `${APP_NAME} — ${statusLabel}`, enabled: false },
    { type: "separator" },
    {
      label: "시작",
      enabled: !serverRunning,
      click: async () => {
        try {
          await startServer();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL(SERVER_URL);
            mainWindow.show();
          }
        } catch (err) {
          showError("서버 시작 실패", err.message);
        }
      },
    },
    {
      label: "중지",
      enabled: serverRunning,
      click: async () => {
        await stopServer();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadFile(path.join(__dirname, "loading.html"));
        }
      },
    },
    {
      label: "재시작",
      click: () => restartServer(),
    },
    { type: "separator" },
    {
      label: "브라우저 열기",
      click: () => shell.openExternal(SERVER_URL),
    },
    {
      label: "창 보기",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "서버 폴더 변경...",
      click: async () => {
        const chosen = await selectServerDir();
        if (chosen) {
          SERVER_DIR = chosen;
          restartServer();
        }
      },
    },
    {
      label: "Usage 새로고침",
      click: () => pollUsageFromWindow(),
    },
    {
      label: "Claude.ai 로그인 창",
      click: () => {
        if (usageWindow && !usageWindow.isDestroyed()) {
          usageWindow.show();
          usageWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "종료",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// ── Select server directory (first run or reconfigure) ──
async function selectServerDir() {
  const saved = loadConfig().serverDir;
  const defaultPath = saved && fs.existsSync(saved)
    ? path.dirname(saved)   // 저장된 경로의 부모 폴더
    : app.getPath("home");  // 없으면 홈 폴더
  const result = await dialog.showOpenDialog({
    title: "Claude Code Web 서버 폴더 선택",
    message: "ClaudeCliWindowsMac 폴더를 선택하세요 (server.js가 있는 폴더)",
    properties: ["openDirectory"],
    defaultPath,
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const chosen = result.filePaths[0];
  if (!fs.existsSync(path.join(chosen, "server.js"))) {
    await dialog.showMessageBox({ type: "error", message: "선택한 폴더에 server.js가 없습니다.\n올바른 ClaudeCliWindowsMac 폴더를 선택해주세요." });
    return selectServerDir();
  }
  saveConfig({ ...loadConfig(), serverDir: chosen });
  return chosen;
}

// ── App lifecycle ──
app.whenReady().then(async () => {
  app.setName(APP_NAME);

  createTray();
  createWindow();
  createUsageWindow();  // Usage polling window (hidden)

  // Resolve server directory
  if (!SERVER_DIR || !fs.existsSync(path.join(SERVER_DIR, "server.js"))) {
    dbg("No server dir configured, asking user...");
    const chosen = await selectServerDir();
    if (!chosen) {
      dialog.showMessageBox({ type: "error", message: "서버 폴더가 선택되지 않아 종료합니다." });
      app.quit();
      return;
    }
    SERVER_DIR = chosen;
  }
  dbg("SERVER_DIR resolved:", SERVER_DIR);

  try {
    await startServer();
    dbg("loadURL:", SERVER_URL);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(SERVER_URL).then(() => dbg("loadURL done")).catch(e => dbg("loadURL error:", e.message));
    } else {
      dbg("mainWindow not available!");
    }
  } catch (err) {
    dbg("Initial server start failed:", err.message);
    showError("서버 시작 실패", err.message);
  }
});

// macOS: re-create window on dock click
app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
    if (serverRunning) {
      mainWindow.loadURL(SERVER_URL);
    }
  } else {
    mainWindow.show();
  }
});

// Prevent default quit on all windows closed (macOS behavior)
app.on("window-all-closed", () => {
  if (!IS_MAC) {
    // On Windows/Linux, don't quit — tray keeps the app alive
  }
});

app.on("before-quit", async (event) => {
  isQuitting = true;
  stopUsagePoller();
  if (serverProcess) {
    event.preventDefault();
    await stopServer();
    await killPort(SERVER_PORT);
    app.quit();
  }
});
