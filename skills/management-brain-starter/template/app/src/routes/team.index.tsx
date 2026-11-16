import { Link, createFileRoute } from '@tanstack/react-router';
import { fetchTeam, initials, tenure } from '../lib/team';

export const Route = createFileRoute('/team/')({
  loader: fetchTeam,
  component: TeamPage,
});

function TeamPage() {
  const team = Route.useLoaderData();
  return (
    <div className="supercycle-page">
      <header className="supercycle-header">
        <div>
          <h1>Team</h1>
          <p className="muted">%%TEAM_NAME%% · {team.length} people</p>
        </div>
      </header>
      <ul className="team-grid">
        {team.map((member) => {
          const lastNote = member.notes.reduce<string | null>(
            (latest, note) => (!latest || note.createdAt > latest ? note.createdAt : latest),
            null,
          );
          return (
            <li key={member.id}>
              <Link to="/team/$memberId" params={{ memberId: member.id }} className="team-card">
                <span className="team-avatar" aria-hidden="true">
                  {initials(member.name)}
                </span>
                <span className="team-card-body">
                  <span className="team-name">{member.name}</span>
                  <span className="team-title">{member.title}</span>
                  <span className="gantt-meta">
                    <span>{member.startDate ? `${tenure(member.startDate)} at %%COMPANY%%` : 'Start date not set'}</span>
                    <span>
                      {member.notes.length} note{member.notes.length === 1 ? '' : 's'}
                      {lastNote &&
                        ` · last ${new Date(lastNote).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
