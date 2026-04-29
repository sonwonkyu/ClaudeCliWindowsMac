# Claude Code Web

**터미널 없이 브라우저에서 Claude Code를 사용하세요.**

[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/overview)를 브라우저 UI로 감싼 경량 웹 앱입니다. 세션 영구 저장, 실시간 사용량 게이지, 모델 전환, 파일 첨부를 지원합니다. **macOS**와 **Windows** 모두 지원합니다.

![Claude Code Web Screenshot](docs/screenshot.png)

> **Session sidebar** (left) · **Diff view for edits** (center) · **S/W/M usage gauges** (top right)

---

## 왜 만들었나요?

Claude Code CLI는 강력하지만 터미널에 익숙하지 않은 팀원에게는 진입장벽이 있습니다. 이 프로젝트는 CLI의 기능을 그대로 유지하면서 웹 UI로 감싸서, 누구나 브라우저에서 쉽게 사용할 수 있도록 만들었습니다.

---

## 주요 기능

### 채팅 UI
- 스트리밍 응답 + 마크다운 렌더링 (코드 블록, 테이블, 목록)
- 한글/일본어/중국어 IME 지원 (조합 중 Enter 전송 방지)
- Shift+Enter로 여러 줄 입력

### 도구 사용 표시
- **Edit** — diff 뷰 (빨간색 삭제, 초록색 추가)
- **Bash** — 터미널 스타일 (`$` 명령어 + 출력)
- **Read** — 파일 경로 + 내용
- 4개 이상 사용 시 접이식 요약: _"90 tools used (Bash ×12, Read ×65…)"_

### 세션 관리
- **영구 저장** — SQLite에 저장, 서버 재시작 후에도 유지
- **세션 복원** — `--resume`으로 Claude CLI 세션 복원 (추가 토큰 비용 없음)
- **Branch** — 현재 대화를 분기해서 다른 방향 탐색
- **자동 제목** — 첫 메시지로 세션 이름 자동 생성
- **인라인 이름 변경 / 삭제**

### 사용량 게이지 (S / W / M)
헤더에서 Claude API 사용량을 실시간으로 확인:

| 게이지 | 의미 |
|--------|------|
| **S** | 5시간 세션 사용률 % + 리셋까지 남은 시간 |
| **W** | 7일 전체 모델 사용률 % + 리셋 요일/시간 |
| **M** | 7일 Sonnet 전용 사용률 % + 리셋 요일/시간 |

데이터 수집 방식 (폴러 우선):

| 소스 | 방식 | 갱신 시점 |
|------|------|----------|
| CLI statusline | `~/.claude/statusline.sh`가 `/tmp/claude-statusline.json`에 저장 | Claude Code API 호출 시마다 |
| claude.ai API 폴링 | Electron 숨김 창 / AppleScript로 `/api/organizations/{uuid}/usage` 호출 | 60초마다 자동 |

### 모델 선택
입력창의 모델 배지를 클릭해서 순환 전환:

| 모델 | 입력 비용 | 출력 비용 | 추천 용도 |
|------|----------|----------|----------|
| **sonnet** (기본) | $3/M | $15/M | 일반 개발 |
| **opus** | $15/M | $75/M | 복잡한 분석 |
| **haiku** | $0.8/M | $4/M | 간단한 수정 |

### 권한 모드
| 모드 | 동작 |
|------|------|
| `acceptEdits` (기본) | 모든 도구 + 파일 수정 허용 |
| `auto` | 모든 도구 자동 승인 |
| `plan` | 읽기 전용 (파일 수정 없음) |

### 슬래시 명령
`/` 입력 시 자동완성 드롭다운 표시:
- `/clear` — 채팅 초기화 + 새 세션 시작
- `/branch` — 현재 대화 분기
- `/help` — 명령어 목록

### 파일 첨부
- 클립 버튼 클릭, 드래그 앤 드롭, Ctrl/Cmd+V 붙여넣기 지원
- 이미지 썸네일 + 파일 아이콘 미리보기
- Claude가 `Read` 도구로 첨부 파일 분석

---

## 사전 요구사항

- **Node.js** 18 이상
- **Claude Code CLI** 설치 및 인증 완료

```bash
# Claude Code CLI 설치
npm install -g @anthropic-ai/claude-code

# 인증
claude
```

---

## 설치

```bash
git clone https://github.com/sonwonkyu/ClaudeCliWindowsMac.git
cd ClaudeCliWindowsMac
npm install
```

---

## 사용량 게이지 활성화 (선택사항)

CLI statusline 데이터로 S% / W% 게이지를 활성화하려면 설정 스크립트를 실행하세요:

**macOS / Linux** (`jq` 필요 — `brew install jq`)
```bash
bash scripts/setup-statusline.sh
```

**Windows (PowerShell)**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-statusline.ps1
```

스크립트가 `~/.claude/`에 파일을 복사하고 `settings.json`을 자동 업데이트합니다. 이후 Claude Code를 재시작하세요.

---

## 실행

```bash
npm start
```

브라우저에서 `http://localhost:3333` 접속

**포트 변경:**
```bash
PORT=8080 npm start
```

---

## 데스크톱 앱 (Electron)

`desktop/` 폴더에 Electron 래퍼가 포함되어 있습니다. 시스템 트레이, 서버 자동 시작, 사용량 폴링을 위한 로그인 창을 제공합니다.

**macOS:**
```bash
cd desktop && npm install
npm start            # 개발 모드
bash build-app.sh    # .app 빌드
```

**Windows:**
```bash
cd desktop && npm install
npm start            # 개발 모드
npm run build:win    # 설치 파일 빌드
```

> 처음 실행 시 `server.js`가 있는 폴더를 선택하는 다이얼로그가 나타납니다.

---

## 아키텍처

```
브라우저 (index.html)
    ↕ WebSocket
Express 서버 (server.js)
    ↕ stdin/stdout (stream-json)
Claude Code CLI 프로세스
    ↕
파일시스템 / Bash / 도구
```

---

## 주의사항

- `data.db`는 최초 실행 시 자동 생성, 이후 유지됩니다
- 기본 모델: **sonnet** (비용 대비 성능 최적)
- 기본 권한 모드: **acceptEdits** (`--dangerously-skip-permissions` 사용)
- **이 서버를 외부 인터넷에 노출하지 마세요** — 인증 기능이 없습니다. 로컬 전용입니다.

---

## 다국어

- [English](README.md)
- [한국어 (Korean)](#claude-code-web) — 이 문서
- [日本語 (Japanese)](README.ja.md)

---

## 라이선스

MIT
