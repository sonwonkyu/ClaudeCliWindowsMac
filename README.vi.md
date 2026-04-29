# Claude Code Web

**Sử dụng Claude Code ngay trên trình duyệt — không cần terminal.**

Giao diện web nhẹ bọc ngoài [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/overview) với phiên làm việc bền vững, đồng hồ đo mức sử dụng thời gian thực, chuyển đổi model và đính kèm tệp. Hỗ trợ **macOS** và **Windows**.

![Claude Code Web Screenshot](docs/screenshot.png)

> **Session sidebar** (left) · **Diff view for edits** (center) · **S/W/M usage gauges** (top right)

---

## Tại sao tạo dự án này?

Claude Code CLI rất mạnh mẽ nhưng yêu cầu terminal. Dự án này bọc CLI trong giao diện trình duyệt để bất kỳ thành viên nào trong nhóm cũng có thể sử dụng dễ dàng.

---

## Tính năng chính

### Giao diện Chat
- Phản hồi streaming với Markdown rendering (code block, bảng, danh sách)
- Hỗ trợ IME cho tiếng Nhật/Hàn/Trung
- Xuống dòng bằng Shift+Enter

### Hiển thị Công cụ
- **Edit** — chế độ xem diff (xóa màu đỏ, thêm màu xanh)
- **Bash** — phong cách terminal (dấu nhắc `$` + kết quả)
- **Read** — đường dẫn tệp + nội dung
- Tóm tắt thu gọn khi dùng 4+ công cụ

### Quản lý Phiên
- **Lưu trữ bền vững** — lưu trong SQLite, tồn tại qua khởi động lại
- **Khôi phục phiên** — tiếp tục phiên Claude CLI qua `--resume` (không tốn token thêm)
- **Branch (phân nhánh)** — sao chép cuộc trò chuyện để khám phá hướng khác; hiển thị dạng cây có thể thu gọn trong sidebar
- **Split View (chia màn hình)** — hiển thị 2 phiên cạnh nhau, ngang hoặc dọc (kéo thanh phân chia để điều chỉnh)
- **Pin (ghim yêu thích)** — ghim phiên quan trọng lên đầu sidebar (⭐)
- **Đặt tên tự động** — từ tin nhắn đầu tiên
- **Đổi tên / xóa** trực tiếp trong danh sách
- **Stop (dừng)** — ngắt phản hồi Claude giữa chừng bằng một cú nhấp
- **Dọn dẹp bộ nhớ** — xóa các file phiên Claude CLI không dùng nữa (🗑)

### Đồng hồ đo Mức sử dụng (S / W / M)

| Đồng hồ | Ý nghĩa |
|---------|--------|
| **S** | Mức sử dụng phiên 5 giờ % + thời gian đến reset |
| **W** | Mức sử dụng 7 ngày tất cả model % + ngày/giờ reset |
| **M** | Mức sử dụng 7 ngày chỉ Sonnet % |

### Chuyển đổi Model

| Model | Chi phí vào | Chi phí ra | Khuyến nghị cho |
|-------|------------|-----------|----------------|
| **sonnet** (mặc định) | $3/M | $15/M | Phát triển chung |
| **opus** | $15/M | $75/M | Phân tích phức tạp |
| **haiku** | $0.8/M | $4/M | Chỉnh sửa nhanh |

### Chế độ Quyền
| Chế độ | Hành vi |
|--------|--------|
| `acceptEdits` (mặc định) | Tất cả công cụ + chỉnh sửa tệp |
| `auto` | Tự động phê duyệt tất cả công cụ |
| `plan` | Chỉ đọc |

### Lệnh Slash
Gõ `/` để mở autocomplete:
- `/clear` — đặt lại chat + phiên mới
- `/branch` — phân nhánh cuộc trò chuyện
- `/help` — danh sách lệnh

### Đính kèm Tệp
- Nút clip, kéo thả, hoặc dán bằng Ctrl/Cmd+V
- Xem trước: thumbnail ảnh + icon tệp

---

## Yêu cầu

- **Node.js** 18+
- **Claude Code CLI** đã cài đặt và xác thực

```bash
npm install -g @anthropic-ai/claude-code
claude
```

---

## Cài đặt

```bash
git clone https://github.com/sonwonkyu/ClaudeCliWindowsMac.git
cd ClaudeCliWindowsMac
npm install
```

---

## Bật Đồng hồ đo Mức sử dụng (Tùy chọn)

**macOS / Linux** (cần `jq` — `brew install jq`)
```bash
bash scripts/setup-statusline.sh
```

**Windows (PowerShell)**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-statusline.ps1
```

---

## Chạy

```bash
npm start
```

Mở `http://localhost:3333` trong trình duyệt.

**Đổi port:**
```bash
PORT=8080 npm start
```

---

## Ứng dụng Desktop (Electron)

Thư mục `desktop/` chứa Electron wrapper với system tray, tự động khởi động server và cửa sổ đăng nhập cho polling.

**macOS:**
```bash
cd desktop && npm install && bash build-app.sh
```

**Windows:**
```bash
cd desktop && npm install && npm run build:win
```

---

## Lưu ý

- `data.db` được tạo tự động khi chạy lần đầu
- Model mặc định: **sonnet**
- **Không mở server này ra internet** — không có xác thực. Chỉ dùng nội bộ.

---

## Ngôn ngữ

- [English](README.md)
- [한국어 (Korean)](README.ko.md)
- [日本語 (Japanese)](README.ja.md)
- [中文 (Chinese)](README.zh.md)
- [Español (Spanish)](README.es.md)
- [Français (French)](README.fr.md)
- [Deutsch (German)](README.de.md)
- [Русский (Russian)](README.ru.md)
- [ภาษาไทย (Thai)](README.th.md)
- [Tiếng Việt (Vietnamese)](#claude-code-web) — tài liệu này
- [العربية (Arabic)](README.ar.md)

---

## Giấy phép

MIT
