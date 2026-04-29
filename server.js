const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const multer = require("multer");

const os = require("os");
const { startPoller, stopPoller, isPollerActive, poll: pollUsage } = require("./usage-poller");

const HOME_DIR = os.homedir();
const IS_WIN = process.platform === "win32";

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || ".bin";
      cb(null, Date.now() + "-" + Math.random().toString(36).slice(2, 6) + ext);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// ── Database ── 
const db = new Database(path.join(__dirname, "data.db"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    cwd TEXT DEFAULT '~',
    perm_mode TEXT DEFAULT 'acceptEdits',
    claude_session_id TEXT,
    total_tokens INTEGER DEFAULT 0,
    pinned INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    tool_data TEXT,
    meta TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );
`);

// Migrate existing tables — add columns if missing
try { db.exec("ALTER TABLE sessions ADD COLUMN pinned INTEGER DEFAULT 0"); } catch {}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Express ──
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err.message);
});

// Statusline API — merges CLI statusline + usage poller data
const statuslinePath = path.join(IS_WIN ? os.tmpdir() : "/tmp", "claude-statusline.json");
const usagePollPath = path.join(IS_WIN ? os.tmpdir() : "/tmp", "claude-usage-poll.json");

function getStatusData() {
  let cli = {}, poll = {};
  try { cli = JSON.parse(fs.readFileSync(statuslinePath, "utf-8")); } catch {}
  try { poll = JSON.parse(fs.readFileSync(usagePollPath, "utf-8")); } catch {}
  // Poller data takes priority only when resets_at_iso is present (confirms valid API response)
  const sValid = poll.five_hour?.resets_at_iso != null;
  const wValid = poll.seven_day?.resets_at_iso != null;
  const mValid = poll.seven_day_sonnet?.resets_at_iso != null;
  const sPct = sValid ? poll.five_hour.used_percentage : (cli.rate_limits?.five_hour?.used_percentage ?? 0);
  const wPct = wValid ? poll.seven_day.used_percentage : (cli.rate_limits?.seven_day?.used_percentage ?? 0);
  const mPct = mValid ? poll.seven_day_sonnet.used_percentage : 0;
  const sResetIso = poll.five_hour?.resets_at_iso ?? null;
  const wResetIso = poll.seven_day?.resets_at_iso ?? null;
  const mResetIso = poll.seven_day_sonnet?.resets_at_iso ?? null;
  const sResetAt = cli.rate_limits?.five_hour?.resets_at ?? null;
  const wResetAt = cli.rate_limits?.seven_day?.resets_at ?? null;
  return {
    s: { pct: sPct, resetsAt: sResetAt, resetsAtIso: sResetIso },
    w: { pct: wPct, resetsAt: wResetAt, resetsAtIso: wResetIso },
    m: { pct: mPct, resetsAtIso: mResetIso },
    c: { pct: cli.context_window?.used_percentage ?? 0 },
    lastUpdated: poll.last_updated ?? null,
  };
}

app.get("/api/status", (req, res) => {
  res.json(getStatusData());
});

// File upload
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  res.json({
    path: req.file.path,
    name: req.file.originalname,
    size: req.file.size,
    type: req.file.mimetype,
  });
});

// Serve uploaded files for preview
app.use("/uploads", express.static(uploadsDir));

// Global permission mode
let globalPermMode = "acceptEdits";
let globalModel = "sonnet";

app.get("/api/perm", (req, res) => {
  res.json({ mode: globalPermMode });
});

app.post("/api/perm", (req, res) => {
  const valid = ["acceptEdits", "auto", "plan"];
  if (valid.includes(req.body.mode)) globalPermMode = req.body.mode;
  res.json({ mode: globalPermMode });
});

// Global model
app.get("/api/model", (req, res) => {
  res.json({ model: globalModel });
});

app.post("/api/model", (req, res) => {
  const valid = ["opus", "sonnet", "haiku"];
  if (valid.includes(req.body.model)) globalModel = req.body.model;
  res.json({ model: globalModel });
});

// Home directory & platform info
app.get("/api/home", (req, res) => {
  res.json({ home: HOME_DIR, isWin: IS_WIN });
});

// Drive list (Windows only)
app.get("/api/drives", (req, res) => {
  if (!IS_WIN) return res.json({ drives: [] });
  const drives = [];
  for (let c = 65; c <= 90; c++) { // A-Z
    const letter = String.fromCharCode(c);
    const drivePath = letter + ":\\";
    try {
      fs.accessSync(drivePath);
      drives.push(drivePath);
    } catch {}
  }
  res.json({ drives });
});

// Directory listing
app.get("/api/dirs", (req, res) => {
  const dir = path.resolve(req.query.path || HOME_DIR);
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith("."))
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b));
    res.json({ path: dir, dirs });
  } catch {
    res.json({ path: dir, dirs: [], error: "Cannot read directory" });
  }
});

// Session CRUD
app.get("/api/sessions", (req, res) => {
  const sessions = db.prepare("SELECT * FROM sessions ORDER BY updated_at DESC").all();
  res.json(sessions);
});

app.post("/api/sessions", (req, res) => {
  const id = genId();
  const name = req.body.name || "New Chat";
  const cwd = req.body.cwd || HOME_DIR;
  const perm_mode = req.body.perm_mode || "acceptEdits";
  db.prepare("INSERT INTO sessions (id, name, cwd, perm_mode) VALUES (?, ?, ?, ?)").run(id, name, cwd, perm_mode);
  res.json({ id, name, cwd, perm_mode });
});

app.patch("/api/sessions/:id", (req, res) => {
  if (req.body.name) db.prepare("UPDATE sessions SET name = ? WHERE id = ?").run(req.body.name, req.params.id);
  if (req.body.perm_mode) db.prepare("UPDATE sessions SET perm_mode = ? WHERE id = ?").run(req.body.perm_mode, req.params.id);
  if (req.body.pinned !== undefined) db.prepare("UPDATE sessions SET pinned = ? WHERE id = ?").run(req.body.pinned ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

app.delete("/api/sessions/:id", (req, res) => {
  // Recursively collect this session + all descendants (branches of branches)
  const toDelete = [];
  const stack = [req.params.id];
  const getChildren = db.prepare("SELECT id FROM sessions WHERE parent_id = ?");
  while (stack.length) {
    const id = stack.pop();
    toDelete.push(id);
    for (const row of getChildren.all(id)) stack.push(row.id);
  }
  const delMsgs = db.prepare("DELETE FROM messages WHERE session_id = ?");
  const delSess = db.prepare("DELETE FROM sessions WHERE id = ?");
  const tx = db.transaction((ids) => {
    for (const id of ids) { delMsgs.run(id); delSess.run(id); }
  });
  tx(toDelete);
  res.json({ ok: true, deleted: toDelete.length });
});

// ── Branch helpers ──
// Must match cwdToDirName exactly (same encoding Claude Code uses for project directories)
// Mac/Linux: /Users/foo/project → -Users-foo-project
// Windows:   D:\Git\project    → d--Git-project  (lowercase drive, : and \ → -)
function cwdToProjectKey(cwd) {
  if (IS_WIN) {
    return cwd.replace(/^([A-Za-z]):/, (_, d) => d.toLowerCase() + "-").replace(/[\\/]/g, "-");
  }
  return cwd.replace(/\//g, "-");
}

function saveMemoryOnBranch(src, newId, branchName) {
  try {
    const cwd = src.cwd || HOME_DIR;
    const projectKey = cwdToProjectKey(cwd);
    const memoryDir = path.join(HOME_DIR, '.claude', 'projects', projectKey, 'memory');
    fs.mkdirSync(memoryDir, { recursive: true });

    const now = new Date().toISOString();
    const branchFile = `branch_${newId}.md`;
    const branchContent = `---
name: Branch Session - ${branchName}
description: ${branchName} 브랜치 생성 기록 (원본: ${src.name})
type: project
---

**브랜치 이름:** ${branchName}
**원본 세션:** ${src.name}
**생성 시각:** ${now}
**작업 디렉토리:** ${cwd}

**Why:** 원본 세션(${src.name})에서 대화를 분기하여 독립적인 탐색 경로 시작
**How to apply:** 이 브랜치는 원본 세션의 전체 메시지 컨텍스트를 상속받았으며, 독립적으로 대화를 이어갈 수 있음
`;
    fs.writeFileSync(path.join(memoryDir, branchFile), branchContent, 'utf-8');

    const memoryIndexPath = path.join(memoryDir, 'MEMORY.md');
    const entry = `- [${branchName}](${branchFile}) — ${src.name}에서 분기 (${now.slice(0, 10)})\n`;
    if (fs.existsSync(memoryIndexPath)) {
      const existing = fs.readFileSync(memoryIndexPath, 'utf-8');
      if (!existing.includes(branchFile)) {
        fs.writeFileSync(memoryIndexPath, existing.trimEnd() + '\n' + entry, 'utf-8');
      }
    } else {
      fs.writeFileSync(memoryIndexPath, `# Memory Index\n\n${entry}`, 'utf-8');
    }
  } catch (err) {
    console.error('[branch-memory] Failed to save branch memory:', err.message);
  }
}

