import { createFileRoute } from '@tanstack/react-router';
import { PrBoard } from '../components/PrBoard';
import { fetchSupercyclePrData } from '../lib/api';
import { useRefresh } from '../lib/useRefresh';

export const Route = createFileRoute('/prs')({
  loader: fetchSupercyclePrData,
  staleTime: 5 * 60_000,
  errorComponent: ({ error }) => (
    <div className="supercycle-page">
      <h1>PRs</h1>
      <p className="error">
        Couldn't load PRs from Linear: {error instanceof Error ? error.message : String(error)}
      </p>
    </div>
  ),
  component: PrsPage,
});

function PrsPage() {
  const data = Route.useLoaderData();
  const { refresh, refreshing } = useRefresh();
  return <PrBoard data={data} onRefresh={refresh} refreshing={refreshing} />;
}
