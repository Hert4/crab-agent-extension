# Tips & Troubleshooting

Get the most out of Crab and fix common issues.

---

## Writing Better Prompts

### Be Specific

```
Bad:  Check my email
Good: Open Gmail and tell me how many unread emails I have from today
```

### Break Down Complex Tasks

```
Bad:  Set up my entire project on GitHub with CI/CD
Good: Go to github.com, create a new repository called "my-app",
      set it to public, and add a README
```

### Include Context

```
Bad:  Fill the form
Good: Fill the registration form with:
      Name: John Doe
      Email: john@example.com
      Password: MyPass123
      Then click "Sign Up"
```

### Let Crab Figure Out the Details

You don't need to describe every click. Crab understands intent:

```
Good: Search Google for the weather in Tokyo and tell me the temperature
```

Crab will figure out: go to google.com → type the query → read the result → respond.

---

## Permission Modes

| Mode | When to Use |
|------|-------------|
| **Ask** (default) | Most users — Crab asks before acting on new domains |
| **Auto** | When you trust the task fully and want zero interruptions |
| **Strict** | When working with sensitive pages (banking, admin panels) |

Change in **Settings** → **Permission Mode**.

---

## Common Errors & Fixes

### "Invalid API Key"

- Double-check your API key in Settings
- Make sure you're using the right key format for your provider
- Regenerate the key if it might have expired

### "Provider / Model mismatch"

- Each provider has its own model IDs
- Anthropic: `claude-sonnet-4-6` (not `gpt-4o`)
- OpenAI: `gpt-4o` (not `claude-...`)
- Check the [Providers](providers.md) guide for correct model IDs

### "Cannot connect to API"

- Check your internet connection
- Verify the Base URL in Settings (especially for Ollama or custom endpoints)
- For Ollama: make sure the server is running (`ollama serve`)

### "Rate limit / Quota exceeded"

- You've hit your provider's usage limit
- Wait a few minutes and try again
- For ChatGPT (Sign in): check your 5-hour and weekly usage in Settings
- Consider upgrading your plan or switching to a different provider

### "Model not found"

- The model ID you typed doesn't exist for this provider
- Check for typos in the model name
- Verify the model is available in your region/plan

### Crab seems stuck or loops

- Click **Cancel** to stop the current task
- Try rephrasing your request more specifically
- If a page has complex dynamic content, try: "Take a screenshot and tell me what you see"
- Check if the page requires login — Crab will ask for help with login/CAPTCHA

### Extension not responding

1. Go to `chrome://extensions`
2. Find Crab-Agent and click the **reload** button
3. Close and reopen the side panel

---

## Best Practices

### Start Simple, Then Build Up

Begin with basic tasks to understand how Crab works:

```
Go to google.com and search for "hello world"
```

Then gradually try more complex things.

### Use Follow-Up Messages

Don't start a new task for every question. Continue the conversation:

```
You: Search for flights from NYC to London in June
Crab: [does the search, shows results]
You: Sort by cheapest
Crab: [sorts the results]
You: Show me details for the first option
```

### Let Crab Verify Its Own Work

Crab automatically verifies actions (checks if URLs changed, buttons were clicked, forms submitted). If something looks wrong, just tell it:

```
That didn't work — try clicking the other button
```

### Save Time with Workflows

If you repeat a task more than twice, [record it as a workflow](workflows.md). Next time, Crab can replay it instantly.

### Use Context Rules for Tricky Sites

If a website has unusual UI patterns (hidden buttons, required scrolling, popups), [add a context rule](memory-and-rules.md) so Crab handles it correctly every time.

---

## Limitations

| Limitation | Workaround |
|------------|------------|
| **Login pages** | Crab asks you to log in manually, then continues |
| **CAPTCHAs** | Solve the CAPTCHA yourself, then tell Crab to continue |
| **Two-factor auth** | Complete 2FA manually, then Crab takes over |
| **File system access** | Crab can download files and upload from file inputs, but can't browse your local folders |
| **Multiple monitors** | Crab works within the Chrome window — doesn't interact with other apps |
| **Very fast animations** | Dynamic content that changes rapidly may be hard to read — ask Crab to wait or take a screenshot |

---

## Performance Tips

- **Use a capable model** — Claude Sonnet 4.6 or GPT-4o give the best results
- **Close unnecessary tabs** — Reduces memory usage and speeds up screenshots
- **Keep pages loaded** — Don't navigate away from a page while Crab is working on it
- **Be patient with complex tasks** — Multi-step tasks take time; each step involves an LLM call
- **Use Quick Mode** for simple tasks (Anthropic only) — faster responses with less overhead