// Copy parent's Claude JSONL session file so the branch gets independent conversation history.
// Without this, parent and branch share the same JSONL → both append to it → context conflict.
// Returns a new claude_session_id string, or null if copy failed (branch will start fresh).
function copyClaudeSessionForBranch(src) {
  if (!src.claude_session_id) return null;
  try {
    const cwd = src.cwd || HOME_DIR;
    const projectKey = cwdToProjectKey(cwd);
    const projectDir = path.join(HOME_DIR, '.claude', 'projects', projectKey);
    const srcJsonl = path.join(projectDir, `${src.claude_session_id}.jsonl`);
    if (!fs.existsSync(srcJsonl)) return null;

    const { randomUUID } = require('crypto');
    const newSessionId = randomUUID();
    const dstJsonl = path.join(projectDir, `${newSessionId}.jsonl`);

    // Replace the old session_id with the new one inside the JSONL content
    const content = fs.readFileSync(srcJsonl, 'utf-8');
    const updated = content.split(src.claude_session_id).join(newSessionId);
    fs.writeFileSync(dstJsonl, updated, 'utf-8');
    return newSessionId;
  } catch (err) {
    console.error('[branch-session] Failed to copy JSONL:', err.message);
    return null;
  }
}

// Branch
app.post("/api/sessions/:id/branch", (req, res) => {
  const src = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!src) return res.status(404).json({ error: "not found" });
  const newId = genId();
  const name = req.body.name || `${src.name} (branch)`;

  // Give the branch its own JSONL copy so it doesn't share/conflict with the parent's session file.
  // Falls back to null (fresh session) if the JSONL doesn't exist yet.
  const branchClaudeSessionId = copyClaudeSessionForBranch(src);

  db.prepare("INSERT INTO sessions (id, name, parent_id, cwd, perm_mode, total_tokens, claude_session_id) VALUES (?, ?, ?, ?, ?, ?, ?)").run(newId, name, src.id, src.cwd, src.perm_mode, src.total_tokens, branchClaudeSessionId);
  // Copy messages
  const msgs = db.prepare("SELECT role, content, tool_data, meta FROM messages WHERE session_id = ? ORDER BY id").all(src.id);
  const ins = db.prepare("INSERT INTO messages (session_id, role, content, tool_data, meta) VALUES (?, ?, ?, ?, ?)");
  for (const m of msgs) ins.run(newId, m.role, m.content, m.tool_data, m.meta);
  // Save branch context to Claude memory files so the new session recognizes its context
  saveMemoryOnBranch(src, newId, name);
  res.json({ id: newId, name });
});

