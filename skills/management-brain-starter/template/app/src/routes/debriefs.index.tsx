import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/debriefs/')({
  component: () => <p className="muted">Pick a debrief to read it.</p>,
});
