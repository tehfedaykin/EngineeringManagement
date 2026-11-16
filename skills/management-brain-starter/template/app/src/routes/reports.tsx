import { Link, Outlet, createFileRoute } from '@tanstack/react-router';
import { fetchReports } from '../lib/reports';

export const Route = createFileRoute('/reports')({
  loader: fetchReports,
  component: ReportsLayout,
});

function ReportsLayout() {
  const reports = Route.useLoaderData();
  return (
    <div className="debriefs">
      <aside className="brief-list">
        <h2>Reports</h2>
        {reports.length === 0 && <p className="muted">No reports yet.</p>}
        <ul>
          {reports.map((report) => (
            <li key={report.id}>
              <Link to="/reports/$id" params={{ id: report.id }}>
                <span className="brief-date">{report.title}</span>
                <span className="brief-title">
                  {new Date(report.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <section className="brief-view">
        <Outlet />
      </section>
    </div>
  );
}
