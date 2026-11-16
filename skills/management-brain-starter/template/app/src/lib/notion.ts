export type NotionNotificationKind = 'mention' | 'comment' | 'invite' | 'access_request' | 'digest';

export interface NotionDigestPage {
  title: string;
  icon: string | null;
  url: string | null;
  summary: string;
}

export interface NotionNotification {
  id: string;
  /** 'api' items are ones Notion never emailed, found by searching pages and comments. */
  source: 'email' | 'api';
  kind: NotionNotificationKind;
  date: string;
  /** Page mentions found through the API have no timestamp of their own, so they use the page's last-edited time. */
  dateIsApproximate?: boolean;
  /** Superhuman's unread state. Unknown for 'api' items. */
  unread?: boolean;
  author: string | null;
  otherAuthorsCount?: number;
  pageTitle: string;
  pageIcon?: string | null;
  pageUrl: string | null;
  path: string | null;
  snippet: string;
  /** The text a comment is attached to. */
  context?: string | null;
  resolved?: boolean;
  digestPages?: NotionDigestPage[];
}

export interface NotionSnapshot {
  fetchedAt: string;
  windowStart: string;
  windowEnd: string;
  notes: string[];
  items: NotionNotification[];
}

export interface NotionRefreshStatus {
  state: 'idle' | 'running' | 'done' | 'error';
  startedAt: string | null;
  finishedAt: string | null;
  summary: string | null;
}

export async function fetchNotionRefreshStatus(): Promise<NotionRefreshStatus> {
  const res = await fetch('/api/notion-notifications/refresh');
  if (!res.ok) throw new Error(`/api/notion-notifications/refresh returned ${res.status}`);
  return res.json() as Promise<NotionRefreshStatus>;
}

export async function startNotionRefresh(): Promise<NotionRefreshStatus> {
  const res = await fetch('/api/notion-notifications/refresh', { method: 'POST', headers: { 'X-Brain-Refresh': '1' } });
  if (!res.ok) throw new Error(`Starting the refresh returned ${res.status}`);
  return res.json() as Promise<NotionRefreshStatus>;
}

/** Resolves to null when no snapshot has been collected yet. */
export async function fetchNotionSnapshot(): Promise<NotionSnapshot | null> {
  const res = await fetch('/api/notion-notifications');
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`/api/notion-notifications returned ${res.status}`);
  return res.json() as Promise<NotionSnapshot>;
}
