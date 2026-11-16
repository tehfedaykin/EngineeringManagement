import { createFileRoute } from '@tanstack/react-router';
import { ReportView } from '../components/ReportView';
import { fetchReport } from '../lib/reports';

export const Route = createFileRoute('/reports/$id')({
  loader: ({ params }) => fetchReport(params.id),
  errorComponent: () => <p className="muted">That report couldn't be loaded.</p>,
  component: ReportPage,
});

function ReportPage() {
  return <ReportView report={Route.useLoaderData()} />;
}
