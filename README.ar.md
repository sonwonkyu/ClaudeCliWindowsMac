<div dir="rtl">

# Claude Code Web

**استخدم Claude Code مباشرةً في متصفحك — بدون أي terminal.**

واجهة ويب خفيفة تُغلّف [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/overview) مع جلسات دائمة، ومقاييس استخدام في الوقت الفعلي، وتبديل النماذج، ومرفقات الملفات. يعمل على **macOS** و**Windows**.

![Claude Code Web Screenshot](docs/screenshot.png)

> **Session sidebar** (left) · **Diff view for edits** (center) · **S/W/M usage gauges** (top right)

---

## لماذا هذا المشروع؟

Claude Code CLI أداة قوية لكنها تتطلب terminal. يُغلّف هذا المشروع الـ CLI بواجهة متصفح نظيفة حتى يتمكن أي عضو في الفريق من استخدامه بسهولة.

---

## المميزات

### واجهة الدردشة
- ردود streaming مع عرض Markdown (كتل الكود، الجداول، القوائم)
- دعم IME للغات الآسيوية
- سطر جديد بـ Shift+Enter

### عرض الأدوات
- **Edit** — عرض diff (الحذف بالأحمر، الإضافة بالأخضر)
- **Bash** — نمط terminal (موجه `$` + المخرجات)
- **Read** — مسار الملف + المحتوى
- ملخص قابل للطي عند استخدام 4+ أدوات

### إدارة الجلسات
- **تخزين دائم** — محفوظ في SQLite، يبقى بعد إعادة التشغيل
- **استعادة الجلسة** — استئناف جلسة Claude CLI عبر `--resume` (بدون رموز إضافية)
- **تفريع (Branch)** — نسخ المحادثة لاستكشاف اتجاهات مختلفة؛ شجرة قابلة للطي في الشريط الجانبي
- **عرض مقسّم (Split View)** — عرض جلستين جنباً إلى جنب، أفقياً أو عمودياً (الفاصل قابل للسحب)
- **تثبيت (Pin)** — تثبيت الجلسات المهمة في أعلى الشريط الجانبي (⭐)
- **عنوان تلقائي** — من الرسالة الأولى
- **إعادة تسمية / حذف** مباشرة في القائمة
- **إيقاف (Stop)** — مقاطعة رد Claude بنقرة واحدة
- **تنظيف التخزين** — حذف ملفات جلسات Claude CLI غير المستخدمة بنقرة واحدة (🗑)

### مقاييس الاستخدام (S / W / M)

| المقياس | المعنى |
|---------|--------|
| **S** | نسبة استخدام جلسة 5 ساعات % + الوقت حتى الإعادة |
| **W** | نسبة الاستخدام الأسبوعي لجميع النماذج % + يوم/وقت الإعادة |
| **M** | نسبة الاستخدام الأسبوعي لـ Sonnet فقط % |

### تبديل النموذج

| النموذج | تكلفة الإدخال | تكلفة الإخراج | مُوصى به لـ |
|---------|-------------|-------------|-----------|
| **sonnet** (افتراضي) | $3/M | $15/M | التطوير العام |
| **opus** | $15/M | $75/M | التحليل المعقد |
| **haiku** | $0.8/M | $4/M | التعديلات السريعة |

### أوضاع الأذونات
| الوضع | السلوك |
|-------|-------|
| `acceptEdits` (افتراضي) | جميع الأدوات + تعديل الملفات |
| `auto` | الموافقة التلقائية على جميع الأدوات |
| `plan` | للقراءة فقط |

### أوامر Slash
اكتب `/` لفتح الإكمال التلقائي:
- `/clear` — إعادة تعيين الدردشة + جلسة جديدة
- `/branch` — تفريع المحادثة
- `/help` — قائمة الأوامر

### مرفقات الملفات
- زر المشبك، السحب والإفلات، أو اللصق بـ Ctrl/Cmd+V
- معاينة: مصغرات الصور + أيقونات الملفات

---

## المتطلبات

- **Node.js** 18 أو أحدث
- **Claude Code CLI** مثبت ومُصادق عليه

</div>

```bash
npm install -g @anthropic-ai/claude-code
claude
```

<div dir="rtl">

---

## التثبيت

</div>

```bash
git clone https://github.com/sonwonkyu/ClaudeCliWindowsMac.git
cd ClaudeCliWindowsMac
npm install
```

<div dir="rtl">

---

## تفعيل مقاييس الاستخدام (اختياري)

**macOS / Linux** (يتطلب `jq` — `brew install jq`)

</div>

```bash
bash scripts/setup-statusline.sh
```

<div dir="rtl">

**Windows (PowerShell)**

</div>

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-statusline.ps1
```

<div dir="rtl">

---

## التشغيل

</div>

```bash
npm start
```

<div dir="rtl">

افتح `http://localhost:3333` في متصفحك.

**منفذ مخصص:**

</div>

```bash
PORT=8080 npm start
```

<div dir="rtl">

---

## تطبيق سطح المكتب (Electron)

يحتوي مجلد `desktop/` على غلاف Electron مع system tray، وبدء تلقائي للخادم، ونافذة تسجيل الدخول.

**macOS:**

</div>

```bash
cd desktop && npm install && bash build-app.sh
```

<div dir="rtl">

**Windows:**

</div>

```bash
cd desktop && npm install && npm run build:win
```

<div dir="rtl">

---

## ملاحظات

- يُنشأ `data.db` تلقائياً عند أول تشغيل
- النموذج الافتراضي: **sonnet**
- **لا تكشف هذا الخادم على الإنترنت** — لا يوجد نظام مصادقة. للاستخدام المحلي فقط.

---

## اللغات

- [English](README.md)
- [한국어 (Korean)](README.ko.md)
- [日本語 (Japanese)](README.ja.md)
- [中文 (Chinese)](README.zh.md)
- [Español (Spanish)](README.es.md)
- [Français (French)](README.fr.md)
- [Deutsch (German)](README.de.md)
- [Русский (Russian)](README.ru.md)
- [ภาษาไทย (Thai)](README.th.md)
- [Tiếng Việt (Vietnamese)](README.vi.md)
- [العربية (Arabic)](#claude-code-web) — هذا المستند

---

## الرخصة

MIT

</div>
