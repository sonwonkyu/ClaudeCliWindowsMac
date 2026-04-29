# Claude.ai Usage API 연동 문서

## 목적

claude.ai 앱의 **설정 > 사용량** 페이지에서 보여주는 플랜 사용량 한도(세션/주간)를
프로젝트의 헤더 게이지바에 직접 표시하기 위한 기능.

기존에는 Claude Code CLI의 stream-json 출력(`rate_limit_event`, `result` 이벤트)에서
사용량을 받아왔으나, CLI를 사용하지 않는 경우에도 사용량을 확인할 수 있도록
claude.ai의 내부 API를 직접 호출하는 방식으로 변경.

---

## 아키텍처 개요

```
[브라우저]                    [서버 (server.js)]              [claude.ai]
   |                              |                              |
   |-- Settings에서 sessionKey 입력 -->|                         |
   |                              |-- POST config.json 저장      |
   |                              |                              |
   |-- Save 클릭 ----------------->|                              |
   |                              |-- GET /api/organizations --> |
   |                              |<-- orgId 응답 --------------|
   |                              |-- GET /usage -------------->|
   |                              |<-- usage 응답 --------------|
   |<-- 게이지 즉시 업데이트 -------|                              |
   |                              |                              |
   |-- 질의 전송 (WebSocket) ----->|                              |
   |                              |-- Claude CLI 처리            |
   |                              |-- result 이벤트 수신          |
   |                              |-- fetchClaudeUsage() ------>|
   |                              |<-- usage 응답 --------------|
   |<-- done 이벤트 (S/W/W-S) ----|                              |
   |                              |                              |
   |-- pollStatus (5초) --------->|                              |
   |                              |-- latestUsage 반환 (API호출X) |
   |<-- 게이지 유지 --------------|                              |
```

---

## claude.ai API 정보

### 인증

- **인증 수단**: `sessionKey` 쿠키 (형식: `sk-ant-sid01-...`)
- **획득 방법**: claude.ai > F12 > Application > Cookies > `sessionKey`
- **수명**: 비공식. 로그아웃 시 만료. 보통 수일~수주 유지
- **Cloudflare 우회**: `User-Agent`, `Referer`, `Origin` 헤더 필수

### 필수 헤더

```javascript
const apiHeaders = {
  "cookie": `sessionKey=${sessionKey}`,
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Referer": "https://claude.ai/settings/usage",
  "Origin": "https://claude.ai",
};
```

> 헤더 없이 호출하면 Cloudflare가 403으로 차단함

### 엔드포인트

| 엔드포인트 | 메서드 | 용도 |
|---|---|---|
| `https://claude.ai/api/organizations` | GET | orgId(UUID) 조회 |
| `https://claude.ai/api/organizations/{orgId}/usage` | GET | 사용량 조회 |

### Usage API 응답 형태

```json
{
  "five_hour": {
    "utilization": 61,
    "resets_at": "2026-04-06T10:00:00.661098+00:00"
  },
  "seven_day": {
    "utilization": 40,
    "resets_at": "2026-04-10T04:00:00.661120+00:00"
  },
  "seven_day_oauth_apps": null,
  "seven_day_opus": null,
  "seven_day_sonnet": {
    "utilization": 11,
    "resets_at": "2026-04-09T04:00:00.661130+00:00"
  },
  "seven_day_cowork": null,
  "iguana_necktie": null,
  "extra_usage": {
    "is_enabled": false,
    "monthly_limit": null,
    "used_credits": null,
    "utilization": null
  }
}
```

### 필드 매핑

| API 필드 | 게이지 | 의미 |
|---|---|---|
| `five_hour.utilization` | **S** | 현재 세션 (5시간 한도) |
| `five_hour.resets_at` | S 리셋 시간 | ISO 8601 문자열 |
| `seven_day.utilization` | **W** | 주간 한도 - 모든 모델 |
| `seven_day.resets_at` | W 리셋 시간 | ISO 8601 문자열 |
| `seven_day_sonnet.utilization` | **W-S** | 주간 한도 - Sonnet만 |
| `seven_day_sonnet.resets_at` | W-S 리셋 시간 | ISO 8601 문자열 |

