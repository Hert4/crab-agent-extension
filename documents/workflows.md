# Workflows

Workflows let you record a sequence of browser actions and replay them later — like macros for the web.

---

## How It Works

1. **Record** — You perform actions in the browser while Crab watches
2. **Save** — Crab captures every click, keystroke, and navigation
3. **Analyze** — The AI converts your recording into a reusable template with parameters
4. **Replay** — Run the workflow anytime with different inputs

---

## Recording a Workflow

1. Click the **Workflows** tab in the side panel
2. Click the **Record** button — a red bar appears at the top of the page
3. Perform your actions normally (click buttons, type text, navigate pages)
4. Click **Stop** when you're done
5. A save dialog appears — give your workflow a name and save it

> Everything you do while recording is captured: clicks, typing, scrolling, form submissions, and page navigations.

---

## What Gets Captured

| Action | Captured |
|--------|----------|
| Mouse clicks | Yes — position and target element |
| Typing | Yes — text content and target field |
| Page navigation | Yes — URL changes |
| Scrolling | Yes — scroll position |
| Form selection | Yes — dropdowns, checkboxes, radio buttons |
| File uploads | Partially — records the action, file must be available on replay |

---

## Auto-Parameterization

After you stop recording, Crab's AI analyzes the workflow and identifies which parts should be **parameters** — values that might change each time you run it.

For example, if you recorded yourself filling a form with "John Doe" and "john@email.com", Crab might create parameters like:

- `<name>` → "John Doe"
- `<email>` → "john@email.com"

Next time, you can replay with different values.

---

## Replaying a Workflow

There are two ways to replay:

### Automatic
Just describe what you want to do. If Crab recognizes a matching saved workflow, it uses it automatically.

```
Fill the contact form with name "Jane Smith" and email "jane@smith.com"
```

### Manual
You can also ask explicitly:

```
Run my "contact form" workflow with name="Jane Smith" and email="jane@smith.com"
```

---

## Example: Weekly Report

**Record once:**
1. Start recording
2. Go to your analytics dashboard
3. Set the date range to "last 7 days"
4. Click "Export CSV"
5. Stop recording, save as "Weekly Report Export"

**Replay every week:**
```
Run my "Weekly Report Export" workflow
```

---

## Managing Workflows

- View all saved workflows in the **Workflows** tab
- Delete workflows you no longer need
- Workflows are stored in your browser's local storage — they persist across sessions

---

## Tips

- **Keep recordings focused** — Record one task per workflow, not a long session
- **Use descriptive names** — "Submit expense report" is better than "workflow 1"
- **Test after saving** — Replay the workflow once to make sure it works correctly
- Workflows work best on **consistent pages** — if a site changes its layout, you may need to re-record
