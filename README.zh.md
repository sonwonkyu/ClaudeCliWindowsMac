# Claude Code Web

**无需终端，直接在浏览器中使用 Claude Code。**

这是一个轻量级 Web UI，将 [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/overview) 封装到浏览器界面中，支持持久化会话、实时用量仪表盘、模型切换和文件附件。支持 **macOS** 和 **Windows**。

![Claude Code Web Screenshot](docs/screenshot.png)

> **Session sidebar** (left) · **Diff view for edits** (center) · **S/W/M usage gauges** (top right)

---

## 为什么要做这个？

Claude Code CLI 功能强大，但对不熟悉终端的团队成员有一定门槛。本项目在保留 CLI 全部功能的同时，提供浏览器 UI，让任何人都能轻松上手。

---

## 主要功能

### 聊天界面
- 流式响应 + Markdown 渲染（代码块、表格、列表）
- 支持中文/日文/韩文输入法（防止输入法组合时误发送）
- Shift+Enter 换行输入

### 工具调用展示
- **Edit** — diff 视图（红色删除，绿色新增）
- **Bash** — 终端风格（`$` 提示符 + 输出）
- **Read** — 文件路径 + 内容
- 4个以上工具时折叠摘要：_"90 tools used (Bash ×12, Read ×65…)"_

### 会话管理
- **持久化存储** — 存储于 SQLite，重启后依然保留
- **会话恢复** — 通过 `--resume` 恢复 Claude CLI 会话（无额外 token 消耗）
- **分支** — 将当前对话分叉以探索不同方向
- **自动命名** — 根据第一条消息自动生成会话名称
- **内联重命名 / 删除**

### 用量仪表盘（S / W / M）
在页头实时查看 Claude API 用量：

| 仪表盘 | 含义 |
|--------|------|
| **S** | 5小时会话使用率 % + 距重置时间 |
| **W** | 7天全模型使用率 % + 重置日期/时间 |
| **M** | 7天 Sonnet 专属使用率 % + 重置日期/时间 |

数据采集方式（轮询器优先）：

| 来源 | 方式 | 更新时机 |
|------|------|---------|
| CLI statusline | `~/.claude/statusline.sh` 写入 `/tmp/claude-statusline.json` | 每次 Claude Code API 调用时 |
| claude.ai API 轮询 | Electron 隐藏窗口 / AppleScript 调用 `/api/organizations/{uuid}/usage` | 每60秒自动 |

### 模型切换
点击输入栏的模型标签循环切换：

| 模型 | 输入成本 | 输出成本 | 推荐场景 |
|------|---------|---------|---------|
| **sonnet**（默认）| $3/M | $15/M | 日常开发 |
| **opus** | $15/M | $75/M | 复杂分析 |
| **haiku** | $0.8/M | $4/M | 简单修改 |

### 权限模式
| 模式 | 行为 |
|------|------|
| `acceptEdits`（默认）| 允许所有工具 + 文件修改 |
| `auto` | 自动批准所有工具 |
| `plan` | 只读（不修改文件）|

### 斜杠命令
输入 `/` 显示自动补全下拉菜单：
- `/clear` — 重置聊天 + 开始新会话
- `/branch` — 分叉当前对话
- `/help` — 显示命令列表

### 文件附件
- 支持点击按钮、拖拽上传、Ctrl/Cmd+V 粘贴图片
- 图片缩略图 + 文件图标预览
- Claude 通过 `Read` 工具分析附件

---

## 前提条件

- **Node.js** 18+
- **Claude Code CLI** 已安装并完成认证

```bash
# 安装 Claude Code CLI
npm install -g @anthropic-ai/claude-code

# 认证
claude
```

---

## 安装

```bash
git clone https://github.com/sonwonkyu/ClaudeCliWindowsMac.git
cd ClaudeCliWindowsMac
npm install
```

---

## 启用用量仪表盘（可选）

**macOS / Linux**（需要 `jq` — `brew install jq`）
```bash
bash scripts/setup-statusline.sh
```

**Windows（PowerShell）**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-statusline.ps1
```

脚本会自动复制文件到 `~/.claude/` 并更新 `settings.json`。之后重启 Claude Code 即可。

---

## 运行

```bash
npm start
```

在浏览器中打开 `http://localhost:3333`

**自定义端口：**
```bash
PORT=8080 npm start
```

---

## 桌面应用（Electron）

`desktop/` 目录包含 Electron 封装，提供系统托盘、服务器自动启动和用量轮询登录窗口。

**macOS：**
```bash
cd desktop && npm install
npm start            # 开发模式
bash build-app.sh    # 构建 .app
```

**Windows：**
```bash
cd desktop && npm install
npm start            # 开发模式
npm run build:win    # 构建安装包
```

> 首次启动时会弹出对话框，要求选择包含 `server.js` 的文件夹。

---

## 注意事项

- `data.db` 在首次运行时自动创建，后续持久保留
- 默认模型：**sonnet**（性价比最优）
- 默认权限模式：**acceptEdits**（使用 `--dangerously-skip-permissions`）
- **请勿将此服务器暴露到公网** — 没有认证功能，仅供本地使用。

---

## 多语言

- [English](README.md)
- [한국어 (Korean)](README.ko.md)
- [日本語 (Japanese)](README.ja.md)
- [中文 (Chinese)](#claude-code-web) — 本文档
- [Español (Spanish)](README.es.md)
- [Français (French)](README.fr.md)
- [Deutsch (German)](README.de.md)
- [Русский (Russian)](README.ru.md)
- [ภาษาไทย (Thai)](README.th.md)
- [Tiếng Việt (Vietnamese)](README.vi.md)
- [العربية (Arabic)](README.ar.md)

---

## 许可证

MIT
