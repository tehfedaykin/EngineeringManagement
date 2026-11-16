import { useState } from 'react';
import type { NotionNotification, NotionNotificationKind, NotionSnapshot } from '../lib/notion';
import { NotionRefreshButton } from './NotionRefreshButton';

type Filter = 'all' | NotionNotificationKind;

const KIND_LABELS: Record<NotionNotificationKind, string> = {
  mention: 'Mentioned you',
  comment: 'Comment',
  invite: 'Invited you',
  access_request: 'Access request',
  digest: 'Page updates',
};

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  mention: 'Mentions',
  comment: 'Comments',
  invite: 'Invites',
  access_request: 'Access requests',
  digest: 'Page updates',
};

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function authorLine(item: NotionNotification): string | null {
  if (!item.author) return null;
  const others = item.otherAuthorsCount ?? 0;
  if (others === 0) return item.author;
  return `${item.author} and ${others} other${others === 1 ? '' : 's'}`;
}

function searchText(item: NotionNotification): string {
  const digest = (item.digestPages ?? []).flatMap((p) => [p.title, p.summary]);
  return [item.pageTitle, item.author, item.snippet, item.context, item.path, ...digest]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

// "All" leaves out page-update digests: they're mostly edit noise, so they're opt-in through their own filter.
function matchesKind(item: NotionNotification, filter: Filter): boolean {
  return filter === 'all' ? item.kind !== 'digest' : item.kind === filter;
}

function PageLink({ title, icon, url }: { title: string; icon?: string | null; url: string | null }) {
  const label = `${icon ? `${icon} ` : ''}${title}`;
  if (!url) return <span className="pr-title">{label}</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="pr-title">
      {label}
    </a>
  );
}

export function NotionInbox({ snapshot }: { snapshot: NotionSnapshot }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [hideResolved, setHideResolved] = useState(false);

  const counts = (Object.keys(FILTER_LABELS) as Filter[]).map((value) => ({
    value,
    count: snapshot.items.filter((n) => matchesKind(n, value)).length,
  }));
  const unreadCount = snapshot.items.filter((n) => matchesKind(n, filter) && n.unread).length;

  const needle = query.trim().toLowerCase();
  const visible = snapshot.items
    .filter((n) => matchesKind(n, filter))
    .filter((n) => !(unreadOnly && !n.unread))
    .filter((n) => !(hideResolved && n.resolved))
    .filter((n) => !needle || searchText(n).includes(needle))
    .sort((a, b) => b.date.localeCompare(a.date));

  const groups = new Map<string, NotionNotification[]>();
  for (const item of visible) {
    const key = dayKey(item.date);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return (
    <div className="supercycle-page">
      <header className="supercycle-header">
        <div>
          <h1>Notion</h1>
          <p className="muted">
            Notifications from {snapshot.windowStart} to {snapshot.windowEnd} · snapshot taken{' '}
            {new Date(snapshot.fetchedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        <NotionRefreshButton />
      </header>

      <div className="pr-toolbar">
        <div className="filters" role="group" aria-label="Filter by kind">
          {counts
            .filter(({ value, count }) => value === 'all' || count > 0)
            .map(({ value, count }) => (
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
                {FILTER_LABELS[value]} ({count})
              </button>
            ))}
        </div>
        <div className="notion-toolbar-right">
          <label className="hide-resolved">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> Unread
            only ({unreadCount})
          </label>
          <label className="hide-resolved">
            <input type="checkbox" checked={hideResolved} onChange={(e) => setHideResolved(e.target.checked)} /> Hide
            resolved
          </label>
          <input
            type="search"
            className="pr-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search page, person, text…"
            aria-label="Search notifications"
          />
        </div>
      </div>

      {visible.length === 0 && <p className="muted">Nothing matches.</p>}

      {[...groups.entries()].map(([day, items]) => (
        <section key={day} className="pr-project">
          <header className="pr-project-header">
            <h2>{day}</h2>
            <span className="gantt-meta">{items.length}</span>
          </header>
          <ul className="pr-list">
            {items.map((item) => (
              <li
                key={item.id}
                className={`notion-row${item.resolved ? ' resolved' : ''}${item.unread ? ' unread' : ''}`}
              >
                <span className={`notion-kind notion-kind-${item.kind}`}>{KIND_LABELS[item.kind]}</span>
                <div className="pr-main">
                  {item.kind === 'digest' ? (
                    <>
                      <span className="pr-title">{authorLine(item)} made updates</span>
                      <ul className="notion-digest">
                        {(item.digestPages ?? []).map((page) => (
                          <li key={page.title}>
                            <PageLink title={page.title} icon={page.icon} url={page.url} />
                            <p className="notion-snippet">{page.summary}</p>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <>
                      <PageLink title={item.pageTitle} icon={item.pageIcon} url={item.pageUrl} />
                      {item.context && <blockquote className="notion-context">{item.context}</blockquote>}
                      {item.snippet && <p className="notion-snippet">{item.snippet}</p>}
                      <span className="gantt-meta">
                        {authorLine(item) && <span>{authorLine(item)}</span>}
                        {item.path && <span>{item.path}</span>}
                        {item.source === 'api' && (
                          <span className="health-pill" title="Notion didn't email this; found by searching Notion">
                            Not emailed
                          </span>
                        )}
                        {item.resolved && <span className="health-pill">Resolved</span>}
                      </span>
                    </>
                  )}
                </div>
                <span
                  className="pr-when"
                  title={item.dateIsApproximate ? 'Page last edited; the mention may be older' : undefined}
                >
                  {item.unread && <span className="notion-unread-dot" aria-label="Unread" />}
                  {item.dateIsApproximate ? '~' : ''}
                  {new Date(item.date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <footer className="report-method">
        <p>
          Built from Notion's notification emails in Superhuman, so it covers what your Notion email settings send:
          mentions, comments on pages you follow, invites, access requests and page-update digests. Unread is
          Superhuman's state when the snapshot was taken. Items marked "Not emailed" came from searching Notion directly
          for mentions and comments that never arrived as email. "Refresh from inbox" runs Claude in the background to pull
          new emails, which takes a few minutes.
        </p>
        {snapshot.notes.length > 0 && (
          <ul>
            {snapshot.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </footer>
    </div>
  );
}
