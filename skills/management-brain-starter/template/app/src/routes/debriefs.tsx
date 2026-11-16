import { Link, Outlet, createFileRoute } from '@tanstack/react-router';
import { fetchBriefs } from '../lib/api';

export const Route = createFileRoute('/debriefs')({
  loader: () => fetchBriefs(),
  component: DebriefsLayout,
});

function DebriefsLayout() {
  const briefs = Route.useLoaderData();
  return (
    <div className="debriefs">
      <aside className="brief-list">
        <h2>Daily debriefs</h2>
        {briefs.length === 0 && <p className="muted">No debriefs yet.</p>}
        <ul>
          {briefs.map((brief) => (
            <li key={brief.date}>
              <Link to="/debriefs/$date" params={{ date: brief.date }}>
                <span className="brief-date">{brief.date}</span>
                <span className="brief-title">{brief.title}</span>
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
