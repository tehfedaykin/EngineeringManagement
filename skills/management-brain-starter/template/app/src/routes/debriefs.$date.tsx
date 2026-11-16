import { createFileRoute } from '@tanstack/react-router';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchBrief } from '../lib/api';

export const Route = createFileRoute('/debriefs/$date')({
  loader: ({ params }) => fetchBrief(params.date),
  errorComponent: () => <p className="muted">That debrief couldn't be loaded.</p>,
  component: BriefPage,
});

function BriefPage() {
  const { markdown } = Route.useLoaderData();
  return (
    <article className="markdown">
      <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
    </article>
  );
}
