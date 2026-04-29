# Claude Code Web

**ターミナル不要。ブラウザで Claude Code を使おう。**

[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/overview) をブラウザUIでラップした軽量Webアプリです。セッションの永続保存、リアルタイム使用量ゲージ、モデル切り替え、ファイル添付に対応。**macOS** と **Windows** の両方で動作します。

![Claude Code Web Screenshot](docs/screenshot.png)

> **Session sidebar** (left) · **Diff view for edits** (center) · **S/W/M usage gauges** (top right)

---

## なぜ作ったのか

Claude Code CLI は強力ですが、ターミナルに不慣れなチームメンバーには敷居が高い。このプロジェクトは CLI の機能をそのままに、ブラウザUIでラップすることで誰でも使えるようにしました。

---

## 主な機能

### チャットUI
- ストリーミングレスポンス + Markdownレンダリング（コードブロック、テーブル、リスト）
- 日本語/韓国語/中国語IME対応（変換中のEnter誤送信を防止）
- Shift+Enterで改行入力

### ツール使用表示
- **Edit** — diffビュー（赤：削除、緑：追加）
- **Bash** — ターミナルスタイル（`$` プロンプト + 出力）
- **Read** — ファイルパス + 内容
- 4つ以上のツール使用時は折りたたみ要約: _"90 tools used (Bash ×12, Read ×65…)"_

### セッション管理
- **永続保存** — SQLiteに保存、サーバー再起動後も維持
- **セッション復元** — `--resume` でClaude CLIセッションを復元（追加トークンコストなし）
- **Branch** — 会話を分岐して別方向を探索
- **自動タイトル** — 最初のメッセージからセッション名を自動生成
- **インライン名前変更 / 削除**

### 使用量ゲージ（S / W / M）
ヘッダーでClaude API使用量をリアルタイム確認:

| ゲージ | 意味 |
|--------|------|
| **S** | 5時間セッション使用率 % + リセットまでの残り時間 |
| **W** | 7日間全モデル使用率 % + リセット曜日/時間 |
| **M** | 7日間Sonnet専用使用率 % + リセット曜日/時間 |

データ収集方式（ポーラー優先）:

| ソース | 方式 | 更新タイミング |
|--------|------|--------------|
| CLI statusline | `~/.claude/statusline.sh` → `/tmp/claude-statusline.json` | Claude Code API呼び出しごと |
| claude.ai APIポーリング | Electron隠しウィンドウ / AppleScript で `/api/organizations/{uuid}/usage` を呼び出し | 60秒ごと自動 |

### モデル切り替え
入力バーのモデルバッジをクリックして循環切り替え:

| モデル | 入力コスト | 出力コスト | 推奨用途 |
|--------|-----------|-----------|---------|
| **sonnet**（デフォルト）| $3/M | $15/M | 一般的な開発 |
| **opus** | $15/M | $75/M | 複雑な分析 |
| **haiku** | $0.8/M | $4/M | 簡単な修正 |

### 権限モード
| モード | 動作 |
|--------|------|
| `acceptEdits`（デフォルト）| 全ツール + ファイル編集を許可 |
| `auto` | 全ツールを自動承認 |
| `plan` | 読み取り専用（ファイル変更なし）|

### スラッシュコマンド
`/` を入力するとオートコンプリートドロップダウンが表示:
- `/clear` — チャットリセット + 新しいセッション開始
- `/branch` — 現在の会話を分岐
- `/help` — コマンド一覧

### ファイル添付
- クリップボタン、ドラッグ＆ドロップ、Ctrl/Cmd+V貼り付けに対応
- 画像サムネイル + ファイルアイコンプレビュー
- Claudeが `Read` ツールで添付ファイルを分析

---

## 前提条件

- **Node.js** 18以上
- **Claude Code CLI** インストール済み・認証済み

```bash
# Claude Code CLI インストール
npm install -g @anthropic-ai/claude-code

# 認証
claude
```

---

## インストール

```bash
git clone https://github.com/sonwonkyu/ClaudeCliWindowsMac.git
cd ClaudeCliWindowsMac
npm install
```

---

## 使用量ゲージの有効化（任意）

CLI statuslineデータでS% / W%ゲージを有効化するには:

**macOS / Linux**（`jq` が必要 — `brew install jq`）
```bash
bash scripts/setup-statusline.sh
```

**Windows（PowerShell）**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-statusline.ps1
```

スクリプトが `~/.claude/` にファイルをコピーし、`settings.json` を自動更新します。その後 Claude Code を再起動してください。

---

## 起動

```bash
npm start
```

ブラウザで `http://localhost:3333` を開く

**ポート変更:**
```bash
PORT=8080 npm start
```

---

## デスクトップアプリ（Electron）

`desktop/` フォルダにElectronラッパーが含まれています。システムトレイ、サーバー自動起動、使用量ポーリング用ログインウィンドウを提供します。

**macOS:**
```bash
cd desktop && npm install
npm start            # 開発モード
bash build-app.sh    # .appビルド
```

**Windows:**
```bash
cd desktop && npm install
npm start            # 開発モード
npm run build:win    # インストーラービルド
```

> 初回起動時に `server.js` があるフォルダを選択するダイアログが表示されます。

---

## 注意事項

- `data.db` は初回実行時に自動生成され、以降は維持されます
- デフォルトモデル: **sonnet**（コストパフォーマンス最適）
- デフォルト権限モード: **acceptEdits**（`--dangerously-skip-permissions` 使用）
- **このサーバーを外部インターネットに公開しないでください** — 認証機能がありません。ローカル専用です。

---

## 多言語

- [English](README.md)
- [한국어 (Korean)](README.ko.md)
- [日本語 (Japanese)](#claude-code-web) — このドキュメント

---

## ライセンス

MIT
