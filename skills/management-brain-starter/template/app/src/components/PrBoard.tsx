import { useState } from 'react';
import type { PrState, SupercyclePr, SupercyclePrData } from '../lib/api';

type Filter = 'all' | PrState;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  open: 'Open',
  inReview: 'In review',
  merged: 'Merged',
  closed: 'Closed',
};

const STATE_ORDER: Record<PrState, number> = { open: 0, draft: 1, closed: 2 };

interface Props {
  data: SupercyclePrData;
  onRefresh: () => void;
  refreshing: boolean;
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function matchesQuery(pr: SupercyclePr, query: string): boolean {
  if (!query) return true;
  const haystack = [
    pr.title,
    pr.repo,
    pr.branch,
    pr.author,
    pr.number?.toString(),
    ...pr.tickets.flatMap((t) => [t.identifier, t.assignee]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function PrBoard({ data, onRefresh, refreshing }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  if (!data.supercycle) {
    return <p className="muted">There's no Active "Supercycle N" initiative in Linear right now.</p>;
  }

  const allPrs = data.projects.flatMap((p) => p.prs);
  const counts: Record<Filter, number> = {
    all: allPrs.length,
    draft: allPrs.filter((pr) => pr.state === 'draft').length,
    open: allPrs.filter((pr) => pr.state === 'open').length,
    closed: allPrs.filter((pr) => pr.state === 'closed').length,
  };

  const sections = data.projects.map((project) => ({
    project,
    prs: project.prs
      .filter((pr) => (filter === 'all' || pr.state === filter) && matchesQuery(pr, query.trim()))
      .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')),
  }));
  const withPrs = sections.filter((s) => s.prs.length > 0);
  const projectsWithoutAnyPrs = data.projects.filter((p) => p.prs.length === 0);

  return (
    <div className="supercycle-page prs-page">
      <header className="supercycle-header">
        <div>
          <h1>PRs</h1>
          <p className="muted">
            {data.teamKey} projects in {data.supercycle.name} · PRs linked to their Linear tickets ·{' '}
            <a href={data.supercycle.url} target="_blank" rel="noreferrer">
              Open in Linear ↗
            </a>
          </p>
        </div>
        <button type="button" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <div className="pr-toolbar">
        <div className="filters" role="group" aria-label="Filter PRs by state">
          {FILTERS.map(({ value, label }) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {label} ({counts[value]})
            </button>
          ))}
        </div>
        <input
          type="search"
          className="pr-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title, ticket, repo, person…"
          aria-label="Search PRs"
        />
      </div>

      {withPrs.length === 0 && <p className="muted">No PRs match.</p>}

      {withPrs.map(({ project, prs }) => (
        <section key={project.id} className="pr-project">
          <header className="pr-project-header">
            <h2>
              <a href={project.url} target="_blank" rel="noreferrer">
                {project.name}
              </a>
            </h2>
            <span className="gantt-meta">
              <span className="status-pill">
                <span className="status-dot" style={{ background: project.status.color }} />
                {project.status.name}
              </span>
              {project.lead && <span>{project.lead}</span>}
              <span>
                {prs.length} PR{prs.length === 1 ? '' : 's'}
              </span>
            </span>
          </header>
          <ul className="pr-list">
            {prs.map((pr) => (
              <PrRow key={pr.url} pr={pr} />
            ))}
          </ul>
        </section>
      ))}

      {projectsWithoutAnyPrs.length > 0 && (
        <section className="unscheduled">
          <h2>No linked PRs yet</h2>
          <ul>
            {projectsWithoutAnyPrs.map((project) => (
              <li key={project.id}>
                <a href={project.url} target="_blank" rel="noreferrer">
                  {project.name}
                </a>{' '}
                <span className="muted">· {project.status.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PrRow({ pr }: { pr: SupercyclePr }) {
  const people = pr.author ?? pr.tickets.find((t) => t.assignee)?.assignee ?? null;
  const when = pr.state === 'closed' ? (pr.mergedAt ?? pr.closedAt) : pr.updatedAt;
  return (
    <li className={`pr-row pr-${pr.status}`}>
      <span className={`pr-status pr-status-${pr.status}`}>{STATUS_LABELS[pr.status] ?? pr.status}</span>
      <div className="pr-main">
        <a href={pr.url} target="_blank" rel="noreferrer" className="pr-title">
          {pr.title}
        </a>
        <span className="gantt-meta">
          {pr.tickets.map((ticket) => (
            <a key={ticket.identifier} href={ticket.url} target="_blank" rel="noreferrer" className="ticket-pill" title={ticket.title}>
              {ticket.identifier}
            </a>
          ))}
          {pr.repo && (
            <span>
              {pr.repo.replace(/^%%GITHUB_ORG%%\//, '')}#{pr.number}
            </span>
          )}
          {people && <span title={pr.author ? 'PR author' : 'Ticket assignee'}>{pr.author ? `@${pr.author}` : people}</span>}
          {pr.review === 'approved' && <span className="health-pill health-onTrack">Approved</span>}
          {pr.review === 'changesRequested' && <span className="health-pill health-offTrack">Changes requested</span>}
          {pr.hasConflicts && pr.state !== 'closed' && <span className="health-pill health-atRisk">Conflicts</span>}
        </span>
      </div>
      <span className="pr-when" title={when ?? undefined}>
        {pr.state === 'closed' ? (pr.status === 'merged' ? 'merged ' : 'closed ') : 'updated '}
        {relativeTime(when)}
      </span>
    </li>
  );
}