// Messages
app.get("/api/sessions/:id/messages", (req, res) => {
  const msgs = db.prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY id").all(req.params.id);
  res.json(msgs);
});

// Truncate messages from a given message id (inclusive). Used to "restart from this point".
// Also clears claude_session_id so the next turn starts a fresh Claude SDK session
// (Claude CLI --resume cannot be rewound mid-conversation).
app.delete("/api/sessions/:id/messages/from/:msgId", (req, res) => {
  const { id, msgId } = req.params;
  const info = db.prepare("DELETE FROM messages WHERE session_id = ? AND id >= ?").run(id, msgId);
  db.prepare("UPDATE sessions SET claude_session_id = NULL, total_tokens = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  res.json({ ok: true, deleted: info.changes });
});

// ── Storage API ──
const claudeProjectsDir = path.join(HOME_DIR, ".claude", "projects");
const activeProcessCwds = new Set(); // cwds of currently running claude processes

// Windows: fs 재귀 탐색, Mac/Linux: du -sk 사용
function getDirSizeNode(dirPath) {
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          total += getDirSizeNode(fullPath);
        } else {
          total += fs.statSync(fullPath).size;
        }
      } catch {}
    }
  } catch {}
  return total;
}

function getDirSizeDu(dirPath) {
  try {
    const { execSync } = require("child_process");
    const out = execSync(`du -sk "${dirPath}"`, { timeout: 15000 }).toString();
    return (parseInt(out.split(/\s/)[0], 10) || 0) * 1024;
  } catch { return 0; }
}

const getDirSize = IS_WIN ? getDirSizeNode : getDirSizeDu;

