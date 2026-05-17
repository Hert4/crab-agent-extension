# Workflows

![Guide](https://img.shields.io/badge/guide-workflows-7c3aed?style=flat-square)
![Feature](https://img.shields.io/badge/feature-record%20%26%20replay-blue?style=flat-square)

Workflows let you record a sequence of browser actions and replay it later. Think of them as macros for the web.

## How It Works

| Step | What happens |
|---|---|
| 1. Record | You perform actions in the browser while Crab watches |
| 2. Save | Crab captures every click, keystroke, and navigation |
| 3. Analyze | The AI converts the recording into a reusable template with parameters |
| 4. Replay | You run the workflow whenever you want, with different inputs |

## Recording a Workflow

1. Click the **Workflows** tab in the side panel.
2. Click the **Record** button. A red bar appears at the top of the page.
3. Perform your actions normally (click, type, navigate).
4. Click **Stop** when finished.
5. A save dialog appears. Name your workflow and save it.

> Everything you do while recording is captured: clicks, typing, scrolling, form submissions, and page navigations.

## What Gets Captured

| Action | Captured |
|---|---|
| Mouse clicks | Yes, including position and target element |
| Typing | Yes, with text content and target field |
| Page navigation | Yes, URL changes |
| Scrolling | Yes, scroll position |
| Form selection | Yes, dropdowns, checkboxes, radio buttons |
| File uploads | Partially. The action is recorded, but the file must exist at replay time |

## Auto-Parameterization

After you stop recording, Crab's AI inspects the workflow and identifies which parts should be **parameters**, values that may change on each run.

If you filled a form with "John Doe" and "john@email.com", Crab might create parameters like:

| Placeholder | Captured value |
|---|---|
| `<name>` | John Doe |
| `<email>` | john@email.com |

Next time you can replay with different values.

## Replaying a Workflow

There are two ways.

### Automatic

Describe what you want. If Crab recognizes a saved workflow, it uses it automatically.

```
Fill the contact form with name "Jane Smith" and email "jane@smith.com"
```

### Manual

Ask explicitly:

```
Run my "contact form" workflow with name="Jane Smith" and email="jane@smith.com"
```

## Example: Weekly Report

**Record once:**

1. Start recording.
2. Go to your analytics dashboard.
3. Set the date range to "last 7 days".
4. Click "Export CSV".
5. Stop recording, save as "Weekly Report Export".

**Replay every week:**

```
Run my "Weekly Report Export" workflow
```

## Managing Workflows

- View all saved workflows in the **Workflows** tab.
- Delete workflows you no longer need.
- Workflows persist across sessions in your browser's local storage.

## Tips

| Tip | Why it matters |
|---|---|
| Keep recordings focused | One task per workflow keeps replays predictable |
| Use descriptive names | "Submit expense report" beats "workflow 1" |
| Test after saving | Replay once to confirm the workflow runs end-to-end |
| Re-record on UI changes | Site redesigns can break selectors; record again |
