# LLM Providers

![Guide](https://img.shields.io/badge/guide-providers-7c3aed?style=flat-square)
![Providers](https://img.shields.io/badge/providers-7-blue?style=flat-square)

Crab supports multiple AI providers. Pick one based on your needs: performance, cost, or privacy.

## Provider Comparison

| Provider | API Key | Best Models | Strengths |
|---|:---:|---|---|
| **Anthropic** | Yes | `claude-sonnet-4-6`, `claude-opus-4-6` | Best tool-use accuracy, fewest errors |
| **OpenAI** | Yes | `gpt-4o`, `o3` | Strong general performance |
| **Google Gemini** | Yes | `gemini-2.5-pro`, `gemini-2.0-flash` | Good balance of speed and quality |
| **OpenRouter** | Yes | Any model via the gateway | Access many models with one key |
| **Ollama** | No | `llama3.1`, `qwen2.5`, `mistral` | Free, local, full privacy |
| **OpenAI-Compatible** | Varies | Any compatible endpoint | Flexible, works with most providers |
| **ChatGPT (Sign in)** | No | Uses your ChatGPT subscription | OAuth, no key needed |

## Setup Instructions

### Anthropic

1. Go to [console.anthropic.com](https://console.anthropic.com) and open **API Keys**.
2. Create a new key (starts with `sk-ant-...`).
3. In Crab Settings: Provider is **Anthropic**, paste your key.
4. Model: type `claude-sonnet-4-6` (recommended).
5. Click **Test Connection**, then **Save**.

### OpenAI

1. Go to [platform.openai.com](https://platform.openai.com) and open **API Keys**.
2. Create a new key (starts with `sk-...`).
3. In Crab Settings: Provider is **OpenAI**, paste your key.
4. Model: type `gpt-4o` or `o3`.
5. Click **Test Connection**, then **Save**.

### Google Gemini

1. Go to [aistudio.google.com](https://aistudio.google.com) and click **Get API Key**.
2. Create a key (starts with `AIza...`).
3. In Crab Settings: Provider is **Google Gemini**, paste your key.
4. Model: type `gemini-2.5-pro`.
5. Click **Test Connection**, then **Save**.

### OpenRouter

1. Go to [openrouter.ai](https://openrouter.ai) and open **Keys**.
2. Create a new key (starts with `sk-or-...`).
3. In Crab Settings: Provider is **OpenRouter**, paste your key.
4. Model: type any model path, for example `anthropic/claude-sonnet-4-6`.
5. Click **Test Connection**, then **Save**.

> OpenRouter is a gateway. One API key gives you access to Claude, GPT, Gemini, Llama, and many more models. See [openrouter.ai/models](https://openrouter.ai/models) for the full list.

### Ollama (Local)

1. Install [Ollama](https://ollama.ai) on your computer.
2. Pull a model: `ollama pull llama3.1`.
3. Start the server: `ollama serve`.
4. In Crab Settings: Provider is **Ollama (Local)**.
5. Base URL: `http://localhost:11434` (default).
6. Model: type the model name, for example `llama3.1`.
7. Click **Save**. No API key needed.

> Ollama runs entirely on your machine. Data never leaves your computer.

### OpenAI-Compatible

For any API that follows the OpenAI chat completions format.

1. In Crab Settings: Provider is **OpenAI-Compatible**.
2. Enter the **Base URL** (for example `https://your-api.com/v1`).
3. Enter your **API Key** (if required).
4. Model: type the model ID.
5. Click **Test Connection**, then **Save**.

Works with Together AI, Groq, Mistral, Azure OpenAI, and others.

### ChatGPT (Sign in), No API Key

1. In Crab Settings: Provider is **ChatGPT (Sign in)**.
2. Click **Sign in with ChatGPT**.
3. Log in with your OpenAI account in the popup.
4. Done. Crab now uses your ChatGPT subscription.

Usage limits depend on your plan:

| Plan | Messages per 5 hours | Weekly Limit |
|---|:---:|:---:|
| Free | ~15 | Yes |
| Plus | ~80 | Yes |
| Pro | ~500 | Yes |

> Each browser action counts as one message. For heavy use, an API-key provider is more economical.

## Model Recommendations

### Best Overall

**Claude Sonnet 4.6** (`claude-sonnet-4-6`) via Anthropic. Best balance of accuracy, speed, and cost for browser automation.

### Best Quality

**Claude Opus 4.6** (`claude-opus-4-6`) via Anthropic. Most capable model. Handles complex multi-step tasks with the fewest errors.

### Best Free Option

**Ollama** with `llama3.1` or `qwen2.5`. Runs locally, completely free, no rate limits. Quality is lower than cloud models but works well for simple tasks.

### Best Budget Option

**ChatGPT (Sign in)**. Uses your existing ChatGPT subscription. No extra cost if you already pay for Plus or Pro.

## Quick Mode

When using Anthropic, you can enable **Quick Mode** for faster responses on simple tasks.

| Setting | Effect |
|---|---|
| Tool schemas | Not sent to the LLM |
| Stop sequences | Used in place of structured tool calls |
| Extra header | `effort: low` for faster inference |

Best for simple clicks, navigation, and quick lookups. Not recommended for complex multi-step tasks.

## Tips

| Tip | Why |
|---|---|
| Start with Anthropic Claude | Best tool-use support if you are unsure |
| Run **Test Connection** | Catches most setup errors before the first task |
| Watch your API credits | Tasks that run out mid-flight produce errors |
| Try OpenRouter | Quickly experiment with different models on one key |
| The Model field accepts any ID | You are not limited to the listed suggestions |