---

## 서버 변경 사항 (server.js)

### 1. config.json 관리

```javascript
// 프로젝트 루트에 config.json 생성/관리
const configPath = path.join(__dirname, "config.json");
function loadConfig() { try { return JSON.parse(fs.readFileSync(configPath, "utf-8")); } catch { return {}; } }
function saveConfig(cfg) { fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2)); }
```

config.json 구조:
```json
{
  "sessionKey": "sk-ant-sid01-...",
  "orgId": "ec169dea-c4eb-4a51-9a1e-10d1e98f2a62",
  "latestUsage": { ... }
}
```

- `sessionKey`: 사용자가 Settings에서 입력한 값
- `orgId`: 최초 호출 시 자동 조회 후 저장 (이후 재사용)
- `latestUsage`: 마지막 API 응답 저장 (서버 재시작 시 복원용)

### 2. API 엔드포인트

#### GET /api/claude-session
sessionKey 설정 상태 확인
```json
{ "hasKey": true, "orgId": "ec169dea-..." }
```

#### POST /api/claude-session
sessionKey/orgId 저장
```json
// 요청
{ "sessionKey": "sk-ant-sid01-..." }
// 응답
{ "ok": true }
```

#### GET /api/claude-usage-raw
claude.ai API를 호출해서 원본 usage 응답 반환 (디버그/Settings 테스트용)

#### GET /api/status (변경됨)
기존: statusline 파일에서 S/W/C 반환
변경: `latestUsage` 메모리 변수에서 S/W/W-S 반환 (추가 API 호출 없음)

```javascript
app.get("/api/status", (req, res) => {
  if (latestUsage) {
    res.json({
      s: latestUsage.five_hour ? { pct: latestUsage.five_hour.utilization, resetsAt: latestUsage.five_hour.resets_at } : {},
      w: latestUsage.seven_day ? { pct: latestUsage.seven_day.utilization, resetsAt: latestUsage.seven_day.resets_at } : {},
      ws: latestUsage.seven_day_sonnet ? { pct: latestUsage.seven_day_sonnet.utilization, resetsAt: latestUsage.seven_day_sonnet.resets_at } : {},
    });
  } else {
    res.json({ s: {}, w: {}, ws: {} });
  }
});
```

### 3. fetchClaudeUsage() 함수

claude.ai API를 호출해서 usage 데이터를 가져오는 핵심 함수.

