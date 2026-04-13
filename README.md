# Crab-Agent

A Chrome extension that turns your browser into an AI agent. Type commands in Vietnamese or English — it automatically clicks, types, navigates, reads pages, and gets things done.

**Version:** 2.3.0 | **License:** MIT

---

## Installation

1. Download or clone this repository
2. Open `chrome://extensions` → enable **Developer mode**
3. Click **Load unpacked** → select the repository folder
4. Open any website → click the Crab-Agent icon to open the side panel
5. Go to **Settings** → enter your chosen provider’s API key

---

## Usage

Do anything you want in browser

The agent will:
take screenshots → read the DOM → call the LLM → perform actions → repeat until completion.

---

## Permission Modes

| Mode              | Description                           |
| ----------------- | ------------------------------------- |
| **Ask** (default) | Prompts before acting on a new domain |
| **Auto**          | Runs automatically without asking     |
| **Strict**        | Asks before every action              |

---

## Workflows

* Click record → perform actions in the browser → stop → save workflow
* Later, when you enter a related command, the agent automatically reuses the saved workflow
* Supports parameterization (passing variables into workflows)

---

## Memory

The agent remembers information you share across sessions (name, preferences, rules).
After several sessions, it automatically cleans up memory (“dream consolidation”) to stay efficient.

---

## Scheduler

Schedule tasks to run automatically — once or on a recurring cron basis.
Runs headlessly using Chrome alarms.

---

## Quick Mode

Enable in Settings.
The agent returns compact commands instead of full tool calls — faster for simple tasks.

---

## LLM Providers

| Provider              | Notes                                                   |
| --------------------- | ------------------------------------------------------- |
| **Anthropic**         | Best performance. Recommend `claude-opus-4-5` or higher |
| **OpenAI**            | gpt-5.4, gpt-5.4-pro                                    |
| **Google Gemini**     | Gemini 3.1 Pro                                          |
| **OpenRouter**        | Gateway supporting multiple models                      |
| **Ollama**            | Local, free                                             |
| **OpenAI-compatible** | Any API compatible with OpenAI format                   |

---

## Recommended Models

Extensively tested and optimized for **Claude Opus 4.5** (`claude-opus-4-5`).
Models at this tier or higher perform best — fewer hallucinated tool calls, better multi-step planning, and stronger handling of edge cases.

Smaller models (Haiku, GPT-4o-mini, Gemini Flash) still work, but may require more steps or struggle with complex tasks.

---

## Tools (30+)

The agent automatically selects the right tool at each step:

**Browser:** click, type, scroll, drag, navigate, back/forward, create/switch/close tabs
**Page:** read DOM, find elements, extract text, read console, inspect network, fill forms
**File:** upload, download, image upload
**Advanced:** JavaScript execution, canvas toolkit, code editor, document generator (DOCX/HTML), GIF recorder, SVG visualizer
**Agent:** memory CRUD, rule suggestion, plan updates, task scheduling, workflow execution

---

## Tech Stack

React 18 · TypeScript · Vite · Tailwind CSS · Zustand · Chrome MV3

---

## Credits

This project is inspired by and references:

* Clawd Tank by Marcio Granzotto — crab mascot pixel art and SVG animations
* Claude Computer Use (Anthropic) — agent loop logic and browser automation patterns (screenshot → observe → decide → act)

---

Built by Hert4
