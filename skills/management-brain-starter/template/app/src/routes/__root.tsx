import { Link, Outlet, createRootRoute } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">%%APP_TITLE%%</span>
        <nav>
          <Link to="/" activeOptions={{ exact: true }}>
            Matrix
          </Link>
          <Link to="/todos">To-dos</Link>
          <Link to="/team">Team</Link>
          <Link to="/supercycle">Supercycle</Link>
          <Link to="/prs">PRs</Link>
          <Link to="/notion">Notion</Link>
          <Link to="/debriefs">Debriefs</Link>
          <Link to="/reports">Reports</Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
