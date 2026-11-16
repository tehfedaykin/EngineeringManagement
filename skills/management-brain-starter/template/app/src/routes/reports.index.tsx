import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/reports/')({
  component: () => <p className="muted">Pick a report to read it.</p>,
});
