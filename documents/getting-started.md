# Getting Started

![Guide](https://img.shields.io/badge/guide-getting%20started-7c3aed?style=flat-square)
![Time](https://img.shields.io/badge/setup-5%20min-green?style=flat-square)

## Install the Extension

1. Download or clone the [crab-agent-extension](https://github.com/Hert4/crab-agent-extension) repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the downloaded folder.
5. The Crab-Agent icon should appear in your toolbar.

## Open the Side Panel

Click the Crab-Agent icon. The side panel opens on the right side of your browser. This is where you chat with Crab and give it tasks.

## Set Up Your API Key

1. Click the **Settings** tab (gear icon) at the bottom of the side panel.
2. Choose a **Provider** (Anthropic, OpenAI, Google Gemini, and so on).
3. Type your model ID in the **Model** field (for example `claude-sonnet-4-6`).
4. Paste your **API Key**.
5. Click **Test Connection** to verify it works.
6. Click **Save Settings**.

> No API key on hand? Pick **ChatGPT (Sign in)** as the provider. It authenticates against your ChatGPT account through OAuth, no key required.

## Your First Task

Open any website, then type a simple command in the chat box:

```
Go to google.com and search for "best hiking trails"
```

## What Happens Behind the Scenes

When you send a task, Crab runs a loop:

| Step | Action |
|---|---|
| 1 | Screenshot the current page |
| 2 | Read interactive elements (buttons, links, inputs) |
| 3 | Send everything to the AI to decide the next move |
| 4 | Click, type, scroll, or navigate |
| 5 | Repeat until the task is complete |

You can watch the progress live. Each action appears in the side panel as it happens.

## Follow-Up Messages

After a task finishes, send follow-up messages in the same thread. Crab keeps the context.

```
Now open the first result
```

```
Summarize what this page says
```

## Pause, Resume, Cancel

While Crab is working:

| Control | What it does |
|---|---|
| Pause | Stops execution at the next safe step |
| Resume | Continues from where Crab paused |
| Stop | Cancels the task entirely |

## Next Steps

| Guide | Topic |
|---|---|
| [Use Cases](use-cases.md) | What Crab can do for you |
| [Providers](providers.md) | Pick the right AI model |
| [Tips and Troubleshooting](tips-and-troubleshooting.md) | Get the most out of Crab |
