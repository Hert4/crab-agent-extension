# Tips and Troubleshooting

![Guide](https://img.shields.io/badge/guide-tips%20%26%20fixes-7c3aed?style=flat-square)
![Audience](https://img.shields.io/badge/audience-everyone-blue?style=flat-square)

Get the most out of Crab and fix common issues.

## Writing Better Prompts

### Be Specific

| Less effective | More effective |
|---|---|
| Check my email | Open Gmail and tell me how many unread emails I have from today |

### Break Down Complex Tasks

| Less effective | More effective |
|---|---|
| Set up my entire project on GitHub with CI/CD | Go to github.com, create a new repository called "my-app", set it public, and add a README |

### Include Context

```
Fill the registration form with:
Name: John Doe
Email: john@example.com
Password: MyPass123
Then click "Sign Up"
```

### Let Crab Figure Out the Details

You do not need to describe every click. Crab understands intent.

```
Search Google for the weather in Tokyo and tell me the temperature
```

Crab will work out: go to google.com, type the query, read the result, respond.

## Permission Modes

| Mode | When to use it |
|---|---|
| **Ask** (default) | Most users. Crab asks before acting on new domains |
| **Auto** | When you trust the task fully and want zero interruptions |
| **Strict** | When working with sensitive pages (banking, admin panels) |

Change in **Settings**, then **Permission Mode**.

## Common Errors and Fixes

### "Invalid API Key"

| Check | Action |
|---|---|
| Key in Settings | Make sure it matches what your provider issued |
| Key format | Anthropic keys start with `sk-ant-`, OpenAI with `sk-`, OpenRouter with `sk-or-` |
| Possible expiry | Regenerate the key if it might have expired |

### "Provider / Model mismatch"

Each provider has its own model IDs.

| Provider | Sample model |
|---|---|
| Anthropic | `claude-sonnet-4-6` |
| OpenAI | `gpt-4o` |
| Google | `gemini-2.5-pro` |

Check the [Providers](providers.md) guide for the correct IDs.

### "Cannot connect to API"

| Possible cause | Fix |
|---|---|
| No internet | Reconnect and retry |
| Wrong base URL | Verify under Settings, especially for Ollama or custom endpoints |
| Ollama not running | Run `ollama serve` in a terminal |

### "Rate limit or Quota exceeded"

| Cause | Action |
|---|---|
| Provider limit | Wait a few minutes |
| ChatGPT plan limits | Check usage under Settings |
| Persistent issue | Upgrade your plan or switch providers |

### "Model not found"

| Cause | Action |
|---|---|
| Typo | Double-check the model ID |
| Regional availability | Some models are not available in every region or plan |
| Wrong provider | The model ID must match the selected provider |

### Crab seems stuck or loops

| Action | Detail |
|---|---|
| Cancel | Stop the current task with the Cancel button |
| Rephrase | Make the request more specific |
| Diagnose visually | Ask "Take a screenshot and tell me what you see" |
| Login required | Crab cannot bypass logins or CAPTCHAs |

### Extension not responding

1. Open `chrome://extensions`.
2. Find Crab-Agent and click **Reload**.
3. Close and reopen the side panel.

## Best Practices

### Start Simple, Then Build Up

```
Go to google.com and search for "hello world"
```

Move on to harder tasks once you trust the basics.

### Use Follow-Up Messages

Continue the conversation instead of starting fresh every time.

```
You: Search for flights from NYC to London in June
Crab: [does the search, shows results]
You: Sort by cheapest
Crab: [sorts the results]
You: Show me details for the first option
```

### Let Crab Verify Its Own Work

Crab checks if URLs changed, buttons were clicked, forms were submitted. If something looks wrong:

```
That did not work. Try clicking the other button.
```

### Save Time with Workflows

Repeat a task more than twice? Record it as a [workflow](workflows.md). Next time, Crab replays it instantly.

### Use Context Rules for Tricky Sites

If a site has unusual UI patterns (hidden buttons, required scrolling, popups), add a [context rule](memory-and-rules.md). Crab will handle it correctly every time.

## Limitations

| Limitation | Workaround |
|---|---|
| Login pages | Crab asks you to log in manually, then continues |
| CAPTCHAs | Solve the CAPTCHA yourself, then tell Crab to continue |
| Two-factor auth | Complete 2FA manually, then Crab resumes |
| File system access | Crab can download and upload files but cannot browse your local folders |
| Multiple monitors | Crab works within the Chrome window and does not touch other apps |
| Very fast animations | Rapidly changing content is hard to read. Ask Crab to wait or take a screenshot |

## Performance Tips

| Tip | Benefit |
|---|---|
| Use a capable model | Claude Sonnet 4.6 or GPT-4o give the best results |
| Close unused tabs | Less memory load and faster screenshots |
| Keep pages loaded | Avoid navigating away while Crab is working |
| Be patient | Multi-step tasks take time, each step is one LLM call |
| Use Quick Mode | Available with Anthropic; faster for simple tasks |