```javascript
let latestUsage = loadConfig().latestUsage || null; // 서버 시작 시 config.json에서 복원

async function fetchClaudeUsage() {
  const cfg = loadConfig();
  if (!cfg.sessionKey) return null;

  const apiHeaders = {
    "cookie": `sessionKey=${cfg.sessionKey}`,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...",
    "Accept": "application/json",
    "Referer": "https://claude.ai/settings/usage",
    "Origin": "https://claude.ai",
  };

  try {
    // orgId 없으면 자동 조회
    if (!cfg.orgId) {
      const orgRes = await fetch("https://claude.ai/api/organizations", { headers: apiHeaders });
      if (!orgRes.ok) return null;
      const orgs = await orgRes.json();
      if (orgs.length > 0) { cfg.orgId = orgs[0].uuid; saveConfig(cfg); }
      else return null;
    }

    const res = await fetch(`https://claude.ai/api/organizations/${cfg.orgId}/usage`, { headers: apiHeaders });
    if (!res.ok) return null;
    latestUsage = await res.json();
    // config.json에도 저장 (서버 재시작 시 복원용)
    const cfg2 = loadConfig();
    cfg2.latestUsage = latestUsage;
    saveConfig(cfg2);
    return latestUsage;
  } catch (e) {
    return null;
  }
}
```

호출 시점:
- **질의 완료 시** (`result` 이벤트 핸들러에서 `await fetchClaudeUsage()`)
- **Settings Save 시** (`GET /api/claude-usage-raw` → `fetchClaudeUsage()`)
- **pollStatus (5초 폴링)에서는 호출하지 않음** — `latestUsage` 변수만 반환

### 4. handleEvent를 async로 변경

`result` 이벤트에서 `await fetchClaudeUsage()`를 쓰기 위해 필요:

```javascript
// 변경 전
function handleEvent(data) {
// 변경 후
async function handleEvent(data) {
```

### 5. result 이벤트에서 done 메시지에 W-S 포함

```javascript
// result 이벤트 핸들러 내부
let sPct = null, wPct = null, wsPct = null, sResetsAt = null, wResetsAt = null, wsResetsAt = null;
const usage = await fetchClaudeUsage();
if (usage) {
  if (usage.five_hour) { sPct = usage.five_hour.utilization; sResetsAt = usage.five_hour.resets_at; }
  if (usage.seven_day) { wPct = usage.seven_day.utilization; wResetsAt = usage.seven_day.resets_at; }
  if (usage.seven_day_sonnet) { wsPct = usage.seven_day_sonnet.utilization; wsResetsAt = usage.seven_day_sonnet.resets_at; }
}
wsSend({
  type: "done", text: data.result || "",
  cost: data.total_cost_usd, duration: data.duration_ms,
  sessionId: data.session_id, cPct,
  sPct, wPct, wsPct, sResetsAt, wResetsAt, wsResetsAt
});
```

---

## 프론트엔드 변경 사항 (public/index.html)

### 1. 헤더 게이지바 변경

기존: `S | W | C`
변경: `S | W | W-S`

```html
<div class="header-center">
  <span class="gauge-group"><span class="gauge-label">S:</span><span class="gauge-bar" id="barS"></span><span class="gauge-pct" id="pctS">-%</span><span class="gauge-time" id="timeS"></span></span>
  <span class="gauge-sep">|</span>
  <span class="gauge-group"><span class="gauge-label">W:</span><span class="gauge-bar" id="barW"></span><span class="gauge-pct" id="pctW">-%</span><span class="gauge-time" id="timeW"></span></span>
  <span class="gauge-sep">|</span>
  <span class="gauge-group"><span class="gauge-label">W-S:</span><span class="gauge-bar" id="barWS"></span><span class="gauge-pct" id="pctWS">-%</span><span class="gauge-time" id="timeWS"></span></span>
</div>
```

### 2. formatRemaining 함수 수정

ISO 8601 문자열 지원 추가 (claude.ai는 ISO 문자열을 반환):

```javascript
// 변경 전: Unix timestamp(숫자)만 처리
function formatRemaining(r) { if(!r)return""; const d=Math.max(0,r-Math.floor(Date.now()/1000)); ... }

// 변경 후: ISO 문자열도 처리
function formatRemaining(r) {
  if(!r)return"";
  let ts;
  if(typeof r==="string") ts=Math.floor(new Date(r).getTime()/1000);
  else ts=r;
  const d=Math.max(0,ts-Math.floor(Date.now()/1000));
  if(d<=0)return"now";
  const dd=Math.floor(d/86400),hh=Math.floor(d%86400/3600),mm=Math.floor(d%3600/60);
  return dd>0?`${dd}d${hh}h`:hh>0?`${hh}h${mm}m`:`${mm}m`;
}
```

### 3. pollStatus 함수 변경

```javascript
async function pollStatus() {
  try {
    const r = await fetch("/api/status");
    const d = await r.json();
    if(d.s?.pct!=null) { updateGauge("S",d.s.pct); document.getElementById("timeS").textContent=formatRemaining(d.s.resetsAt); }
    if(d.w?.pct!=null) { updateGauge("W",d.w.pct); document.getElementById("timeW").textContent=formatRemaining(d.w.resetsAt); }
    if(d.ws?.pct!=null){ updateGauge("WS",d.ws.pct); document.getElementById("timeWS").textContent=formatRemaining(d.ws.resetsAt); }
  } catch{}
}
```

### 4. done 이벤트 핸들러 변경

C 게이지 제거, W-S 추가:

```javascript
if (msg.type==="done") {
  if(streamText===""&&msg.text) appendText(msg.text);
  finalizeAssistant({duration:msg.duration, cost:msg.cost});
  if(msg.sPct!=null) { updateGauge("S",msg.sPct); document.getElementById("timeS").textContent=formatRemaining(msg.sResetsAt); }
  if(msg.wPct!=null) { updateGauge("W",msg.wPct); document.getElementById("timeW").textContent=formatRemaining(msg.wResetsAt); }
  if(msg.wsPct!=null){ updateGauge("WS",msg.wsPct); document.getElementById("timeWS").textContent=formatRemaining(msg.wsResetsAt); }
  pollStatus();
  streamText="";
  setStreaming(false);
  loadSessions();
}
```

### 5. Settings 모달 추가

#### CSS

```css
.settings-modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 100; align-items: center; justify-content: center; }
.settings-modal.open { display: flex; }
.settings-dialog { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; width: 480px; max-width: 90vw; }
.settings-dialog h3 { font-size: 16px; margin-bottom: 16px; color: var(--text); }
.settings-field { margin-bottom: 12px; }
.settings-field label { font-size: 13px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 6px; }
.settings-field input { width: 100%; padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-family: 'JetBrains Mono', monospace; font-size: 12px; outline: none; }
.settings-field input:focus { border-color: var(--accent); }
.settings-hint { font-size: 11px; color: #52525b; margin-top: 4px; }
.settings-status { font-size: 12px; margin-top: 8px; padding: 6px 10px; border-radius: 6px; display: none; }
.settings-status.ok { display: block; background: rgba(34,197,94,0.1); color: #22c55e; }
.settings-status.err { display: block; background: rgba(239,68,68,0.1); color: #ef4444; }
.sidebar-footer { padding: 12px 8px; border-top: 1px solid var(--border); }
.settings-btn { width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--border); background: transparent; color: var(--text-muted); font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.15s; }
.settings-btn:hover { background: var(--surface2); color: var(--text); }
```

#### HTML

사이드바 하단에 Settings 버튼:
```html
<div class="sidebar-footer">
  <button class="settings-btn" onclick="openSettings()">&#9881; Settings</button>
</div>
```

Settings 모달 (CWD 모달 앞에 위치):
```html
<div class="settings-modal" id="settingsModal" onclick="if(event.target===this)closeSettings()">
  <div class="settings-dialog">
    <h3>Settings</h3>
    <div class="settings-field">
      <label>Claude Session Key</label>
      <input type="password" id="sessionKeyInput" placeholder="sk-ant-sid01-..." />
      <div class="settings-hint">claude.ai > F12 > Application > Cookies > sessionKey</div>
    </div>
    <div class="settings-status" id="settingsStatus"></div>
    <div class="cwd-buttons" style="margin-top:16px;">
      <button class="cwd-btn-cancel" onclick="closeSettings()">Cancel</button>
      <button class="cwd-btn-ok" onclick="saveSessionKey()">Save</button>
    </div>
  </div>
</div>
```

#### JavaScript

```javascript
function openSettings() {
  document.getElementById("settingsModal").classList.add("open");
  const statusEl = document.getElementById("settingsStatus");
  statusEl.className = "settings-status"; statusEl.textContent = "";
  fetch("/api/claude-session").then(r=>r.json()).then(d => {
    const inp = document.getElementById("sessionKeyInput");
    if (d.hasKey) inp.placeholder = "********** (already set)";
    else inp.placeholder = "sk-ant-sid01-...";
  });
}

function closeSettings() {
  document.getElementById("settingsModal").classList.remove("open");
}

async function saveSessionKey() {
  const key = document.getElementById("sessionKeyInput").value.trim();
  const statusEl = document.getElementById("settingsStatus");
  if (!key) { statusEl.className="settings-status err"; statusEl.textContent="Session key를 입력하세요."; return; }
  statusEl.className="settings-status ok"; statusEl.textContent="저장 중...";
  try {
    // 1. sessionKey 저장
    await fetch("/api/claude-session", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ sessionKey: key })
    });
    // 2. 연결 테스트 + 게이지 즉시 반영
    const r = await fetch("/api/claude-usage-raw");
    if (r.ok) {
      const u = await r.json();
      if (u.five_hour) { updateGauge("S", u.five_hour.utilization); document.getElementById("timeS").textContent = formatRemaining(u.five_hour.resets_at); }
      if (u.seven_day) { updateGauge("W", u.seven_day.utilization); document.getElementById("timeW").textContent = formatRemaining(u.seven_day.resets_at); }
      if (u.seven_day_sonnet) { updateGauge("WS", u.seven_day_sonnet.utilization); document.getElementById("timeWS").textContent = formatRemaining(u.seven_day_sonnet.resets_at); }
      statusEl.className="settings-status ok"; statusEl.textContent="연결 성공!";
      document.getElementById("sessionKeyInput").value = "";
      setTimeout(closeSettings, 1500);
    } else {
      const err = await r.json();
      statusEl.className="settings-status err"; statusEl.textContent="연결 실패: " + (err.error || "unknown error");
    }
  } catch(e) {
    statusEl.className="settings-status err"; statusEl.textContent="오류: " + e.message;
  }
}
```

---

## 데이터 흐름 요약

| 시점 | claude.ai API 호출 | S/W/W-S 갱신 방법 |
|---|---|---|
| 서버 시작 | X (config.json에서 latestUsage 복원) | 복원된 값으로 /api/status 응답 |
| Settings Save | O (fetchClaudeUsage) | 프론트에서 raw 응답으로 직접 updateGauge |
| 질의 완료 (result) | O (fetchClaudeUsage) | done 이벤트의 sPct/wPct/wsPct로 updateGauge |
| pollStatus (5초) | X | /api/status → latestUsage 값 그대로 반환 |

---

## 롤백 체크리스트

이 기능을 제거하고 원래 statusline 기반으로 되돌릴 때:

### server.js

1. `// ── Claude.ai usage API ──` 블록 전체 삭제 (configPath ~ fetchClaudeUsage, /api/claude-session, /api/claude-usage-raw)
2. `latestUsage` 변수 삭제
3. `/api/status`를 원래 statusline 파일 읽기로 복원:
   ```javascript
   app.get("/api/status", (req, res) => {
     try {
       const raw = fs.readFileSync(statuslinePath, "utf-8");
       const data = JSON.parse(raw);
       res.json({
         s: { pct: data.rate_limits?.five_hour?.used_percentage ?? 0, resetsAt: data.rate_limits?.five_hour?.resets_at ?? null },
         w: { pct: data.rate_limits?.seven_day?.used_percentage ?? 0, resetsAt: data.rate_limits?.seven_day?.resets_at ?? null },
         c: { pct: data.context_window?.used_percentage ?? 0 },
       });
     } catch {
       res.json({ s: {}, w: {}, c: { pct: 0 } });
     }
   });
   ```
4. `handleEvent`를 `async function` → `function`으로 복원
5. result 이벤트의 S/W 게이지 부분을 statusline 읽기로 복원
6. 서버 시작 시 초기 fetch 호출 제거

### public/index.html

1. Settings 관련 CSS 전체 삭제 (`.settings-modal` ~ `.settings-btn:hover`)
2. 사이드바 footer (`sidebar-footer`) 삭제
3. Settings 모달 HTML 삭제
4. Settings JS 함수 삭제 (`openSettings`, `closeSettings`, `saveSessionKey`)
5. 헤더 게이지를 `S | W | C`로 복원 (W-S 제거, C 추가)
6. `pollStatus`에서 `ws` 제거, `c` 복원
7. `done` 이벤트에서 `wsPct` 제거, `cPct` 복원
8. `session_loaded`에서 `updateGauge("C", msg.cPct||0)` 복원
9. `cleared`에서 `updateGauge("C",0)` 복원
10. 초기화에서 `barWS` 제거, `updateGauge("C",0)` 복원
11. `formatRemaining`의 ISO 문자열 처리는 유지해도 무방 (하위호환)

### 파일

- `config.json` 삭제 (sessionKey, orgId, latestUsage 포함)
- `.gitignore`에 config.json이 있다면 제거
