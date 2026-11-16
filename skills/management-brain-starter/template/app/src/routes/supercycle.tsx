import { createFileRoute } from '@tanstack/react-router';
import { SupercycleGantt } from '../components/SupercycleGantt';
import { fetchSupercycleData } from '../lib/api';
import { useRefresh } from '../lib/useRefresh';

export const Route = createFileRoute('/supercycle')({
  loader: fetchSupercycleData,
  // Linear data changes slowly; don't refetch on every visit to the page.
  staleTime: 5 * 60_000,
  errorComponent: ({ error }) => (
    <div className="supercycle-page">
      <h1>Supercycle</h1>
      <p className="error">
        Couldn't load projects from Linear: {error instanceof Error ? error.message : String(error)}
      </p>
    </div>
  ),
  component: SupercyclePage,
});

function SupercyclePage() {
  const data = Route.useLoaderData();
  const { refresh, refreshing } = useRefresh();
  return <SupercycleGantt data={data} onRefresh={refresh} refreshing={refreshing} />;
}
