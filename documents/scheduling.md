# Scheduling & Reminders

Crab can schedule tasks to run later — useful for reminders, delayed actions, and recurring jobs.

---

## Quick Examples

```
Remind me in 30 minutes to check my email
```

```
At 9am tomorrow, open my analytics dashboard and take a screenshot
```

```
Every day at 5pm, check if there are new issues on my GitHub repo
```

---

## Types of Schedules

### Relative Delays

Set a task to run after a specific amount of time:

```
In 5 minutes, refresh this page and check if my order status changed
```

```
After 2 hours, remind me to submit the report
```

Supported units: seconds, minutes, hours.

### Absolute Times

Set a task for a specific date and time:

```
At 3pm today, open Google Calendar and check my next meeting
```

```
Tomorrow morning at 9am, go to Gmail and show me unread emails
```

### Recurring Tasks

Set tasks that repeat on a schedule:

```
Every day at 10am, check Hacker News for AI-related posts
```

```
Every Monday at 9am, open Jira and list my assigned tickets
```

---

## How It Works

1. You describe the task with a time (e.g., "in 5 minutes, do X")
2. Crab parses the time and creates a Chrome Alarm
3. When the alarm fires, Crab automatically opens the side panel and runs the task
4. You'll see a notification: "⏰ Scheduled task running: ..."

### Reliability

- Uses **Chrome Alarms API** — works even if you close the side panel
- Survives browser restart (alarms persist)
- The extension must remain installed and enabled

---

## Managing Scheduled Tasks

You can view and cancel scheduled tasks:

```
Show my scheduled tasks
```

```
Cancel the reminder I set for tomorrow
```

Scheduled tasks also appear in the side panel when they're created, with a confirmation message showing the exact scheduled time.

---

## Tips

- **Be specific** about what you want Crab to do when the timer fires
- For quick reminders, just say "remind me in X minutes to..."
- For complex recurring tasks, combine with [Workflows](workflows.md) — schedule a workflow to run daily
- Crab understands both English and Vietnamese time expressions
