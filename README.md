# Crab-Agent

![Version](https://img.shields.io/badge/version-2.3.0-7c3aed?style=flat-square)
![Chrome](https://img.shields.io/badge/Chrome-MV3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Status](https://img.shields.io/badge/status-stable-success?style=flat-square)

A Chrome extension that turns your browser into an AI agent. Type a command in plain language and the agent clicks, types, navigates, reads pages, and finishes the task for you.

## Documentation

New to Crab-Agent? Start with the guides below.

| Guide | Description |
|---|---|
| [Getting Started](documents/getting-started.md) | Installation, setup, and your first task |
| [Use Cases](documents/use-cases.md) | Copy-paste examples for search, email, forms, scraping, and more |
| [Workflows](documents/workflows.md) | Record and replay browser actions like macros |
| [Memory and Rules](documents/memory-and-rules.md) | How Crab learns and remembers across sessions |
| [Scheduling](documents/scheduling.md) | Timers, reminders, and recurring tasks |
| [Canvas and Design](documents/canvas-and-design.md) | Posters, generative art, and Figma or Miro workflows |
| [Providers](documents/providers.md) | Choose and set up your AI provider |
| [Tips and Troubleshooting](documents/tips-and-troubleshooting.md) | Best practices, common errors, and fixes |

## Installation

1. Download or clone this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the repository folder.
4. Open any website, then click the Crab-Agent icon to open the side panel.
5. Go to **Settings** and enter your chosen provider's API key, or pick **ChatGPT (Sign in)** to authenticate with OAuth.

## Usage

Open the side panel on any page, type what you want done, and send. The agent will:

1. Take a screenshot of the active tab.
2. Read the page DOM and accessibility tree.
3. Call the LLM with the screenshot and page context.
4. Execute the chosen action (click, type, scroll, navigate).
5. Repeat until the task is complete.

## Permission Modes

| Mode | Description |
|---|---|
| **Ask** (default) | Prompts before acting on a new domain |
| **Auto** | Runs automatically without prompting |
| **Strict** | Asks before every action |

## Workflows

Record a sequence of browser actions, then replay it with different parameters.

1. Click record, perform the actions, click stop, save the workflow.
2. When you enter a related command later, the agent matches and runs the saved workflow.
3. The AI auto-detects which values should be parameters (names, emails, URLs) so the same recording works with different inputs.

See [Workflows](documents/workflows.md) for the full guide.

## Memory

The agent remembers information you share across sessions (name, preferences, site-specific rules). After several sessions it cleans up duplicates automatically through a process called **Dream Consolidation**.

See [Memory and Rules](documents/memory-and-rules.md) for the full guide.

## Scheduler

Schedule tasks to run once at a future time, or on a recurring cron schedule. Tasks run headlessly through Chrome alarms and survive browser restarts.

See [Scheduling](documents/scheduling.md) for the full guide.

## Quick Mode

Enable Quick Mode in Settings for lower-latency execution on simple tasks. The agent uses compact text commands instead of structured tool calls. Best for quick navigation, clicks, and short lookups.

## LLM Providers

| Provider | Notes |
|---|---|
| **Anthropic** | Best tool-use accuracy. Recommend Claude Sonnet 4.6 or higher |
| **OpenAI** | Strong general performance with GPT-4o or o3 |
| **Google Gemini** | Good balance of speed and quality |
| **OpenRouter** | One key, many models (Claude, GPT, Gemini, Llama, and more) |
| **Ollama** | Local and free; full privacy |
| **OpenAI-compatible** | Any endpoint that follows the OpenAI chat completions format |
| **ChatGPT (Sign in)** | OAuth to your ChatGPT account; no API key needed |

See [Providers](documents/providers.md) for setup instructions and model recommendations.

## Recommended Models

Crab-Agent is extensively tested with **Claude Sonnet 4.6**, **Claude Opus 4.x** and **Gemini-3.5-Flash**,. Top-tier models give the fewest hallucinated tool calls, the strongest multi-step planning, and the best handling of edge cases.

Smaller or older models can still work for simple tasks but tend to make more mistakes on long sequences.

## Tools

The agent picks the right tool at each step. Categories below.

| Category | Tools |
|---|---|
| Browser | click, type, scroll, drag, navigate, back, forward, create or switch or close tab |
| Page | read DOM, find element, extract text, read console, inspect network, fill form |
| File | upload, download, image upload |
| Advanced | JavaScript execution, canvas toolkit, code editor, document generator (DOCX, HTML), GIF recorder, SVG visualizer |
| Agent | memory CRUD, rule suggestion, plan updates, task scheduling, workflow execution |

There are 30+ tools in total. See the developer docs in the source repository for the full list.

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18 |
| Language | TypeScript |
| Build | Vite with @crxjs/vite-plugin |
| Styling | Tailwind CSS |
| State | Zustand |
| Platform | Chrome MV3 |

## Credits

- Clawd Tank by Marcio Granzotto for the crab mascot pixel art and SVG animations.
- Claude Computer Use by Anthropic for the agent loop concept (screenshot, observe, decide, act).

## License

MIT. Built by [Hert4](https://github.com/Hert4).
