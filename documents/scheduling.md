# Scheduling and Reminders

![Guide](https://img.shields.io/badge/guide-scheduling-7c3aed?style=flat-square)
![Feature](https://img.shields.io/badge/feature-chrome%20alarms-blue?style=flat-square)

Crab can schedule tasks to run later. Use this for reminders, delayed actions, or recurring jobs.

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

## Types of Schedules

### Relative Delays

Run a task after a specific amount of time.

```
In 5 minutes, refresh this page and check if my order status changed
```

```
After 2 hours, remind me to submit the report
```

Supported units: seconds, minutes, hours.

### Absolute Times

Run a task at a specific date and time.

```
At 3pm today, open Google Calendar and check my next meeting
```

```
Tomorrow morning at 9am, go to Gmail and show me unread emails
```

### Recurring Tasks

Run a task on a repeating schedule.

```
Every day at 10am, check Hacker News for AI-related posts
```

```
Every Monday at 9am, open Jira and list my assigned tickets
```

## How It Works

| Step | What happens |
|---|---|
| 1 | You describe the task and a time (for example, "in 5 minutes do X") |
| 2 | Crab parses the time expression and creates a Chrome Alarm |
| 3 | The alarm fires at the scheduled time |
| 4 | Crab opens the side panel and runs the task |
| 5 | A notification confirms "Scheduled task running: ..." |

### Reliability

| Property | Detail |
|---|---|
| Engine | Chrome Alarms API |
| Side panel | Not required to stay open |
| Restarts | Alarms persist across browser restarts |
| Required | The extension must remain installed and enabled |

## Managing Scheduled Tasks

View or cancel tasks through the chat or the side panel.

```
Show my scheduled tasks
```

```
Cancel the reminder I set for tomorrow
```

Scheduled tasks also appear in the side panel when created, with a confirmation showing the exact scheduled time.

## Tips

| Tip | Why |
|---|---|
| Be specific about the action | "Remind me" should always describe what to do |
| Pair with workflows | Schedule a recorded workflow to run daily |
| English and Vietnamese | Both time expressions are recognized |
| Use cron for repeating jobs | "Every Monday at 9am" works without manual cron syntax |
