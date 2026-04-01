# Crab-Agent

A Chrome extension that uses large language models to automate browser tasks. The agent observes the current page, plans a sequence of actions, executes them via Chrome DevTools Protocol, and repeats until the task is complete or the user intervenes.

Version: 2.3.0

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Component Map](#component-map)
- [Agent Loop](#agent-loop)
- [Message Flow](#message-flow)
- [LLM Providers](#llm-providers)
- [Tool Registry](#tool-registry)
- [Memory System](#memory-system)
- [Permission Model](#permission-model)
- [Scheduler](#scheduler)
- [Workflows](#workflows)
- [Tab Groups](#tab-groups)
- [Quick Mode](#quick-mode)
- [Configuration](#configuration)
- [Tech Stack](#tech-stack)
- [Build and Install](#build-and-install)

---

## Overview

Crab-Agent is a Chrome MV3 extension. The user opens a side panel, types a task in natural language, and the agent executes it autonomously. The agent can navigate pages, click elements, fill forms, read page content, open and close tabs, upload files, run JavaScript, generate documents, record and replay workflows, schedule future tasks, and maintain persistent memory across sessions.

The execution model is a tool-use loop: the LLM receives the current conversation (including screenshots and page context), selects a tool, the extension executes it, and the result is appended to the conversation for the next LLM call. This continues until the agent calls `done`.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Side Panel (React)                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ ChatPanel│ │Workflows │ │ Schedule │ │Settings│ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│  Zustand stores: taskStore, uiStore, settingsStore,  │
│                  workflowStore, memoryStore           │
│  useBgMessage hook — chrome.runtime.Port             │
└────────────────────┬────────────────────────────────┘
                     │  Port: 'side-panel'
                     │  postMessage / onMessage
┌────────────────────▼────────────────────────────────┐
│  Background Service Worker (src/background/index.ts) │
│  - Receives new_task / follow_up_task / cancel etc.  │
│  - Manages tab group sessions                        │
│  - Triggers memory dream cycles                      │
│  - Runs chrome.alarms for scheduled tasks            │
│  - Calls agent-loop.handleNewTask()                  │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│  Agent Loop (src/core/agent-loop.ts)                 │
│  ┌──────────────────────────────────────────────┐   │
│  │  1. Build system prompt                      │   │
│  │  2. Take initial screenshot                  │   │
│  │  3. Run read_page for element refs           │   │
│  │  4. Loop:                                    │   │
│  │     callLLM → tool_use response              │   │
│  │     executeTool(name, params)                │   │
│  │     append tool_result                       │   │
│  │     repeat until done()                      │   │
│  └──────────────────────────────────────────────┘   │
│  MessageManager — compaction, history, storage       │
└────────────────────┬────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
┌─────────▼──────┐   ┌─────────▼──────────────┐
│ LLM Client     │   │ Tool Executors          │
│ llm-client.ts  │   │ src/tools/*.ts          │
│                │   │                         │
│ Anthropic       │   │ CDP: screenshots,       │
│ OpenAI          │   │      clicks, typing     │
│ Google Gemini   │   │ Browser: tabs, nav      │
│ OpenRouter      │   │ Page: read, find, JS    │
│ Ollama          │   │ Files: upload, download │
│ OpenAI-compat   │   │ Docs, GIF, workflows    │
└────────────────┘   └─────────────────────────┘
```

---

## Component Map

### Background (`src/background/index.ts`)

Single service worker that orchestrates everything.

- Maintains a persistent port connection to the side panel.
- On `new_task`: resolves the active tab, optionally creates a tab group, triggers non-blocking memory dream if due, builds memory context, calls `handleNewTask`.
- On `follow_up_task`: if a task is running, queues the message; otherwise starts a new task with restored conversation history.
- On `cancel_task`, `pause_task`, `resume_task`: delegates to agent-loop controls.
- Intercepts `execution_event` messages from agent-loop to save memory entries on `TASK_OK` and to collapse the tab group on `ASK_USER`.
- Handles workflow recording/playback, scheduled task management, memory CRUD, and replay export.
- Keeps the service worker alive during task execution via a self-ping keep-alive loop.
- Cleans up stale tab group sessions on startup.

### Agent Loop (`src/core/agent-loop.ts`)

Core execution engine.

- `handleNewTask(task, settings, images, sendToPanel, llmHistory, preferredTabId, workflows, isFollowUp, memoryContext)` — entry point. Initializes `ExecutionContext`, builds the system prompt, optionally restores conversation history from storage.
- `runExecutor(exec)` — the main loop. Takes a screenshot, injects page context, then iterates: call LLM, parse tool use, execute tool, append result, check for `done`.
- Handles special tool results inline: `done` (end task or enter monitor mode), `ask_user` (pause for input), `suggest_rule` (forward to user), `memory` (CRUD on persistent memory), `update_plan` (plan approval flow).
- Manages stagnation detection and injects interrupt messages when the agent is looping without progress.
- Tracks active tab changes when tools open or switch tabs.
- Exports conversation to `chrome.storage.local` after each task for follow-up continuity.

### LLM Client (`src/core/llm-client.ts`)

Multi-provider LLM gateway.

- `callLLM(messages, settings, useVision, toolSchemas, extraOptions)` — single entry point for all providers.
- Translates tool schemas to provider-specific formats: Anthropic `input_schema`, OpenAI function-calling, Google `function_declarations`.
- Auto-detects Anthropic endpoint when `openai-compatible` provider URL ends in `/v1/messages`.
- Handles streaming (SSE) for OpenAI, OpenRouter, openai-compatible providers.
- On 400 response with `content.str` error (vision not supported), automatically retries without images.
- Strips images from all but the last image-bearing message to avoid proxy rejections from accumulated screenshots.
- Quick Mode: when `extraOptions.quickMode` is true, tools are disabled and the LLM returns compact text commands.

### Message Manager (`src/core/message-manager.ts`)

Conversation state manager for a single task.

- Stores messages as a list with roles (`system`, `user`, `assistant`, `tool`).
- `compactIfNeeded()` — progressive size management: strip images from old messages (soft limit 15 MB), then drop oldest non-system messages (hard limit 100 KB).
- Always preserves tool_use/tool_result pairs when compacting.
- `exportForStorage()` — strips base64 images, flattens text-only array content to strings (for strict OpenAI-compatible APIs on restore), preserves tool_use/tool_result structure.
- `importFromStorage(history, systemPrompt)` — restores history, normalizes stale array content to strings.

### Tools (`src/tools/`)

Each tool is a module with `name`, `description`, `parameters` (JSON Schema), and `execute(params, context)`. Tools return a `ToolResult` with `success`, `error`, and optional special flags (`isDone`, `isAskUser`, `isSuggestRule`, `isMemoryOp`).

The `executeTool(name, params, context)` function in `tools/index.ts` resolves internal tools first, then external tools, and runs `execute`.

### Permissions (`src/core/permission-manager.ts`)

Intercepts tool execution to enforce user-controlled safety policies. See [Permission Model](#permission-model).

### Memory Manager (`src/core/memory-manager.ts`)

Persistent cross-session storage for facts, preferences, and rules. See [Memory System](#memory-system).

### Task Scheduler (`src/core/task-scheduler.ts`)

Chrome alarms-based scheduling engine. See [Scheduler](#scheduler).

### Tab Group Manager (`src/core/tab-group-manager.ts`)

Manages Chrome Tab Groups for agent sessions. See [Tab Groups](#tab-groups).

### Quick Mode (`src/core/quick-mode.ts`)

Low-latency compact command execution path. See [Quick Mode](#quick-mode).

### Side Panel (`src/sidepanel/`)

React application running in the Chrome side panel.

- **ChatPanel** — message thread, input box, image attachment, live action indicator, suggest-rule accept/reject UI.
- **SettingsPanel** — provider, model, API key, base URL, permission mode, system prompt override, tab grouping toggle.
- **WorkflowList / WorkflowSaveModal** — manage recorded workflows.
- **ScheduledTaskList** — view and cancel scheduled tasks.
- **MemoryPanel** — view, delete, and trigger dream consolidation for memory entries.
- **Zustand stores** — `taskStore`, `uiStore`, `settingsStore`, `workflowStore`, `memoryStore`, `contextRulesStore`.
- **useBgMessage** — manages the persistent port connection, heartbeat, and dispatches all background messages to the relevant stores.

---

## Agent Loop

```
handleNewTask called
│
├── Normalize user images (ImageItem[] → data URLs)
├── Build system prompt (memory + context rules + viewport + warnings)
├── Restore conversation history from storage (follow-up) or init fresh
│
├── Take initial screenshot via CDP
├── Run read_page(interactive) — inject element refs into first message
│
└── runExecutor loop (max steps configurable)
    │
    ├── getMessages() → send to callLLM
    │
    ├── LLM returns tool_use (or text in non-native mode)
    │
    ├── Append assistant tool_use block to conversation
    │
    ├── executeTool(name, params, context)
    │   ├── Internal: done → exit loop (or enter monitor mode)
    │   ├── Internal: ask_user → pause, send ASK_USER event to panel
    │   ├── Special: suggest_rule → forward to user, await accept/skip
    │   ├── Special: memory → execute CRUD on memoryManager directly
    │   └── External: computer, navigate, find, read_page, tabs_*, etc.
    │
    ├── Append tool_result to conversation
    │
    ├── Stagnation check → inject interrupt message if agent is looping
    ├── Tab tracking → update exec.tabId if tool changed active tab
    │
    └── Repeat
```

On `done`:
- Exports conversation to storage.
- Sends `TASK_OK` event to panel with final answer.
- Background intercepts `TASK_OK` to extract and save memory entries, increment session counter.
- Tab group is ungrouped.

---

## Message Flow

```
Side Panel                          Background                    Agent Loop
────────────────────────────────────────────────────────────────────────────
sendToBackground({type:'new_task'})
─────────────────────────────────>
                                    handleNewTask()
                                    ──────────────────────────>
                                                                TASK_START
                                    <──────────────────────────
sendToPanel(TASK_START)
<─────────────────────────────────
                                                                THINKING / ACTION / STEP events
                                    <──────────────────────────
sendToPanel(execution_event)
<─────────────────────────────────
                                                [loop continues]

                                                                TASK_OK / TASK_FAIL
                                    <──────────────────────────
                                    save memory entries
                                    ungroup tabs
sendToPanel(TASK_OK)
<─────────────────────────────────
```

### `execution_event` states

| State | Meaning |
|---|---|
| TASK_START | Task execution began |
| TASK_OK | Task completed successfully |
| TASK_FAIL | Task failed after max retries |
| TASK_CANCEL | Task cancelled by user |
| TASK_PAUSE | Task paused (ask_user) |
| STEP_START | New LLM call cycle started |
| STEP_FAIL | LLM call failed (will retry) |
| ACTION | Agent is executing a tool |
| THINKING | LLM is generating |
| PLANNING | Agent is in planning phase |
| ASK_USER | Agent needs user input |
| SUGGEST_RULE | Agent suggests a context rule |
| COMPACTION | Conversation was compacted |
| MONITOR_START | Monitoring mode entered |
| MONITORING | Monitor loop tick |
| MONITOR_WAKE | Monitor condition triggered |
| MONITOR_REPORT | Monitor result sent |
| MEMORY_OP | Memory tool called (add/update/delete/list) |
| DREAM_START | Dream consolidation started |
| DREAM_DONE | Dream consolidation finished |

---

## LLM Providers

| Provider | `provider` value | Format |
|---|---|---|
| Anthropic | `anthropic` | Messages API, native `tool_use` |
| OpenAI | `openai` | Chat Completions, function calling |
| Google Gemini | `google` | Generative Language API, `function_declarations` |
| OpenRouter | `openrouter` | OpenAI-compatible gateway |
| Ollama | `ollama` | Local Ollama API |
| OpenAI-compatible | `openai-compatible` | Chat Completions; auto-detects Anthropic endpoint |

All providers go through the same `callLLM` interface. Tool schemas are translated per-provider. Vision (image) support is available for all providers and is automatically disabled per-request if the endpoint rejects image content.

---

## Tool Registry

Tools are registered in `src/tools/index.ts` and split into external tools (exposed to the LLM) and internal tools (handled directly by agent-loop).

### External Tools

| Tool | Purpose |
|---|---|
| `computer` | Mouse, keyboard, and DOM interaction via CDP. Supports click, type, scroll, drag, screenshot, key press, hover. Ref-based targeting resolves live DOM coordinates. |
| `navigate` | Navigate the active tab to a URL, or go back/forward. |
| `read_page` | Read the page DOM and return interactive elements with ref IDs and coordinates. Supports iframe traversal. |
| `find` | Find an element by natural language description. Searches the accessibility tree. |
| `form_input` | Fill form fields, select options, toggle checkboxes. |
| `get_page_text` | Extract readable text content from the page. |
| `tabs_context` | List all open tabs with URLs and titles. |
| `tabs_create` | Open a new tab, optionally at a URL. |
| `switch_tab` | Switch the active tab. |
| `close_tab` | Close a tab. |
| `read_console_messages` | Read browser console output. |
| `read_network_requests` | Read recent network requests and responses. |
| `resize_window` | Change the browser viewport dimensions. |
| `update_plan` | Present a multi-step plan to the user for approval before proceeding. |
| `file_upload` | Upload a file via a file input element. |
| `upload_image` | Upload an image file specifically. |
| `gif_creator` | Record and export a GIF or replay of the task. |
| `suggest_rule` | Propose saving a site-specific interaction rule for future sessions. |
| `memory` | Manage persistent memory: `list`, `add`, `update`, `delete`. |
| `shortcuts_list` | List available keyboard shortcuts on the current page. |
| `shortcuts_execute` | Execute a keyboard shortcut by name. |
| `javascript_tool` | Execute arbitrary JavaScript in the page context. |
| `canvas_toolkit` | Canvas and image manipulation helpers. |
| `code_editor` | Open an in-panel code editor. |
| `document_generator` | Generate DOCX or HTML documents from task output. |
| `set_of_mark` | Visual overlay for element labeling. |
| `visualize` | Render SVG diagrams or HTML charts inline in the chat. |
| `schedule_task` | Schedule a task for future execution via chrome.alarms. |
| `download_file` | Trigger a file download. |
| `run_workflow` | Execute a saved recorded workflow. |

### Internal Tools

| Tool | Purpose |
|---|---|
| `done` | Signal task completion. Accepts `finalAnswer` (text), `monitor` (boolean for watch mode), and monitoring parameters. |
| `ask_user` | Pause execution and prompt the user for input. The agent resumes when the user replies. |

---

## Memory System

Persistent memory allows the agent to remember user preferences, personal information, and project conventions across sessions.

### Storage

- Key: `crab_memory` in `chrome.storage.local`.
- Max entries: 60 (pruned by least recently used).

### Entry Structure

```typescript
interface MemoryEntry {
  id: string
  content: string
  type: 'rule' | 'fact' | 'summary'
  domain?: string        // per-domain entry if set, cross-domain if undefined
  createdAt: number
  lastUsed: number
  useCount: number
  source: 'suggest_rule' | 'dream' | 'manual' | 'auto'
}
```

### memory Tool

The agent uses the `memory` tool to manage its own memory during a task:

- `memory(command="list")` — returns all entries with IDs.
- `memory(command="add", content="...", type="fact|preference|rule")` — saves new information (deduplication by content similarity).
- `memory(command="update", id="...", content="...")` — corrects an existing entry.
- `memory(command="delete", id="...")` — removes an entry.

The agent is instructed to use this selectively — only for information the user explicitly shares and that is genuinely useful in future sessions.

### System Prompt Injection

Before each task, `memoryManager.formatForPrompt(currentDomain)` produces a `## Memory` section injected into the system prompt. Domain-specific entries appear first, followed by general entries, capped at approximately 1200 characters.

### Dream Consolidation

After a threshold of sessions (default: 5) and elapsed time (default: 24 hours), the background triggers a non-blocking dream cycle:

1. All memory entries are sent to the LLM with instructions to deduplicate, merge near-identical entries, remove overly generic entries, and return a cleaned JSON array (max 50 entries).
2. On success, `memoryManager.replaceEntries(cleaned)` replaces the current entries.
3. The cycle is fire-and-forget — if the LLM call fails or times out (45s), the original entries are kept unchanged.

---

## Permission Model

The permission manager (`src/core/permission-manager.ts`) controls what actions the agent can perform on which domains, preventing unintended modifications to sensitive pages.

### Modes

Set via `AgentSettings.permissionMode`:

- `ask` (default) — request user approval before performing actions on new domains or sensitive pages. Read-only actions (read_page, screenshots) are allowed without prompting.
- `auto` — approve all actions automatically.
- `strict` — require explicit approval for every action.

### Permission Types

- `NAVIGATE` — navigating to a new URL.
- `READ_PAGE_CONTENT` — reading page text or element tree.
- `CLICK` — clicking elements.
- `TYPE` — typing text.
- `UPLOAD_IMAGE` — uploading images.
- `PLAN_APPROVAL` — approving a multi-step plan via `update_plan`.
- `DOMAIN_TRANSITION` — moving from one domain to another.

### Grant Durations

- `once` — permission is granted for a single tool use (expires immediately after use).
- `always` — permission is granted for the domain until the session ends or the user revokes it.

### Domain Safety

- Certain domains (login pages, financial services, government sites) always require explicit user approval and cannot be granted `always` permission.
- A blocklist of patterns prevents the agent from accessing known malicious domains.
- `verifyUrlDomain(tabId, expectedDomain)` is called before executing actions to detect unexpected navigation mid-step.

### Plan Approval

When the agent calls `update_plan`, it presents a list of planned domains and actions to the user. If approved, all listed domains receive pre-authorization for the duration of the plan.

---

## Scheduler

The task scheduler (`src/core/task-scheduler.ts`) uses Chrome's `chrome.alarms` API to execute tasks at a future time or on a recurring schedule.

- Tasks are stored in `chrome.storage.local` and alarms are re-registered on service worker startup.
- Supports one-time tasks (absolute timestamp or relative delay in seconds) and recurring tasks (5-field cron).
- When an alarm fires, the scheduler calls `handleNewTask` directly (headless if the side panel is not open).
- The `schedule_task` tool allows the agent to schedule follow-up tasks from within a task execution.
- The side panel shows a `ScheduledTaskList` with options to cancel pending tasks.

---

## Workflows

Workflows are recorded sequences of browser interactions that can be replayed on demand.

### Recording

- The user triggers recording from the side panel.
- `lib/workflowRecorder.js` is injected into the active tab and captures DOM events (clicks, inputs, navigation) as structured steps.
- When recording stops, the background receives the action list and the side panel shows a save modal.

### Saving

- Workflows are saved to `chrome.storage.local` under `crab_workflows`.
- Each workflow has a name, description, and optionally a set of parameterized inputs (e.g., email address, search query).

### Playback

- `lib/workflowPlayer.js` replays steps on the page.
- The `run_workflow` tool lets the agent invoke a saved workflow as part of a larger task.
- If the task matches a saved workflow, the agent is instructed to call `run_workflow` immediately.

### Analysis

- The background can send a workflow to the LLM for semantic description extraction, which enriches the saved workflow with human-readable step summaries.

---

## Tab Groups

The tab group manager (`src/core/tab-group-manager.ts`) uses the Chrome Tab Groups API to visually group tabs that belong to an agent session.

- When a task starts, the current tab is registered as the session's main tab (not grouped yet).
- When the agent opens the first new tab via `tabs_create`, a Chrome Tab Group is created with the session name derived from the first four words of the task.
- Subsequent agent-created tabs are added to the same group.
- When the task completes, tabs are ungrouped.
- The group title reflects the task state: task hint while running, check mark on completion, X on failure.
- The group collapses when the agent calls `ask_user` (waiting for input) and expands when the user replies.
- Tab grouping can be disabled via `Settings > Group tabs during tasks`.
- The `chrome.tabs.onUpdated` listener marks tab context dirty when a session tab navigates, ensuring the agent receives updated page context.

---

## Quick Mode

Quick Mode is an alternative execution path for lower-latency control.

- Enabled when `settings.quickMode` is `true`.
- The LLM receives a compact system prompt and returns single-line commands instead of structured tool calls.

### Commands

| Command | Action |
|---|---|
| `C x y` | Click at coordinates (x, y) |
| `T text` | Type text |
| `K key` | Press keyboard key |
| `N url` | Navigate to URL |
| `J code` | Execute JavaScript |
| `DONE text` | Complete task |
| `ASK question` | Ask user |

- Commands are parsed by `parseQuickModeResponse` and executed in sequence by `executeQuickModeCommands`.
- Tool schemas are not sent to the LLM in Quick Mode.

---

## Configuration

All settings are stored in `chrome.storage.local` via the `settingsStore` Zustand store.

| Setting | Type | Default | Description |
|---|---|---|---|
| `provider` | string | `anthropic` | LLM provider |
| `model` | string | `claude-opus-4-5` | Model identifier |
| `apiKey` | string | `""` | API key for the provider |
| `baseUrl` | string | — | Custom endpoint (Ollama, OpenAI-compatible) |
| `customModel` | string | — | Model name when provider is `openai-compatible` or `ollama` |
| `maxTokens` | number | — | Override max tokens per LLM call |
| `temperature` | number | — | Override temperature |
| `systemPrompt` | string | — | Replace the default system prompt |
| `permissionMode` | `ask` / `auto` / `strict` | `ask` | Action approval policy |
| `enableWorkflowRecording` | boolean | — | Show workflow recording controls |
| `enableScheduledTasks` | boolean | — | Show scheduled task controls |
| `theme` | `dark` / `light` | — | UI theme |
| `enableMemory` | boolean | `true` | Enable persistent memory and dream cycles |
| `enableTabGrouping` | boolean | `true` | Group agent tabs into a Chrome Tab Group |

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI framework | React 18 |
| Language | TypeScript 5.7 |
| Build | Vite 6 + @crxjs/vite-plugin |
| Styling | Tailwind CSS + CSS variables |
| State management | Zustand 5 |
| Markdown rendering | react-markdown + remark-gfm + rehype-highlight |
| Extension platform | Chrome MV3 |
| Chrome APIs used | tabs, tabGroups, storage, debugger, scripting, sidePanel, alarms, webNavigation, downloads, notifications, contextMenus, offscreen, system.display |
| LLM communication | Fetch (REST) with SSE streaming support |

---

## Build and Install

### Prerequisites

- Node.js 18 or later
- Google Chrome 114 or later

### Commands

```bash
# Install dependencies
npm install

# Development (Vite dev server for UI iteration)
npm run dev

# Production build
npm run build
```

The production build outputs to `dist/`.

### Loading into Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `dist/` directory.
5. Open any webpage, then click the extension icon to open the side panel.
6. Enter your API key in Settings.

### Permissions

The extension requests the following Chrome permissions at install time:

```
tabs, tabGroups, activeTab, scripting, storage, debugger,
webNavigation, sidePanel, clipboardWrite, clipboardRead,
offscreen, downloads, notifications, system.display,
alarms, contextMenus
```

Host permissions: `<all_urls>` (required for CDP-based page interaction and content script injection on any site).
