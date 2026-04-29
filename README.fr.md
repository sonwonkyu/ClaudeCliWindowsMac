# Claude Code Web

**Utilisez Claude Code directement dans votre navigateur — sans terminal.**

Une interface web légère qui encapsule [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/overview) avec des sessions persistantes, des jauges d'utilisation en temps réel, le changement de modèle et les pièces jointes. Compatible **macOS** et **Windows**.

![Claude Code Web Screenshot](docs/screenshot.png)

> **Session sidebar** (left) · **Diff view for edits** (center) · **S/W/M usage gauges** (top right)

---

## Pourquoi ce projet ?

Claude Code CLI est puissant, mais nécessite un terminal. Ce projet l'enveloppe dans une interface web propre pour que n'importe quel membre de l'équipe puisse l'utiliser depuis le navigateur.

---

## Fonctionnalités

### Interface de Chat
- Réponses en streaming avec rendu Markdown (blocs de code, tableaux, listes)
- Support IME pour les langues asiatiques
- Saut de ligne avec Shift+Enter

### Affichage des Outils
- **Edit** — vue diff (suppressions en rouge, ajouts en vert)
- **Bash** — style terminal (invite `$` + sortie)
- **Read** — chemin de fichier + contenu
- Résumé rétractable pour 4+ outils : _"90 tools used (Bash ×12, Read ×65…)"_

### Gestion des Sessions
- **Persistance** — stocké dans SQLite, survit aux redémarrages
- **Restauration** — reprend la session Claude CLI avec `--resume` (sans coût de tokens supplémentaire)
- **Branch** — bifurquer la conversation ; arbre rétractable dans la barre latérale
- **Split View** — afficher deux sessions côte à côte, horizontal ou vertical (séparateur déplaçable)
- **Pin / Favori** — épingler les sessions importantes en haut de la barre latérale (⭐)
- **Titre automatique** — généré depuis le premier message
- **Renommer / supprimer** en ligne
- **Stop** — interrompre la réponse de Claude en un clic
- **Nettoyage du stockage** — supprimer les fichiers de session orphelins en un clic (🗑)

### Jauges d'Utilisation (S / W / M)

| Jauge | Signification |
|-------|---------------|
| **S** | Utilisation de session 5h % + temps avant réinitialisation |
| **W** | Utilisation hebdomadaire tous modèles % + jour/heure de réinitialisation |
| **M** | Utilisation hebdomadaire Sonnet uniquement % |

### Changement de Modèle

| Modèle | Entrée | Sortie | Recommandé pour |
|--------|--------|--------|----------------|
| **sonnet** (défaut) | $3/M | $15/M | Développement général |
| **opus** | $15/M | $75/M | Analyse complexe |
| **haiku** | $0.8/M | $4/M | Modifications rapides |

### Modes de Permission
| Mode | Comportement |
|------|-------------|
| `acceptEdits` (défaut) | Tous les outils + édition de fichiers |
| `auto` | Tous les outils approuvés automatiquement |
| `plan` | Lecture seule |

### Commandes Slash
Tapez `/` pour ouvrir l'autocomplétion :
- `/clear` — réinitialiser le chat + nouvelle session
- `/branch` — bifurquer la conversation
- `/help` — afficher la liste des commandes

### Pièces Jointes
- Bouton trombone, glisser-déposer, ou coller avec Ctrl/Cmd+V
- Aperçu avec miniatures d'images + icônes de fichiers

---

## Prérequis

- **Node.js** 18+
- **Claude Code CLI** installé et authentifié

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

## Activer les Jauges d'Utilisation (Optionnel)

**macOS / Linux** (nécessite `jq` — `brew install jq`)
```bash
bash scripts/setup-statusline.sh
```

**Windows (PowerShell)**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-statusline.ps1
```

---

## Lancer

```bash
npm start
```

Ouvrez `http://localhost:3333` dans votre navigateur.

**Port personnalisé :**
```bash
PORT=8080 npm start
```

---

## Application Bureau (Electron)

`desktop/` contient un wrapper Electron avec icône dans la barre des tâches, démarrage automatique du serveur et fenêtre de connexion pour le sondage d'utilisation.

**macOS :**
```bash
cd desktop && npm install && bash build-app.sh
```

**Windows :**
```bash
cd desktop && npm install && npm run build:win
```

---

## Notes

- `data.db` est créé automatiquement au premier lancement
- Modèle par défaut : **sonnet**
- **N'exposez pas ce serveur sur internet** — pas d'authentification. Usage local uniquement.

---

## Langues

- [English](README.md)
- [한국어 (Korean)](README.ko.md)
- [日本語 (Japanese)](README.ja.md)
- [中文 (Chinese)](README.zh.md)
- [Español (Spanish)](README.es.md)
- [Français (French)](#claude-code-web) — ce document
- [Deutsch (German)](README.de.md)
- [Русский (Russian)](README.ru.md)
- [ภาษาไทย (Thai)](README.th.md)
- [Tiếng Việt (Vietnamese)](README.vi.md)
- [العربية (Arabic)](README.ar.md)

---

## Licence

MIT