app.get("/api/storage-info", (req, res) => {
  try {
    if (!fs.existsSync(claudeProjectsDir)) return res.json({ total: 0, dirs: [] });
    const entries = fs.readdirSync(claudeProjectsDir, { withFileTypes: true })
      .filter(e => e.isDirectory()).map(e => e.name);
    const results = [];
    let total = 0;
    for (const name of entries) {
      const fullPath = path.join(claudeProjectsDir, name);
      const bytes = getDirSize(fullPath);
      total += bytes;
      results.push({ name, bytes });
    }
    results.sort((a, b) => b.bytes - a.bytes);
    res.json({ total, dirs: results });
  } catch (err) {
    res.json({ total: 0, dirs: [], error: err.message });
  }
});

// cwd 경로를 ~/.claude/projects/ 디렉토리 이름으로 변환
function cwdToDirName(cwd) {
  if (IS_WIN) {
    // D:\Git\project → d--Git-project
    return cwd.replace(/^([A-Za-z]):/, (_, d) => d.toLowerCase() + "-").replace(/[\\/]/g, "-");
  }
  // /home/user/project → -home-user-project
  return cwd.replace(/\//g, "-");
}

app.post("/api/storage-clear", (req, res) => {
  try {
    if (!fs.existsSync(claudeProjectsDir)) return res.json({ ok: true, deleted: 0 });
    // Protect directories for currently running processes
    const protectedDirs = new Set([...activeProcessCwds].map(cwd => cwdToDirName(cwd)));
    // Also protect directories for sessions that exist in the DB
    const dbCwds = db.prepare("SELECT DISTINCT cwd FROM sessions WHERE cwd IS NOT NULL").all();
    for (const row of dbCwds) {
      protectedDirs.add(cwdToDirName(row.cwd));
    }
    const entries = fs.readdirSync(claudeProjectsDir, { withFileTypes: true })
      .filter(e => e.isDirectory()).map(e => e.name);
    // Compute once: all claude_session_ids that are still referenced by a DB session
    const activeClaudeIds = new Set(
      db.prepare("SELECT claude_session_id FROM sessions WHERE claude_session_id IS NOT NULL").all()
        .map(r => r.claude_session_id)
    );
    let deleted = 0;
    for (const name of entries) {
      const dirPath = path.join(claudeProjectsDir, name);
      if (protectedDirs.has(name)) {
        // Protected project: delete only JSONL files not referenced by any DB session.
        // Always preserve memory/.
        try {
          for (const f of fs.readdirSync(dirPath)) {
            if (!f.endsWith('.jsonl')) continue;
            if (!activeClaudeIds.has(f.replace(/\.jsonl$/, ''))) {
              try { fs.rmSync(path.join(dirPath, f), { force: true }); deleted++; } catch {}
            }
          }
        } catch {}
      } else {
        // Unprotected project: delete everything except memory/ subfolder.
        try {
          for (const f of fs.readdirSync(dirPath)) {
            if (f === 'memory') continue;
            try { fs.rmSync(path.join(dirPath, f), { recursive: true, force: true }); deleted++; } catch {}
          }
          // Remove the project dir itself only if memory/ is absent or empty
          const memDir = path.join(dirPath, 'memory');
          if (!fs.existsSync(memDir) || fs.readdirSync(memDir).length === 0) {
            try { fs.rmSync(dirPath, { recursive: true, force: true }); } catch {}
          }
        } catch {}
      }
    }
    res.json({ ok: true, deleted });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Process kill helper (Windows needs taskkill for process tree) ──
function killProc(proc) {
  if (!proc) return;
  try {
    if (IS_WIN && proc.pid) {
      // /t = kill tree (all children), /f = force
      spawn("taskkill", ["/pid", String(proc.pid), "/f", "/t"], { stdio: "ignore", shell: true, windowsHide: true });
    } else if (proc.pid) {
      // Kill the whole process group to also reap Claude CLI's child processes
      try { process.kill(-proc.pid, "SIGKILL"); } catch {}
      try { proc.kill("SIGKILL"); } catch {}
    }
  } catch {}
}

// ── WebSocket ──
wss.on("connection", (ws) => {
  const WATCHDOG_MS = 5 * 60 * 1000; // 5 minutes with no activity = hung
  let contextWindow = 1000000;
  let activeDbSessionId = null; // 현재 화면에 표시 중인 세션 ID

  // 세션별 독립 상태 (여러 세션이 동시에 살아있을 수 있음)
  const sessionCtxs = new Map();

  function getCtx(sid) {
    if (!sessionCtxs.has(sid)) {
      sessionCtxs.set(sid, {
        proc: null,
        claudeSessionId: null,
        buffer: "",
        pendingText: "",
        currentToolUses: {},
        watchdog: null,
        totalTokens: 0,
        isClearing: false,
        sessionCwd: HOME_DIR,
        sessionPermMode: "acceptEdits",
        doneWasSent: false, // done 이벤트가 이미 전송됐는지 여부 (set_session race condition 방지)
      });
    }
    return sessionCtxs.get(sid);
  }

  function wsSend(obj) {
    if (ws.readyState === 1) ws.send(JSON.stringify(obj));
  }

  function broadcastRunningSessions() {
    const running = [];
    for (const [sid, ctx] of sessionCtxs) {
      if (ctx.proc && !ctx.doneWasSent) running.push(sid);
    }
    wsSend({ type: "running_sessions", sessions: running });
  }

  function resetWatchdog(sid) {
    const ctx = getCtx(sid);
    if (ctx.watchdog) clearTimeout(ctx.watchdog);
    ctx.watchdog = setTimeout(() => {
      if (ctx.proc) {
        console.error(`[watchdog] No activity for 5min on session ${sid}, killing stuck process`);
        wsSend({ type: "error", text: "⚠️ 5분 이상 응답 없음 — 프로세스를 강제 종료했습니다.", sessionId: sid });
        savePartialIfAny(sid, "(타임아웃)");
        ctx.isClearing = true;
        killProc(ctx.proc);
        ctx.proc = null;
        ctx.isClearing = false;
        wsSend({ type: "process_ended", sessionId: sid });
        broadcastRunningSessions();
      }
    }, WATCHDOG_MS);
  }

  function clearWatchdog(sid) {
    const ctx = getCtx(sid);
    if (ctx.watchdog) { clearTimeout(ctx.watchdog); ctx.watchdog = null; }
  }

  function savePartialIfAny(sid, suffix = "") {
    const ctx = getCtx(sid);
    const tools = Object.values(ctx.currentToolUses);
    const hasContent = (ctx.pendingText && ctx.pendingText.trim()) || tools.length > 0;
    if (!hasContent) return;
    const text = (ctx.pendingText || "") + (suffix ? (ctx.pendingText ? "\n\n" : "") + suffix : "");
    saveMessage(sid, "assistant", text, tools.length > 0 ? tools : null, { partial: true });
    ctx.pendingText = "";
    ctx.currentToolUses = {};
  }

  function saveMessage(sid, role, content, toolData, meta) {
    if (!sid) return null;
    const result = db.prepare("INSERT INTO messages (session_id, role, content, tool_data, meta) VALUES (?, ?, ?, ?, ?)").run(
      sid, role, content, toolData ? JSON.stringify(toolData) : null, meta ? JSON.stringify(meta) : null
    );
    db.prepare("UPDATE sessions SET updated_at = datetime('now') WHERE id = ?").run(sid);
    return Number(result.lastInsertRowid);
  }

  function startProcess(sid) {
    const ctx = getCtx(sid);
    ctx.doneWasSent = false; // 새 요청 시작 시 리셋
    const sess = db.prepare("SELECT cwd, perm_mode, claude_session_id, total_tokens FROM sessions WHERE id = ?").get(sid);
    let cwd = sess?.cwd || HOME_DIR;
    try { if (!fs.existsSync(cwd)) cwd = HOME_DIR; } catch { cwd = HOME_DIR; }
    ctx.sessionCwd = cwd;
    ctx.sessionPermMode = sess?.perm_mode || "acceptEdits";
    if (!ctx.claudeSessionId) ctx.claudeSessionId = sess?.claude_session_id || null;
    if (!ctx.totalTokens) ctx.totalTokens = sess?.total_tokens || 0;
    activeProcessCwds.add(cwd);

    const args = ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--model", globalModel];
    if (globalPermMode === "plan") {
      args.push("--permission-mode", "plan");
    } else {
      args.push("--dangerously-skip-permissions");
    }
    if (ctx.claudeSessionId) {
      args.push("--resume", ctx.claudeSessionId);
    }

    if (IS_WIN) {
      ctx.proc = spawn("claude", args, {
        cwd,
        env: { ...process.env },
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
        windowsHide: true,
      });
    } else {
      ctx.proc = spawn("/bin/zsh", ["-l", "-c", `claude ${args.join(" ")}`], {
        cwd,
        env: { ...process.env, TERM: "xterm-256color" },
        stdio: ["pipe", "pipe", "pipe"],
        detached: true,
      });
    }

    ctx.proc.stdout.on("data", (chunk) => {
      resetWatchdog(sid);
      ctx.buffer += chunk.toString();
      const lines = ctx.buffer.split("\n");
      ctx.buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try { handleEvent(sid, JSON.parse(line)); } catch (e) { console.error("[handleEvent error]", e.message); }
      }
    });

    ctx.proc.stderr.on("data", (chunk) => {
      const text = chunk.toString().trim();
      if (!text) return;
      // Resume failed → clear session ID and retry without --resume
      if (text.includes("No conversation found") && ctx.claudeSessionId) {
        console.log(`[resume-fallback] Session ${ctx.claudeSessionId} not found, starting fresh`);
        const pendingMsg = ctx.pendingUserMsg;
        ctx.claudeSessionId = null;
        ctx.isResumeRetry = true;
        db.prepare("UPDATE sessions SET claude_session_id = NULL WHERE id = ?").run(sid);
        killProc(ctx.proc);
        setTimeout(() => {
          startProcess(sid);
          // Re-send the user message that was lost during failed resume
          if (pendingMsg && ctx.proc) {
            const userMsg = { type: "user", message: { role: "user", content: pendingMsg }, parent_tool_use_id: null, session_id: ctx.claudeSessionId };
            ctx.proc.stdin.write(JSON.stringify(userMsg) + "\n");
            resetWatchdog(sid);
          }
        }, 500);
        return;
      }
      wsSend({ type: "error", text, sessionId: sid });
    });

    ctx.proc.on("close", () => {
      clearWatchdog(sid);
      ctx.proc = null;
      activeProcessCwds.delete(ctx.sessionCwd);
      if (ctx.isResumeRetry) {
        ctx.isResumeRetry = false;
      } else if (!ctx.isClearing) {
        savePartialIfAny(sid, "(중단됨)");
        wsSend({ type: "process_ended", sessionId: sid });
      }
      ctx.isClearing = false;
      broadcastRunningSessions();
    });

    ctx.proc.on("error", (err) => {
      wsSend({ type: "error", text: err.message, sessionId: sid });
      ctx.proc = null;
      broadcastRunningSessions();
    });

    broadcastRunningSessions();
  }

  function handleEvent(sid, data) {
    const ctx = getCtx(sid);

    if (data.type === "system" && data.subtype === "init") {
      ctx.claudeSessionId = data.session_id;
      if (sid) {
        db.prepare("UPDATE sessions SET claude_session_id = ? WHERE id = ?").run(ctx.claudeSessionId, sid);
      }
      wsSend({ type: "init", model: data.model, version: data.claude_code_version, sessionId: ctx.claudeSessionId, dbSessionId: sid });
      return;
    }

    if (data.type === "assistant" && data.message?.content) {
      for (const block of data.message.content) {
        if (block.type === "text" && block.text) {
          ctx.pendingText += block.text;
          wsSend({ type: "text", text: block.text, sessionId: sid });
        }
        if (block.type === "tool_use") {
          ctx.currentToolUses[block.id] = { name: block.name, input: block.input };
          wsSend({ type: "tool_use", toolName: block.name, toolId: block.id, input: block.input, sessionId: sid });
        }
        if (block.type === "thinking" && block.thinking) {
          wsSend({ type: "thinking", text: block.thinking, sessionId: sid });
        }
      }
      return;
    }

    if (data.type === "user" && data.message?.content) {
      for (const block of data.message.content) {
        if (block.type === "tool_result") {
          const tu = ctx.currentToolUses[block.tool_use_id];
          if (tu) tu.result = typeof block.content === "string" ? block.content : JSON.stringify(block.content);
          wsSend({
            type: "tool_result",
            toolId: block.tool_use_id,
            content: tu?.result || "",
            isError: block.is_error || false,
            sessionId: sid,
          });
        }
      }
      return;
    }

    // Rate limit event — update resets_at only, preserve existing used_percentage
    if (data.type === "rate_limit_event" && data.rate_limit_info) {
      const info = data.rate_limit_info;
      try {
        let statusData = {};
        try { statusData = JSON.parse(fs.readFileSync(statuslinePath, "utf-8")); } catch {}
        if (!statusData.rate_limits) statusData.rate_limits = {};
        const key = info.rateLimitType;
        if (key === "five_hour" || key === "seven_day") {
          const existing = statusData.rate_limits[key] || {};
          statusData.rate_limits[key] = { ...existing, resets_at: info.resetsAt };
        }
        fs.writeFileSync(statuslinePath, JSON.stringify(statusData));
      } catch {}
      return;
    }

    if (data.type === "result") {
      clearWatchdog(sid);
      ctx.pendingUserMsg = null;
      if (data.usage) {
        ctx.totalTokens += (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)
          + (data.usage.cache_read_input_tokens || 0) + (data.usage.cache_creation_input_tokens || 0);
        if (sid) {
          db.prepare("UPDATE sessions SET total_tokens = ? WHERE id = ?").run(ctx.totalTokens, sid);
        }
      }
      if (data.modelUsage) {
        const mk = Object.keys(data.modelUsage)[0];
        if (mk && data.modelUsage[mk].contextWindow) contextWindow = data.modelUsage[mk].contextWindow;
      }
      const cPct = Math.min(100, (ctx.totalTokens / contextWindow) * 100);
      const tools = Object.values(ctx.currentToolUses);

      // Update statusline JSON — only merge, never overwrite existing rate_limits
      try {
        let statusData = {};
        try { statusData = JSON.parse(fs.readFileSync(statuslinePath, "utf-8")); } catch {}
        statusData.context_window = { ...statusData.context_window, used_percentage: Math.round(cPct) };
        if (data.usage?.used_percentage_five_hour != null || data.usage?.used_percentage_seven_day != null) {
          if (!statusData.rate_limits) statusData.rate_limits = {};
          if (data.usage.used_percentage_five_hour != null) statusData.rate_limits.five_hour = { ...statusData.rate_limits.five_hour, used_percentage: data.usage.used_percentage_five_hour };
          if (data.usage.used_percentage_seven_day != null) statusData.rate_limits.seven_day = { ...statusData.rate_limits.seven_day, used_percentage: data.usage.used_percentage_seven_day };
        }
        fs.writeFileSync(statuslinePath, JSON.stringify(statusData));
      } catch {}

      // Save assistant message to DB
      try {
        saveMessage(sid, "assistant", ctx.pendingText || data.result || "", tools.length > 0 ? tools : null, {
          cost: data.total_cost_usd, duration: data.duration_ms,
        });
      } catch (e) { console.error("[saveMessage error]", e.message); }
      // Read latest statusline for S/W gauges
      let sPct = null, wPct = null, sResetsAt = null, wResetsAt = null;
      try {
        const statusData = JSON.parse(fs.readFileSync(statuslinePath, "utf-8"));
        sPct = statusData.rate_limits?.five_hour?.used_percentage ?? null;
        wPct = statusData.rate_limits?.seven_day?.used_percentage ?? null;
        sResetsAt = statusData.rate_limits?.five_hour?.resets_at ?? null;
        wResetsAt = statusData.rate_limits?.seven_day?.resets_at ?? null;
      } catch {}
      ctx.doneWasSent = true; // set_session이 늦게 도착해도 isRunning:false 반환하도록
      wsSend({ type: "done", text: data.result || "", cost: data.total_cost_usd, duration: data.duration_ms, sessionId: sid, cPct, sPct, wPct, sResetsAt, wResetsAt });
      ctx.pendingText = "";
      ctx.currentToolUses = {};
      // broadcastRunningSessions는 proc.on("close")에서 처리 (done 시점엔 proc이 아직 살아있어 dot이 재추가됨)
      return;
    }
  }

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === "set_session") {
      activeDbSessionId = msg.sessionId;
      const sess = db.prepare("SELECT cwd, perm_mode, claude_session_id, total_tokens FROM sessions WHERE id = ?").get(activeDbSessionId);
      const ctx = getCtx(activeDbSessionId);
      // 현재 실행 중이 아닌 경우에만 DB 값으로 초기화
      if (!ctx.proc) {
        ctx.claudeSessionId = sess?.claude_session_id || null;
        ctx.totalTokens = sess?.total_tokens || 0;
      }
      ctx.sessionCwd = sess?.cwd || HOME_DIR;
      ctx.sessionPermMode = sess?.perm_mode || "acceptEdits";
      const cPct = Math.min(100, (ctx.totalTokens / contextWindow) * 100);
      const isRunning = !!ctx.proc && !ctx.doneWasSent;
      wsSend({ type: "session_loaded", cPct, cwd: ctx.sessionCwd, permMode: ctx.sessionPermMode, isRunning, sessionId: activeDbSessionId });
      // 백그라운드에서 실행 중인 세션으로 전환 시 지금까지의 진행 내용 전송
      if (isRunning && (ctx.pendingText || Object.keys(ctx.currentToolUses).length > 0)) {
        const toolsArr = Object.entries(ctx.currentToolUses).map(([id, t]) => ({ id, name: t.name, input: t.input, result: t.result }));
        wsSend({ type: "partial_replay", sessionId: activeDbSessionId, text: ctx.pendingText, tools: toolsArr });
      }
      broadcastRunningSessions();
      return;
    }

    if (msg.type === "restart_process") {
      if (activeDbSessionId) {
        const ctx = getCtx(activeDbSessionId);
        if (ctx.proc) { ctx.isClearing = true; killProc(ctx.proc); ctx.proc = null; }
        ctx.claudeSessionId = null;
        ctx.buffer = "";
        ctx.pendingText = "";
        ctx.currentToolUses = {};
      }
      wsSend({ type: "process_restarted" });
      broadcastRunningSessions();
      return;
    }

    if (msg.type === "chat" && msg.text) {
      if (!activeDbSessionId) return;
      const ctx = getCtx(activeDbSessionId);
      if (!ctx.proc) startProcess(activeDbSessionId);
      ctx.pendingUserMsg = msg.text;
      const msgId = saveMessage(activeDbSessionId, "user", msg.text, null, null);
      if (msgId != null) wsSend({ type: "user_msg_id", msgId, sessionId: activeDbSessionId });
      const userMsg = { type: "user", message: { role: "user", content: msg.text }, parent_tool_use_id: null, session_id: ctx.claudeSessionId };
      ctx.proc.stdin.write(JSON.stringify(userMsg) + "\n");
      resetWatchdog(activeDbSessionId);
      return;
    }

    if (msg.type === "clear") {
      if (activeDbSessionId) {
        const ctx = getCtx(activeDbSessionId);
        ctx.isClearing = true;
        if (ctx.proc) { killProc(ctx.proc); ctx.proc = null; }
        ctx.claudeSessionId = null;
        ctx.buffer = "";
        ctx.totalTokens = 0;
        ctx.pendingText = "";
        ctx.currentToolUses = {};
      }
      wsSend({ type: "cleared" });
      broadcastRunningSessions();
      return;
    }

    if (msg.type === "stop" && activeDbSessionId) {
      const ctx = getCtx(activeDbSessionId);
      if (ctx.proc) {
        ctx.isClearing = true;
        savePartialIfAny(activeDbSessionId, "(중단됨)");
        killProc(ctx.proc);
        ctx.proc = null;
        ctx.isClearing = false;
        wsSend({ type: "stopped", sessionId: activeDbSessionId });
        broadcastRunningSessions();
      }
      return;
    }
  });

  ws.on("close", () => {
    for (const [, ctx] of sessionCtxs) {
      if (ctx.proc) { killProc(ctx.proc); }
    }
    sessionCtxs.clear();
  });
});

