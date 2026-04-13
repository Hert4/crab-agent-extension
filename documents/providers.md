# LLM Providers

Crab supports multiple AI providers. Choose based on your needs — performance, cost, or privacy.

---

## Provider Comparison

| Provider | API Key Required | Best Models | Strengths |
|----------|:---:|---|---|
| **Anthropic** | Yes | `claude-sonnet-4-6`, `claude-opus-4-6` | Best tool-use accuracy, fewest errors |
| **OpenAI** | Yes | `gpt-4o`, `o3` | Strong general performance |
| **Google Gemini** | Yes | `gemini-2.5-pro`, `gemini-2.0-flash` | Good balance of speed and quality |
| **OpenRouter** | Yes | Any model via gateway | Access many models with one key |
| **Ollama** | No | `llama3.1`, `qwen2.5`, `mistral` | Free, runs locally, full privacy |
| **OpenAI-Compatible** | Varies | Any compatible endpoint | Flexible, works with any API |
| **ChatGPT (Sign in)** | No | Uses your ChatGPT subscription | No API key needed |

---

## Setup Instructions

### Anthropic

1. Go to [console.anthropic.com](https://console.anthropic.com) → API Keys
2. Create a new key (starts with `sk-ant-...`)
3. In Crab Settings: Provider → **Anthropic**, paste your key
4. Model: type `claude-sonnet-4-6` (recommended)
5. Click **Test Connection** → **Save**

### OpenAI

1. Go to [platform.openai.com](https://platform.openai.com) → API Keys
2. Create a new key (starts with `sk-...`)
3. In Crab Settings: Provider → **OpenAI**, paste your key
4. Model: type `gpt-4o` or `o3`
5. Click **Test Connection** → **Save**

### Google Gemini

1. Go to [aistudio.google.com](https://aistudio.google.com) → Get API Key
2. Create a key (starts with `AIza...`)
3. In Crab Settings: Provider → **Google Gemini**, paste your key
4. Model: type `gemini-2.5-pro`
5. Click **Test Connection** → **Save**

### OpenRouter

1. Go to [openrouter.ai](https://openrouter.ai) → Keys
2. Create a new key (starts with `sk-or-...`)
3. In Crab Settings: Provider → **OpenRouter**, paste your key
4. Model: type any model path, e.g., `anthropic/claude-sonnet-4-6`
5. Click **Test Connection** → **Save**

> OpenRouter is a gateway — you can access Claude, GPT, Gemini, Llama, and many more models through a single API key. Check [openrouter.ai/models](https://openrouter.ai/models) for the full list.

### Ollama (Local)

1. Install [Ollama](https://ollama.ai) on your computer
2. Pull a model: `ollama pull llama3.1`
3. Start the server: `ollama serve`
4. In Crab Settings: Provider → **Ollama (Local)**
5. Base URL: `http://localhost:11434` (default)
6. Model: type the model name, e.g., `llama3.1`
7. Click **Save** (no API key needed)

> Ollama runs entirely on your machine — your data never leaves your computer.

### OpenAI-Compatible

For any API that follows the OpenAI chat completions format:

1. In Crab Settings: Provider → **OpenAI-Compatible**
2. Enter the **Base URL** (e.g., `https://your-api.com/v1`)
3. Enter your **API Key** (if required)
4. Model: type the model ID
5. Click **Test Connection** → **Save**

This works with many providers: Together AI, Groq, Mistral, Azure OpenAI, and more.

### ChatGPT (Sign in) — No API Key

1. In Crab Settings: Provider → **ChatGPT (Sign in)**
2. Click **Sign in with ChatGPT**
3. Log in with your OpenAI account in the popup
4. You're done — Crab uses your ChatGPT subscription

**Usage limits depend on your plan:**

| Plan | ~Messages per 5 hours | Weekly Limit |
|------|:---:|:---:|
| Free | ~15 | Yes |
| Plus | ~80 | Yes |
| Pro | ~500 | Yes |

> Each browser action counts as 1 message. For heavy use, an API key provider is recommended.

---

## Model Recommendations

### Best Overall

**Claude Sonnet 4.6** (`claude-sonnet-4-6`) via Anthropic — best balance of accuracy, speed, and cost for browser automation.

### Best Quality (No Budget Limit)

**Claude Opus 4.6** (`claude-opus-4-6`) via Anthropic — most capable model, handles complex multi-step tasks with fewer errors.

### Best Free Option

**Ollama** with `llama3.1` or `qwen2.5` — runs locally, completely free, no rate limits. Quality is lower than cloud models but works for simple tasks.

### Best Budget Option

**ChatGPT (Sign in)** — uses your existing ChatGPT subscription. No extra cost if you already pay for Plus or Pro.

---

## Quick Mode

When using Anthropic as the provider, you can enable **Quick Mode** for faster responses on simple tasks.

How it works:
- Crab skips sending the full tool schemas to the LLM
- Uses stop sequences instead of structured tool calls
- Adds an `effort: low` header to reduce processing time

Best for: simple clicks, navigation, quick lookups. Not recommended for complex multi-step tasks.

---

## Tips

- **Start with Anthropic Claude** if you're unsure — it has the best tool-use support
- **Test your connection** before starting tasks — the Test Connection button catches most issues
- **Check your API credits** — running out mid-task will cause errors
- **Use OpenRouter** if you want to experiment with different models without managing multiple API keys
- The **Model** field accepts any model ID — you're not limited to the suggestions shown below the input
