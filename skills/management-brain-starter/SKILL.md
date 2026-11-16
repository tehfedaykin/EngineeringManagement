---
name: management-brain-starter
description: Set up a personal "management brain" app for an engineering manager. It's a local React app with an Eisenhower matrix (including a Monitor box), to-dos, a team page with notes and Slack links per person, a Notion notifications inbox, Linear supercycle and PR views, daily debriefs and reports. Interviews the manager for their team, Slack, Notion and Obsidian details, then lays out the app and its helper skills (daily-debrief, refresh-notion-inbox). The default theme is a warm golden-city pixel look. Use when someone asks to set up, create or install their own management brain, or a copy of a peer's.
---

# Management brain starter

Build a working copy of the management-brain app for the person running this skill. Everything
specific to its original owner has been replaced by blanks (`%%NAME%%`) that `scaffold.py` fills in
from the answers you collect. Nothing here sends messages or changes any connected service. The only
writes are the new app folder and new skill folders.

## 1. Check prerequisites

- `node` 20+ and `yarn` on PATH (`node -v`, `yarn -v`). If either is missing, say how to install it and stop.
- Which claude.ai connectors are available in this session. Look for tools starting with
  `mcp__claude_ai_Slack__`, `mcp__claude_ai_Notion__`, `mcp__claude_ai_Superhuman_Mail__`,
  `mcp__claude_ai_Linear__` and `mcp__claude_ai_Google_Calendar__`. Note which ones are missing; they
  decide which screens make sense (step 2).

## 2. Interview

Ask in small groups with AskUserQuestion where there are clear options, and in plain chat for free text.
Suggest defaults from what you can look up (the person's name and email from the session, their Slack
profile, their Notion user, `git config user.name`), and let them confirm instead of retyping.
Never guess a value you can't confirm; leave it blank and say what it affects.

**About them**
- Full name, first name, work email, role (e.g. "engineering manager"), company, team name, timezone (IANA, e.g. `America/New_York`).
- Where to create the app (default `~/Repos/my-management-brain`; it must not exist yet).
- Theme: `golden-city` (default: grass and dirt paths, brick shop-sign titles, cream signboards, pixel fonts) or `bubblegum` (90s pink).
  Show them the screenshots in `examples/` (read them with `Read`) so they can see golden-city first.

**Team members.** For each direct report: name, title, start date (YYYY-MM-DD, optional) and career goals
(optional, Markdown). Offer to look them up first:
- An org chart page in Notion (`notion-search` for "Org Chart"). Org charts are often images: get the
  file URL with `notion-get-file-download-urls`, download it into a new empty folder in the scratchpad,
  and read it with `Read`.
- Their Linear team's members (`list_users` / `get_team`).
Show the list you found and get a yes before using it. Career goals and start dates are usually
private HR notes: only read a page with them if the person points you to it.

**Slack.** Channels the daily debrief should read besides DMs, mentions and threads they're in.
Resolve each with `slack_search_channels` and confirm the exact names.

**Notion.**
- What to watch: e.g. "pages I own or recently edited, comments on our planning docs, the Pitches database".
- Recurring meeting agenda pages: for each, the meeting name, the page URL (confirm with `notion-search`)
  and how entries are named (e.g. "child pages named `YYYY.MM.DD Team Planning`").
- Notion inbox screen: only if the Superhuman connector is available, because it's built from Notion's
  notification emails. Without it, turn the screen off.

**Obsidian.**
- Vault path (check it exists with `ls`). Note how meeting notes are named and organized, e.g. "flat
  folder, notes named `YYYY.MM.DD <Name>[ 1on1].md`". Look at a few filenames with `ls` and propose the
  description, then confirm it.
- No Obsidian? The debrief still works from the other sources; leave the vault blank.

**Delivery tools (optional).** Linear team key (e.g. `ENG`) for the Supercycle and PRs screens, GitHub
repo (`org/repo`) and GitHub username for the debrief. No Linear → turn off the `linear` screens.

**Screens.** Confirm which to keep: `debriefs`, `notion`, `linear` (Supercycle + PRs), `reports`.
Matrix, To-dos and Team are always on.

## 3. Write answers and set up

Write the answers to a JSON file in the scratchpad:

```json
{
  "ownerName": "Sam Lee", "ownerFirst": "Sam", "ownerEmail": "sam@example.com",
  "ownerRole": "engineering manager", "company": "Example Co", "teamName": "Platform",
  "timezone": "America/New_York", "appDir": "~/Repos/my-management-brain", "theme": "golden-city",
  "screens": { "debriefs": true, "notion": true, "linear": true, "reports": true },
  "linearTeamKey": "PLT", "githubRepo": "example/app", "githubUser": "samlee",
  "obsidianVault": "~/Documents/Work", "obsidianLayout": "Flat folder; notes named `YYYY.MM.DD <Name>[ 1on1].md`.",
  "slackChannels": ["#team-platform", "#eng-leads"],
  "notionFocus": "pages I own or recently edited and comments on our planning docs",
  "notionAgendas": [{ "meeting": "Platform Planning (Tue)", "url": "https://www.notion.so/…", "naming": "child pages named `YYYY.MM.DD Platform Planning`" }],
  "team": [{ "name": "Alex Rivera", "title": "Senior Engineer", "startDate": "2023-04-03", "careerGoals": "" }],
  "installSkills": true
}
```

Show the person a short summary of the answers and get a yes, then run:

```bash
python3 -I ~/.claude/skills/management-brain-starter/scaffold.py <answers.json>
```

The script refuses to write into a non-empty app folder, skips (and reports) any helper skill
folder that already exists, and exits non-zero if any blank was left unfilled. If it skipped an
existing `daily-debrief` skill, tell the person; don't merge the two without asking.

## 4. Install, run and check

```bash
cd <appDir> && yarn install
```

Start `yarn dev` in the background *before* typechecking: the router plugin writes
`src/routeTree.gen.ts` when the dev server starts, and `yarn typecheck` fails without it. Once the
server answers, run `yarn typecheck`, then open the printed URL with the browser tools. Check the
Matrix, Team and one person's page render with no console errors, then stop the server unless they
want it running. Report anything that failed with its output.

Linear screens need a personal API key: ask them to put `LINEAR_API_KEY=…` in `<appDir>/.env.local`
themselves (never type keys for them), and set `LINEAR_TEAM_KEY` there too if it differs.

## 5. Hand off

Tell them, briefly:
- How to start the app (`yarn dev` in the app folder) and what each screen reads.
- That `data/` holds everything they enter (team notes, matrix) and is gitignored.
- Which helper skills were installed: "run a daily debrief" fills Debriefs and the Matrix;
  "refresh the Notion inbox" (or the button on the Notion screen) fills the Notion inbox.
- Anything left blank and which screen it affects.

## Notes

- The app runs headless Claude (`claude -p`) for the Notion refresh button, with a fixed read-only
  tool list in `server/notionRefresh.ts`. It expects `claude` at `~/.local/bin/claude`; set
  `CLAUDE_BIN` if theirs is elsewhere.
- The theme is in `src/themes/<theme>.css`, layered on `src/styles.css`. To switch later, change
  the import in `src/main.tsx` and the font link in `index.html`, using the values in `scaffold.py`'s `THEME_FONTS`.
