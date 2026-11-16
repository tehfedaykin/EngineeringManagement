---
name: refresh-notion-inbox
description: Refresh the Notion notifications snapshot in %%OWNER_FIRST%%'s management-brain app (%%APP_DIR%%/data/notion-notifications.json) from Notion's notification emails in Superhuman. Fetches only emails newer than the last snapshot, refreshes unread state, and keeps a rolling 30-day window. Read-only on the mailbox. Use when asked to refresh the Notion snapshot/inbox for the brain app, or when a scheduled daily refresh fires.
---

# Refresh the Notion inbox snapshot

The app's `/notion` page reads `%%APP_DIR%%/data/notion-notifications.json`. Its types are in `%%APP_DIR%%/src/lib/notion.ts`. This skill updates that file incrementally.

**Read-only on email:** never mark read, archive, reply, or open any link in a Notion email. Links in the HTML are `mg.mail.notion.com` click-tracking redirects; don't request `raw_html`.

## Steps

1. Read the snapshot's `fetchedAt` (call it LAST). Set TODAY = today's date and WINDOW_START = TODAY minus 30 days.
2. Load tools in one ToolSearch: `select:mcp__claude_ai_Superhuman_Mail__list_threads,mcp__claude_ai_Superhuman_Mail__get_thread,mcp__claude_ai_Notion__notion-search`. Use account %%OWNER_EMAIL%%.
3. **Unread ids:** `list_threads` with `from: ["notify@mail.notion.com"]`, `start_date: WINDOW_START`, `is_unread: true`, `limit: 50`, paging through `next_cursor`. Collect every message id whose labels include UNREAD into a JSON array file (use jq on the saved output if it overflows).
4. **New emails:** `list_threads` with `from: ["notify@mail.notion.com"]`, `start_date:` the later of LAST minus 1 day and WINDOW_START. For each message id not already in the snapshot, read it with `get_thread` and parse the plain-text body into one item per message:
   ```
   { id, threadId, kind: "mention"|"comment"|"invite"|"access_request"|"digest",
     date (ISO UTC; body time is %%TIMEZONE%%, fall back to sent_at; digests use sent_at),
     unread, author, otherAuthorsCount, pageTitle (no emoji), pageIcon, pageUrl, path ("A / B / C"),
     snippet (comment text, or mention context, ≤400 chars), context (text a comment is attached to, or null),
     digestPages: [{ title, icon, url, summary }] (digest only) }
   ```
   Body shapes: comments read "<Author> commented in <icon> <Title><date>·<path><quoted text><Author>\n<comment>Reply"; mentions "<Author> mentioned you in <Title> <date> ·<path> <context> Go to page" (say "(person property)" when the mention is a property like "Engineering Owner"); digests "X and N others made updates in <workspace>" list several pages with who commented/edited.
5. **Page URLs:** reuse URLs from existing snapshot items with the same title. For new titles, `notion-search` by title and accept only an exact or near-exact match (prefer the result whose path matches the email); otherwise null. Write as `https://www.notion.so/<id>`.
6. Write the new items to a scratch JSON file, then run:
   `python3 -I ~/.claude/skills/refresh-notion-inbox/merge.py %%APP_DIR%%/data/notion-notifications.json <new.json> <unread.json> WINDOW_START TODAY`
7. Report one line: how many new items (by kind), unread count, and any null URLs. Mention any new mention or comment that @-mentions %%OWNER_FIRST%% by author and page.
