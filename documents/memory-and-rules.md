# Memory & Context Rules

Crab has a persistent memory system that helps it learn about you and the websites you use.

---

## How Memory Works

Crab stores three types of information:

| Type | What it stores | Example |
|------|---------------|---------|
| **Rule** | How to interact with a specific website | "On this site, the submit button only appears after scrolling down" |
| **Fact** | Personal preferences or information | "User prefers dark mode", "User's name is Alex" |
| **Summary** | Key takeaways from past tasks | "Successfully exported Q3 report from dashboard" |

Memory persists across sessions — close the browser, come back tomorrow, and Crab still remembers.

---

## Automatic Learning

After each task, Crab automatically extracts useful information from your conversation:

- If you say "I prefer responses in bullet points" → Crab saves that as a fact
- If you mention "My email is alex@company.com" → Crab remembers for future form-filling
- If the agent discovers a tricky interaction on a website → It saves it as a rule

You don't need to do anything — this happens in the background.

---

## Context Rules

Context rules are **per-domain hints** that tell Crab how to interact with specific websites.

### Why Use Rules?

Some websites have quirks:
- A button that only appears after scrolling
- A popup that needs to be dismissed first
- A specific navigation path to reach a feature

Instead of explaining this every time, save it as a rule.

### Adding Rules Manually

1. Go to **Settings** → scroll to **Context Rules**
2. Click **Add**
3. Enter the **domain** (e.g., `github.com` or `*.google.com`)
4. Write a **note for AI** (e.g., "The comment box requires clicking 'Write' tab first")
5. Click **Save**

### AI-Suggested Rules

Sometimes Crab will suggest a rule after discovering a pattern on a website. You'll see a banner:

> 💡 AI suggests saving a rule

Click **Save this rule** to keep it, or **Dismiss** to ignore.

### How Rules Are Used

When you visit a matching domain, Crab automatically loads the relevant rules into its context. It only sees rules for the current domain — other rules stay hidden.

---

## Dream Consolidation

Over time, memory can accumulate redundant or outdated entries. Crab has an automatic cleanup process called **Dream Consolidation**:

- After several sessions, Crab reviews all memories
- Duplicate entries are merged
- Outdated information is removed
- Related facts are combined into summaries

You can also trigger this manually:

1. Go to **Settings** → **Agent Memory**
2. Click **Consolidate Now**

---

## Managing Memory

### View Memories

Go to **Settings** → **Agent Memory**. All entries are listed, grouped by domain.

### Delete Entries

Click the **X** button next to any memory entry to remove it.

### Clear All

Click the trash icon to clear all memory entries (with confirmation).

### Export / Import

- **Export** — Downloads all memories as a `.json` file (for backup)
- **Import** — Load memories from a `.json` file
  - **Merge** — Adds imported entries alongside existing ones
  - **Replace** — Deletes existing entries and loads only the imported ones

### Enable / Disable

Toggle **Enable Memory** on or off in Settings. When disabled, Crab won't save or recall any memories.

---

## Tips

- **Be explicit** about preferences you want Crab to remember: "Remember that I always want reports in PDF format"
- **Review periodically** — Check your memories every now and then to remove anything outdated
- **Export before clearing** — Always export a backup before clearing all memories
- Rules work with **wildcard domains** — use `*.google.com` to match all Google subdomains
