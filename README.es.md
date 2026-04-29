# Claude Code Web

**Usa Claude Code directamente en tu navegador — sin terminal.**

Una interfaz web ligera que envuelve [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/overview) con sesiones persistentes, medidores de uso en tiempo real, cambio de modelo y adjuntos de archivos. Compatible con **macOS** y **Windows**.

![Claude Code Web Screenshot](docs/screenshot.png)

> **Session sidebar** (left) · **Diff view for edits** (center) · **S/W/M usage gauges** (top right)

---

## ¿Por qué existe esto?

Claude Code CLI es poderoso, pero requiere una terminal. Este proyecto lo envuelve en una interfaz web limpia para que cualquier miembro del equipo pueda usarlo desde el navegador.

---

## Características

### Interfaz de Chat
- Respuestas en streaming con renderizado Markdown (bloques de código, tablas, listas)
- Soporte IME para idiomas asiáticos (sin envíos accidentales durante la composición)
- Salto de línea con Shift+Enter

### Visualización de Herramientas
- **Edit** — vista diff (eliminaciones en rojo, adiciones en verde)
- **Bash** — estilo terminal (prompt `$` + salida)
- **Read** — ruta de archivo + contenido
- Resumen colapsable para 4+ herramientas: _"90 tools used (Bash ×12, Read ×65…)"_

### Gestión de Sesiones
- **Persistencia** — almacenado en SQLite, sobrevive reinicios
- **Restaurar sesión** — reanuda la sesión de Claude CLI con `--resume` (sin costo extra de tokens)
- **Branch** — bifurca la conversación para explorar alternativas
- **Título automático** — generado desde el primer mensaje
- **Renombrar / eliminar** en línea

### Medidores de Uso (S / W / M)
Uso de la API de Claude en tiempo real en el encabezado:

| Medidor | Significado |
|---------|-------------|
| **S** | Uso de sesión de 5 horas % + tiempo hasta el reinicio |
| **W** | Uso semanal de todos los modelos % + día/hora de reinicio |
| **M** | Uso semanal solo de Sonnet % + día/hora de reinicio |

### Cambio de Modelo
Haz clic en el badge del modelo en la barra de entrada:

| Modelo | Entrada | Salida | Recomendado para |
|--------|---------|--------|-----------------|
| **sonnet** (defecto) | $3/M | $15/M | Desarrollo general |
| **opus** | $15/M | $75/M | Análisis complejo |
| **haiku** | $0.8/M | $4/M | Ediciones rápidas |

### Modos de Permiso
| Modo | Comportamiento |
|------|---------------|
| `acceptEdits` (defecto) | Todas las herramientas + edición de archivos |
| `auto` | Todas las herramientas aprobadas automáticamente |
| `plan` | Solo lectura (sin cambios en archivos) |

### Comandos Slash
Escribe `/` para abrir el autocompletado:
- `/clear` — reiniciar chat + nueva sesión
- `/branch` — bifurcar conversación actual
- `/help` — mostrar lista de comandos

### Adjuntos de Archivos
- Botón de clip, arrastrar y soltar, o pegar con Ctrl/Cmd+V
- Vista previa con miniaturas de imagen + iconos de archivo
- Claude analiza los adjuntos con la herramienta `Read`

---

## Requisitos

- **Node.js** 18+
- **Claude Code CLI** instalado y autenticado

```bash
npm install -g @anthropic-ai/claude-code
claude
```

---

## Instalación

```bash
git clone https://github.com/sonwonkyu/ClaudeCliWindowsMac.git
cd ClaudeCliWindowsMac
npm install
```

---

## Activar Medidores de Uso (Opcional)

**macOS / Linux** (requiere `jq` — `brew install jq`)
```bash
bash scripts/setup-statusline.sh
```

**Windows (PowerShell)**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-statusline.ps1
```

---

## Ejecutar

```bash
npm start
```

Abre `http://localhost:3333` en tu navegador.

**Puerto personalizado:**
```bash
PORT=8080 npm start
```

---

## Aplicación de Escritorio (Electron)

`desktop/` incluye un wrapper Electron con bandeja del sistema, inicio automático del servidor y ventana de login para el sondeo de uso.

**macOS:**
```bash
cd desktop && npm install && bash build-app.sh
```

**Windows:**
```bash
cd desktop && npm install && npm run build:win
```

---

## Notas

- `data.db` se crea automáticamente en el primer uso
- Modelo por defecto: **sonnet**
- **No expongas este servidor a internet** — no tiene autenticación. Solo uso local.

---

## Idiomas

- [English](README.md)
- [한국어 (Korean)](README.ko.md)
- [日本語 (Japanese)](README.ja.md)
- [中文 (Chinese)](README.zh.md)
- [Español (Spanish)](#claude-code-web) — este documento
- [Français (French)](README.fr.md)
- [Deutsch (German)](README.de.md)
- [Русский (Russian)](README.ru.md)
- [ภาษาไทย (Thai)](README.th.md)
- [Tiếng Việt (Vietnamese)](README.vi.md)
- [العربية (Arabic)](README.ar.md)

---

## Licencia

MIT
