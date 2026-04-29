# Claude Code Web

**Nutze Claude Code direkt im Browser — ohne Terminal.**

Eine leichtgewichtige Web-UI, die [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/overview) mit persistenten Sitzungen, Echtzeit-Nutzungsanzeigen, Modellwechsel und Dateianhängen kapselt. Unterstützt **macOS** und **Windows**.

![Claude Code Web Screenshot](docs/screenshot.png)

> **Session sidebar** (left) · **Diff view for edits** (center) · **S/W/M usage gauges** (top right)

---

## Warum dieses Projekt?

Claude Code CLI ist mächtig, erfordert aber ein Terminal. Dieses Projekt kapselt es in einer sauberen Browser-UI, sodass jedes Teammitglied es ohne Terminalerfahrung nutzen kann.

---

## Funktionen

### Chat-Interface
- Streaming-Antworten mit Markdown-Rendering (Codeblöcke, Tabellen, Listen)
- IME-Unterstützung für asiatische Sprachen
- Zeilenumbruch mit Shift+Enter

### Tool-Anzeige
- **Edit** — Diff-Ansicht (Löschungen rot, Hinzufügungen grün)
- **Bash** — Terminal-Stil (`$` Prompt + Ausgabe)
- **Read** — Dateipfad + Inhalt
- Einklappbare Zusammenfassung bei 4+ Tools: _"90 tools used (Bash ×12, Read ×65…)"_

### Sitzungsverwaltung
- **Persistenz** — in SQLite gespeichert, übersteht Neustarts
- **Wiederherstellung** — nimmt Claude CLI-Sitzung mit `--resume` wieder auf (keine Extra-Token-Kosten)
- **Branch** — aktuelles Gespräch verzweigen
- **Auto-Titel** — aus der ersten Nachricht generiert
- **Umbenennen / Löschen** direkt in der Liste

### Nutzungsanzeigen (S / W / M)

| Anzeige | Bedeutung |
|---------|----------|
| **S** | 5-Stunden-Sitzungsnutzung % + Zeit bis Reset |
| **W** | 7-Tage-Gesamtnutzung % + Reset-Tag/-Uhrzeit |
| **M** | 7-Tage Sonnet-Nutzung % |

### Modellwechsel

| Modell | Eingabe | Ausgabe | Empfohlen für |
|--------|---------|---------|--------------|
| **sonnet** (Standard) | $3/M | $15/M | Allgemeine Entwicklung |
| **opus** | $15/M | $75/M | Komplexe Analysen |
| **haiku** | $0.8/M | $4/M | Schnelle Bearbeitungen |

### Berechtigungsmodi
| Modus | Verhalten |
|-------|----------|
| `acceptEdits` (Standard) | Alle Tools + Dateibearbeitung erlaubt |
| `auto` | Alle Tools automatisch genehmigt |
| `plan` | Nur-Lesen (keine Dateiänderungen) |

### Slash-Befehle
`/` eingeben für Autovervollständigung:
- `/clear` — Chat zurücksetzen + neue Sitzung
- `/branch` — Gespräch verzweigen
- `/help` — Befehlsliste anzeigen

### Dateianhänge
- Clip-Button, Drag & Drop oder Einfügen mit Ctrl/Cmd+V
- Bildvorschau + Datei-Icons

---

## Voraussetzungen

- **Node.js** 18+
- **Claude Code CLI** installiert und authentifiziert

```bash
npm install -g @anthropic-ai/claude-code
claude
```

---

## Installation

```bash
git clone https://github.com/sonwonkyu/ClaudeCliWindowsMac.git
cd ClaudeCliWindowsMac
npm install
```

---

## Nutzungsanzeigen aktivieren (Optional)

**macOS / Linux** (benötigt `jq` — `brew install jq`)
```bash
bash scripts/setup-statusline.sh
```

**Windows (PowerShell)**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-statusline.ps1
```

---

## Starten

```bash
npm start
```

Öffne `http://localhost:3333` im Browser.

**Benutzerdefinierter Port:**
```bash
PORT=8080 npm start
```

---

## Desktop-App (Electron)

`desktop/` enthält einen Electron-Wrapper mit System-Tray, automatischem Server-Start und Login-Fenster für die Nutzungsabfrage.

**macOS:**
```bash
cd desktop && npm install && bash build-app.sh
```

**Windows:**
```bash
cd desktop && npm install && npm run build:win
```

---

## Hinweise

- `data.db` wird beim ersten Start automatisch erstellt
- Standardmodell: **sonnet**
- **Diesen Server nicht im Internet exponieren** — keine Authentifizierung. Nur für lokale Nutzung.

---

## Sprachen

- [English](README.md)
- [한국어 (Korean)](README.ko.md)
- [日本語 (Japanese)](README.ja.md)
- [中文 (Chinese)](README.zh.md)
- [Español (Spanish)](README.es.md)
- [Français (French)](README.fr.md)
- [Deutsch (German)](#claude-code-web) — dieses Dokument
- [Русский (Russian)](README.ru.md)
- [ภาษาไทย (Thai)](README.th.md)
- [Tiếng Việt (Vietnamese)](README.vi.md)
- [العربية (Arabic)](README.ar.md)

---

## Lizenz

MIT
