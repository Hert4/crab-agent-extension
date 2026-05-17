# Memory and Context Rules

![Guide](https://img.shields.io/badge/guide-memory%20%26%20rules-7c3aed?style=flat-square)
![Feature](https://img.shields.io/badge/feature-persistent%20learning-blue?style=flat-square)

Crab has a persistent memory system that helps it learn about you and the websites you use.

## How Memory Works

Crab stores three types of information.

| Type | What it stores | Example |
|---|---|---|
| **Rule** | How to interact with a specific website | "Submit button only appears after scrolling down" |
| **Fact** | Personal preferences or information | "User prefers dark mode", "User's name is Alex" |
| **Summary** | Key takeaways from past tasks | "Successfully exported Q3 report from dashboard" |

Memory persists across sessions. Close the browser, come back tomorrow, and Crab still remembers.

## Automatic Learning

After each task, Crab pulls useful information out of the conversation:

| What you say | What Crab saves |
|---|---|
| "I prefer responses in bullet points" | Fact about your formatting preference |
| "My email is alex@company.com" | Fact for future form filling |
| Discovers a tricky interaction on a site | Rule scoped to that domain |

You do not need to do anything. This happens in the background.

## Context Rules

Context rules are per-domain hints that tell Crab how to interact with a specific website.

### Why Use Rules

Some websites have quirks:

| Quirk | Effect |
|---|---|
| Hidden submit button | Crab cannot find it without scrolling |
| Popup before main content | Crab has to dismiss it first |
| Unusual navigation path | The right feature is buried two clicks deep |

Rather than explaining each quirk every time, save it as a rule.

### Adding Rules Manually

1. Go to **Settings** and scroll to **Context Rules**.
2. Click **Add**.
3. Enter the **domain** (for example `github.com` or `*.google.com`).
4. Write a **note for the AI** (for example "The comment box requires clicking the Write tab first").
5. Click **Save**.

### AI-Suggested Rules

Sometimes Crab notices a pattern and offers to save a rule. You see a banner reading "AI suggests saving a rule". Click **Save this rule** to keep it or **Dismiss** to ignore.

### How Rules Are Used

When you visit a matching domain, Crab loads the relevant rules into its context automatically. It only sees rules for the current domain; the rest stay hidden.

## Dream Consolidation

Memory accumulates over time. Crab cleans it up through a process called **Dream Consolidation**:

| Trigger | When it runs |
|---|---|
| Session count | After about 5 sessions since the last dream |
| Time elapsed | At least 24 hours later |

During a dream, duplicate entries are merged, outdated information is removed, and related facts get rolled into summaries.

You can trigger it manually:

1. Go to **Settings** and open **Agent Memory**.
2. Click **Consolidate Now**.

## Managing Memory

### View Memories

Open **Settings** and then **Agent Memory**. Entries are grouped by domain.

### Delete Entries

Click the X next to any entry to remove it.

### Clear All

Click the trash icon to clear every entry. You will be asked to confirm.

### Export and Import

| Action | What happens |
|---|---|
| Export | Downloads all memories as a `.json` file |
| Import (merge) | Adds the imported entries alongside the existing ones |
| Import (replace) | Deletes existing entries and loads only the imported ones |

### Enable or Disable

Toggle **Enable Memory** on or off in Settings. When disabled, Crab does not save or recall anything.

## Tips

| Tip | Why it matters |
|---|---|
| Be explicit about preferences | "Remember that I always want reports in PDF format" creates a clean fact |
| Review periodically | Stale entries can mislead Crab on future tasks |
| Export before clearing | Always back up first if you have many useful entries |
| Wildcard domains | Use `*.google.com` to match all Google subdomains |
