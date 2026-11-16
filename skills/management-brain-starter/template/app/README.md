# my-management-brain

A personal management app (React + TanStack Router + Vite).

- **Matrix** (`/`): an Eisenhower matrix of open commitments from the daily-debrief ledger, plus to-dos you add by hand. Drag cards between quadrants, or use the dropdown on each card. Placements save to `data/matrix.json`, which is gitignored.
- **To-dos** (`/todos`): every to-do, open and completed, with checkboxes to mark them complete or incomplete.
- **Supercycle** (`/supercycle`): a Gantt timeline of the %%TEAM_NAME%% projects in the Active "Supercycle N" Linear initiative, with status, health, progress and milestones. Expand a project to see its milestones.
- **PRs** (`/prs`): draft, open and closed PRs for those same supercycle projects, grouped by project. A PR belongs to a project when Linear's GitHub integration has linked it to one of the project's issues, which it does from the ticket ID in the branch or title.
- **Debriefs** (`/debriefs`): lists daily debriefs and renders the selected one's Markdown.
- **Reports** (`/reports`): renders saved reports from `data/reports/<id>.json` (gitignored), newest first. A report is `{ title, createdAt, description?, method?, blocks }`. The block types are `stats`, `bar`, `table` and `markdown`, defined in `src/lib/reports.ts`. To add a report, drop a new JSON file in that folder. The app doesn't need to change.

## Run

```sh
yarn
yarn dev
```

The dev server reads `~/.claude/skills/daily-debrief/records/` (`ledger.json` and `briefs/*.md`). Point it elsewhere with `DEBRIEF_RECORDS_DIR=/path yarn dev`.

The Supercycle screen needs a Linear personal API key in `LINEAR_API_KEY`, either in your shell or in `.env.local` (gitignored). The key is only used by the dev server and never reaches the browser. `LINEAR_TEAM_KEY` picks the team (default `WFL`).

The data API only runs in the Vite dev server. There is no production backend.
