import { useEffect, useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { fetchNotionRefreshStatus, startNotionRefresh, type NotionRefreshStatus } from '../lib/notion';

const POLL_MS = 3000;

export function NotionRefreshButton() {
  const router = useRouter();
  const [status, setStatus] = useState<NotionRefreshStatus | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const running = status?.state === 'running';

  // Picks up a refresh that's already running, e.g. one started before a page reload.
  useEffect(() => {
    fetchNotionRefreshStatus().then(setStatus, () => undefined);
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      try {
        const next = await fetchNotionRefreshStatus();
        setStatus(next);
        if (next.state === 'done') await router.invalidate();
      } catch (error) {
        setRequestError(error instanceof Error ? error.message : String(error));
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [running, router]);

  async function onClick() {
    setRequestError(null);
    try {
      setStatus(await startNotionRefresh());
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : String(error));
    }
  }

  const message =
    requestError ??
    (running
      ? `Refreshing from your inbox… started ${new Date(status.startedAt ?? Date.now()).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}. This takes a few minutes.`
      : status?.state === 'done' || status?.state === 'error'
        ? status.summary
        : null);

  return (
    <div className="notion-refresh">
      <button type="button" onClick={onClick} disabled={running} aria-busy={running}>
        {running ? 'Refreshing…' : 'Refresh from inbox'}
      </button>
      {message && (
        <p className={`notion-refresh-status${status?.state === 'error' || requestError ? ' error' : ''}`} role="status">
          {message}
        </p>
      )}
    </div>
  );
}
