"""Fold newly fetched Notion notification emails into the brain app's snapshot.

usage: python3 -I merge.py <snapshot.json> <new-emails.json> <unread-ids.json> <window-start YYYY-MM-DD> <today YYYY-MM-DD>

- new-emails.json: array of email items (see SKILL.md for the shape); may overlap the snapshot.
- unread-ids.json: array of message ids that currently have Superhuman's UNREAD label.
Writes the snapshot in place and prints a summary.
"""
import json
import sys
from datetime import datetime, timezone

snapshot_path, new_path, unread_path, window_start, today = sys.argv[1:6]
snapshot = json.load(open(snapshot_path))
new_items = json.load(open(new_path))
unread_ids = set(json.load(open(unread_path)))

by_id = {i["id"]: i for i in snapshot["items"] if i["date"][:10] >= window_start}
added = 0
for item in new_items:
    if item["id"] not in by_id:
        added += 1
    # Keep the resolved flag carried over from the earlier API merge.
    prev = by_id.get(item["id"], {})
    by_id[item["id"]] = {**item, "source": "email", "resolved": prev.get("resolved", item.get("resolved", False))}

for item in by_id.values():
    if item["source"] == "email":
        item["unread"] = item["id"] in unread_ids

items = sorted(by_id.values(), key=lambda i: i["date"], reverse=True)
emails = sum(1 for i in items if i["source"] == "email")
api = len(items) - emails
null_urls = sorted({i["pageTitle"] for i in items if i["kind"] != "digest" and not i.get("pageUrl")})

snapshot.update(
    {
        "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "windowStart": window_start,
        "windowEnd": today,
        "notes": [
            f"{emails} notification emails from notify@mail.notion.com"
            + (f", plus {api} from an earlier Notion search that Notion never emailed." if api else "."),
        ]
        + ([f"No Notion URL found for: {', '.join(null_urls)}."] if null_urls else []),
        "items": items,
    }
)
json.dump(snapshot, open(snapshot_path, "w"), indent=2, ensure_ascii=False)
print(f"added={added} total={len(items)} unread={sum(1 for i in items if i.get('unread'))} null_urls={null_urls}")
