import { createFileRoute } from '@tanstack/react-router';
import { NotionInbox } from '../components/NotionInbox';
import { fetchNotionSnapshot } from '../lib/notion';

export const Route = createFileRoute('/notion')({
  loader: fetchNotionSnapshot,
  component: NotionPage,
});

function NotionPage() {
  const snapshot = Route.useLoaderData();
  if (!snapshot) {
    return (
      <div className="supercycle-page">
        <h1>Notion</h1>
        <p className="muted">No Notion snapshot yet. Ask Claude to collect your Notion mentions and comments.</p>
      </div>
    );
  }
  return <NotionInbox snapshot={snapshot} />;
}
