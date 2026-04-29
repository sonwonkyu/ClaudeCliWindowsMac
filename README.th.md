# Claude Code Web

**ใช้ Claude Code ในเบราว์เซอร์ได้เลย — ไม่ต้องใช้เทอร์มินัล**

เว็บ UI ขนาดเบาที่ครอบ [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/overview) พร้อมเซสชันถาวร, มาตรวัดการใช้งานแบบเรียลไทม์, การเปลี่ยนโมเดล และการแนบไฟล์ รองรับ **macOS** และ **Windows**

![Claude Code Web Screenshot](docs/screenshot.png)

> **Session sidebar** (left) · **Diff view for edits** (center) · **S/W/M usage gauges** (top right)

---

## ทำไมถึงสร้างโปรเจกต์นี้?

Claude Code CLI มีประสิทธิภาพสูง แต่ต้องใช้เทอร์มินัล โปรเจกต์นี้ครอบ CLI ด้วย UI บนเบราว์เซอร์ เพื่อให้ทุกคนในทีมใช้งานได้ง่าย

---

## ฟีเจอร์หลัก

### อินเทอร์เฟซแชท
- การตอบกลับแบบสตรีมพร้อม Markdown rendering (code block, ตาราง, รายการ)
- รองรับ IME สำหรับภาษาเอเชีย
- ขึ้นบรรทัดใหม่ด้วย Shift+Enter

### การแสดงผลเครื่องมือ
- **Edit** — มุมมอง diff (ลบสีแดง, เพิ่มสีเขียว)
- **Bash** — สไตล์เทอร์มินัล (prompt `$` + ผลลัพธ์)
- **Read** — เส้นทางไฟล์ + เนื้อหา
- สรุปแบบย่อได้เมื่อใช้ 4+ เครื่องมือ

### การจัดการเซสชัน
- **จัดเก็บถาวร** — บันทึกใน SQLite รอดแม้เซิร์ฟเวอร์ restart
- **กู้คืนเซสชัน** — ต่อเซสชัน Claude CLI ด้วย `--resume` (ไม่เปลือง token เพิ่ม)
- **Branch (แยกสาขา)** — คัดลอกการสนทนาเพื่อสำรวจทิศทางอื่น แสดงเป็นต้นไม้พับได้ใน sidebar
- **Split View (แบ่งหน้าจอ)** — แสดง 2 เซสชันเคียงกัน แนวนอน/แนวตั้ง (ลากเส้นแบ่งปรับขนาดได้)
- **Pin (ปักหมุด)** — ปักหมุดเซสชันสำคัญไว้ด้านบน sidebar (⭐)
- **ชื่ออัตโนมัติ** — สร้างจากข้อความแรก
- **เปลี่ยนชื่อ / ลบ** ได้ทันที
- **Stop (หยุด)** — หยุดคำตอบ Claude กลางคันด้วยคลิกเดียว
- **ล้างพื้นที่จัดเก็บ** — ลบไฟล์เซสชัน Claude CLI ที่ไม่ใช้แล้วทิ้งทั้งหมด (🗑)

### มาตรวัดการใช้งาน (S / W / M)

| มาตรวัด | ความหมาย |
|---------|---------|
| **S** | การใช้งาน 5 ชั่วโมง % + เวลาถึง reset |
| **W** | การใช้งาน 7 วัน ทุกโมเดล % + วัน/เวลา reset |
| **M** | การใช้งาน 7 วัน Sonnet เท่านั้น % |

### การเปลี่ยนโมเดล

| โมเดล | ต้นทุน input | ต้นทุน output | แนะนำสำหรับ |
|-------|------------|-------------|-----------|
| **sonnet** (ค่าเริ่มต้น) | $3/M | $15/M | การพัฒนาทั่วไป |
| **opus** | $15/M | $75/M | การวิเคราะห์ซับซ้อน |
| **haiku** | $0.8/M | $4/M | แก้ไขเล็กน้อย |

### โหมดสิทธิ์
| โหมด | พฤติกรรม |
|------|---------|
| `acceptEdits` (ค่าเริ่มต้น) | อนุญาตทุกเครื่องมือ + แก้ไขไฟล์ |
| `auto` | อนุมัติทุกเครื่องมืออัตโนมัติ |
| `plan` | อ่านอย่างเดียว |

### Slash Commands
พิมพ์ `/` เพื่อเปิด autocomplete:
- `/clear` — รีเซ็ตแชท + เริ่มเซสชันใหม่
- `/branch` — แยกสาขาการสนทนา
- `/help` — แสดงรายการคำสั่ง

### การแนบไฟล์
- ปุ่ม clip, ลากและวาง หรือวางด้วย Ctrl/Cmd+V
- แสดงตัวอย่างภาพ thumbnail + ไอคอนไฟล์

---

## ความต้องการ

- **Node.js** 18+
- **Claude Code CLI** ติดตั้งและยืนยันตัวตนแล้ว

```bash
npm install -g @anthropic-ai/claude-code
claude
```

---

## การติดตั้ง

```bash
git clone https://github.com/sonwonkyu/ClaudeCliWindowsMac.git
cd ClaudeCliWindowsMac
npm install
```

---

## เปิดใช้มาตรวัดการใช้งาน (ตัวเลือก)

**macOS / Linux** (ต้องการ `jq` — `brew install jq`)
```bash
bash scripts/setup-statusline.sh
```

**Windows (PowerShell)**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-statusline.ps1
```

---

## รัน

```bash
npm start
```

เปิด `http://localhost:3333` ในเบราว์เซอร์

**เปลี่ยน port:**
```bash
PORT=8080 npm start
```

---

## แอปเดสก์ท็อป (Electron)

โฟลเดอร์ `desktop/` มี Electron wrapper พร้อม system tray, เริ่มเซิร์ฟเวอร์อัตโนมัติ และหน้าต่างล็อกอินสำหรับ polling

**macOS:**
```bash
cd desktop && npm install && bash build-app.sh
```

**Windows:**
```bash
cd desktop && npm install && npm run build:win
```

---

## หมายเหตุ

- `data.db` สร้างอัตโนมัติเมื่อรันครั้งแรก
- โมเดลเริ่มต้น: **sonnet**
- **อย่าเปิดเซิร์ฟเวอร์นี้สู่อินเทอร์เน็ต** — ไม่มีระบบยืนยันตัวตน ใช้เฉพาะในเครื่องตัวเองเท่านั้น

---

## ภาษา

- [English](README.md)
- [한국어 (Korean)](README.ko.md)
- [日本語 (Japanese)](README.ja.md)
- [中文 (Chinese)](README.zh.md)
- [Español (Spanish)](README.es.md)
- [Français (French)](README.fr.md)
- [Deutsch (German)](README.de.md)
- [Русский (Russian)](README.ru.md)
- [ภาษาไทย (Thai)](#claude-code-web) — เอกสารนี้
- [Tiếng Việt (Vietnamese)](README.vi.md)
- [العربية (Arabic)](README.ar.md)

---

## สัญญาอนุญาต

MIT
