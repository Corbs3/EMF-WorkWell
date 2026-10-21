# WorkWell

A Chrome extension for healthier working days: gentle reminders to stand, rest your eyes, check your posture, drink water and take screen breaks, plus a display screen equipment (DSE) self-check and simple wellbeing tools.

## Features

- **Reminders:** stand and stretch (20-8-2), eye rest (20-20-20), posture checks and screen breaks, with idle detection so timers pause when you're away
- **Hydration tracker:** target based on your working hours
- **Growing plant:** a workday sky header with a plant that grows as you take healthy breaks
- **Mind tab:** box breathing, 5-4-3-2-1 grounding, an optional private mood check-in (stored locally only) and support links
- **DSE self-check:** every 90 days, with tips for anything flagged and optional posting of results to Slack
- **Light and dark mode:** follows the system setting, or choose your own

## Install for testing

1. Go to `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and choose this folder

## Configure for your organisation

Everything organisation-specific is left blank. Fill in what you need:

| Setting | File | What it does |
|---|---|---|
| `SLACK_WEBHOOK_URL` | `background.js` | Posts DSE results to a Slack channel. Leave empty to turn this off. |
| `ORG_CONFIG.ergonomicsGuideUrl` | `popup.js` | Link shown under DSE items that need attention |
| `SUPPORT_CONFIG.counselling` | `popup.js` | Your counselling or Employee Assistance service |
| `SUPPORT_CONFIG.mhfa` | `popup.js` | Your Mental Health First Aiders |
| `SUPPORT_CONFIG.hubUrl` | `popup.js` | Your intranet's wellbeing page |

Empty entries are hidden. The public helplines (Samaritans, Shout, Mind and NHS 111) are UK services, so change `PUBLIC_SUPPORT` in `popup.js` if you're elsewhere.

## Keep secrets out of Git

**Never commit a real Slack webhook URL.** Anyone who has it can post to your channel, and Slack automatically revokes webhooks it finds in public repositories. Add the URL only to the copy you package for your Chrome Web Store upload.

## Privacy

- Reminder progress, settings and mood check-ins stay in the user's own Chrome profile
- Mood check-ins are never sent anywhere
- If a Slack webhook is configured, completed DSE results (name or email, score and flagged items) are posted to that channel
- No analytics or tracking

## Disclaimer

WorkWell isn't a replacement for professional support. If you or someone else is in immediate danger, call your local emergency number.
