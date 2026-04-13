# Getting Started

## Install the Extension

1. Download or clone the [crab-agent-extension](https://github.com/Hert4/crab-agent-extension) repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the downloaded folder
5. You should see the Crab-Agent icon in your toolbar

## Open the Side Panel

Click the Crab-Agent icon in your Chrome toolbar. The side panel will open on the right side of your browser. This is where you chat with Crab and give it tasks.

## Set Up Your API Key

1. Click the **Settings** tab (gear icon) at the bottom of the side panel
2. Choose a **Provider** (e.g., Anthropic, OpenAI, Google Gemini)
3. Type your model ID in the **Model** field (e.g., `claude-sonnet-4-6`)
4. Paste your **API Key**
5. Click **Test Connection** to verify it works
6. Click **Save Settings**

> No API key? Choose **ChatGPT (Sign in)** as the provider — it uses your ChatGPT account directly. No key needed.

## Your First Task

Go to any website, then type a command in the chat box. Try something simple:

```
Go to google.com and search for "best hiking trails"
```

## What Happens Behind the Scenes

When you send a task, Crab follows a loop:

1. **Screenshot** — Takes a picture of the current page
2. **Observe** — Reads the page elements (buttons, links, inputs)
3. **Think** — Sends everything to the AI to decide the next action
4. **Act** — Clicks, types, scrolls, or navigates
5. **Repeat** — Until the task is complete

You can watch the progress in real-time in the side panel. Each action appears as a live activity update.

## Follow-Up Messages

After a task finishes, you can send follow-up messages in the same conversation. Crab remembers the context.

```
Now open the first result
```

```
Summarize what this page says
```

## Pause, Resume, and Cancel

While Crab is working:
- Click the **pause** button to pause execution
- Click **resume** to continue
- Click the **stop** button to cancel the task entirely

## Next Steps

- [Use Cases](use-cases.md) — See everything Crab can do
- [Providers](providers.md) — Choose the best AI model for your needs
- [Tips & Troubleshooting](tips-and-troubleshooting.md) — Get the most out of Crab
