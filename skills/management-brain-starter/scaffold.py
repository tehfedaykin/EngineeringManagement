"""Create a management-brain app (and its helper skills) from answers.json.

usage: python3 -I scaffold.py <answers.json> [--skills-dir ~/.claude/skills]

Never overwrites: the app directory must not exist or must be empty, and a helper skill whose folder
already exists is skipped and reported.
"""
import json
import re
import shutil
import sys
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE / "template"

THEME_FONTS = {
    "golden-city": "https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap",
    "bubblegum": "https://fonts.googleapis.com/css2?family=Pacifico&family=Fredoka:wght@400;500;600;700&display=swap",
    "y2k-petsite": "https://fonts.googleapis.com/css2?family=Chewy&display=swap",
}

# Screen -> (route files to delete, nav paths to remove)
SCREENS = {
    "debriefs": (["debriefs.tsx", "debriefs.index.tsx", "debriefs.$date.tsx"], ["/debriefs"]),
    "notion": (["notion.tsx"], ["/notion"]),
    "linear": (["supercycle.tsx", "prs.tsx"], ["/supercycle", "/prs"]),
    "reports": (["reports.tsx", "reports.index.tsx", "reports.$id.tsx"], ["/reports"]),
}

TEXT_SUFFIXES = {".ts", ".tsx", ".css", ".html", ".md", ".json", ".py", ".gitignore", ""}
PLACEHOLDER = re.compile(r"%%([A-Z_]+)%%")


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def agenda_rows(agendas):
    if not agendas:
        return "| _(none yet)_ | Add rows here as `| Meeting | [Page](url): how entries are named |` |"
    return "\n".join(f"| {a['meeting']} | [{a['meeting']}]({a['url']}): {a.get('naming', 'one entry per session')} |" for a in agendas)


def values(a):
    channels = a.get("slackChannels") or []
    return {
        "OWNER_NAME": a["ownerName"],
        "OWNER_FIRST": a.get("ownerFirst") or a["ownerName"].split()[0],
        "OWNER_EMAIL": a["ownerEmail"],
        "OWNER_ROLE": a.get("ownerRole", "engineering manager"),
        "COMPANY": a["company"],
        "TEAM_NAME": a["teamName"],
        "TIMEZONE": a.get("timezone", "America/New_York"),
        "APP_DIR": str(Path(a["appDir"]).expanduser()),
        "APP_TITLE": a.get("appTitle") or f"{a.get('ownerFirst') or a['ownerName'].split()[0]}'s Management Brain",
        "THEME": a.get("theme", "golden-city"),
        "THEME_FONTS": THEME_FONTS[a.get("theme", "golden-city")],
        "LINEAR_TEAM_KEY": a.get("linearTeamKey", ""),
        "GITHUB_REPO": a.get("githubRepo", ""),
        "GITHUB_ORG": re.escape(a.get("githubRepo", "x/x").split("/")[0]),
        "GITHUB_USER": a.get("githubUser", ""),
        "OBSIDIAN_VAULT": str(Path(a.get("obsidianVault", "")).expanduser()) if a.get("obsidianVault") else "(no vault configured)",
        "OBSIDIAN_LAYOUT": a.get("obsidianLayout", "Markdown meeting notes."),
        "SLACK_CHANNELS": ", ".join(c if c.startswith("#") else f"#{c}" for c in channels) or "(none; DMs, mentions and threads only)",
        "NOTION_FOCUS": a.get("notionFocus", "pages they recently edited or own"),
        "NOTION_AGENDAS": agenda_rows(a.get("notionAgendas")),
    }


def fill(text, vals):
    return PLACEHOLDER.sub(lambda m: vals.get(m.group(1), m.group(0)), text)


def fill_tree(root, vals):
    for path in root.rglob("*"):
        if path.is_file() and (path.suffix in TEXT_SUFFIXES or path.name == ".gitignore") and path.name != "yarn.lock":
            text = path.read_text()
            new = fill(text, vals)
            if new != text:
                path.write_text(new)


def leftovers(root):
    found = []
    for path in root.rglob("*"):
        if path.is_file() and path.name != "yarn.lock" and path.suffix in TEXT_SUFFIXES:
            for m in PLACEHOLDER.finditer(path.read_text()):
                found.append(f"{path.relative_to(root)}: {m.group(0)}")
    return found


def main():
    answers = json.loads(Path(sys.argv[1]).read_text())
    skills_dir = Path(sys.argv[sys.argv.index("--skills-dir") + 1] if "--skills-dir" in sys.argv else "~/.claude/skills").expanduser()
    vals = values(answers)
    app = Path(vals["APP_DIR"])
    if app.exists() and any(app.iterdir()):
        raise SystemExit(f"{app} already exists and isn't empty; pick another appDir.")

    shutil.copytree(TEMPLATE / "app", app, dirs_exist_ok=True)

    screens = {**{name: True for name in SCREENS}, **answers.get("screens", {})}
    root_route = app / "src/routes/__root.tsx"
    nav = root_route.read_text().splitlines(keepends=True)
    for name, enabled in screens.items():
        if enabled:
            continue
        files, paths = SCREENS[name]
        for f in files:
            (app / "src/routes" / f).unlink(missing_ok=True)
        nav = [line for line in nav if not any(f'to="{p}"' in line for p in paths)]
    root_route.write_text("".join(nav))
    for theme in THEME_FONTS:
        if theme != vals["THEME"]:
            (app / f"src/themes/{theme}.css").unlink(missing_ok=True)

    fill_tree(app, vals)

    data = app / "data"
    data.mkdir(exist_ok=True)
    team = [
        {
            "id": slug(m["name"]),
            "name": m["name"],
            "title": m.get("title", ""),
            "startDate": m.get("startDate") or None,
            "careerGoals": m.get("careerGoals", ""),
            "notes": [],
        }
        for m in answers.get("team", [])
    ]
    (data / "team.json").write_text(json.dumps(team, indent=2))
    if screens["notion"]:
        today = date.today()
        (data / "notion-notifications.json").write_text(
            json.dumps(
                {
                    "fetchedAt": "1970-01-01T00:00:00Z",
                    "windowStart": (today - timedelta(days=30)).isoformat(),
                    "windowEnd": today.isoformat(),
                    "notes": ["Not refreshed yet. Click Refresh from inbox."],
                    "items": [],
                },
                indent=2,
            )
        )

    installed, skipped = [], []
    if answers.get("installSkills", True):
        wanted = ["daily-debrief"] if screens["debriefs"] else []
        if screens["notion"]:
            wanted.append("refresh-notion-inbox")
        for name in wanted:
            dest = skills_dir / name
            if dest.exists():
                skipped.append(str(dest))
                continue
            shutil.copytree(TEMPLATE / "skills" / name, dest)
            fill_tree(dest, vals)
            installed.append(str(dest))

    missing = leftovers(app) + [l for d in installed for l in leftovers(Path(d))]
    print(json.dumps({"app": str(app), "team": len(team), "screens": screens, "theme": vals["THEME"],
                      "installedSkills": installed, "skippedExistingSkills": skipped, "unfilled": missing}, indent=2))
    if missing:
        sys.exit(1)


if __name__ == "__main__":
    main()