// Client-side usage polling: receive data from frontend
app.post("/api/usage-update", (req, res) => {
  const { s, w } = req.body || {};
  if (s == null && w == null) return res.status(400).json({ error: "no data" });
  try {
    let statusData = {};
    try { statusData = JSON.parse(fs.readFileSync(statuslinePath, "utf-8")); } catch {}
    if (!statusData.rate_limits) statusData.rate_limits = {};
    if (s != null) statusData.rate_limits.five_hour = { ...statusData.rate_limits.five_hour, used_percentage: s.pct };
    if (w != null) statusData.rate_limits.seven_day = { ...statusData.rate_limits.seven_day, used_percentage: w.pct };
    fs.writeFileSync(statuslinePath, JSON.stringify(statusData));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual usage refresh
app.post("/api/usage-refresh", (req, res) => {
  try {
    pollUsage();
    res.json(getStatusData());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Server restart
app.post("/api/server/restart", (req, res) => {
  res.json({ ok: true });
  setTimeout(() => {
    const child = spawn(process.argv[0], process.argv.slice(1), {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
      env: process.env,
      windowsHide: true,
    });
    child.unref();
    process.exit(0);
  }, 300);
});

const PORT = process.env.PORT || 3333;
server.listen(PORT, () => {
  console.log(`Claude CLI Web running at http://localhost:${PORT}`);
  // Auto-start usage poller (60s interval) - macOS: AppleScript, Windows: CDP
  // Skip when running inside Electron (Electron app handles polling via hidden BrowserWindow)
  if (!process.env.ELECTRON_APP) {
    startPoller(60000);
  }
});
