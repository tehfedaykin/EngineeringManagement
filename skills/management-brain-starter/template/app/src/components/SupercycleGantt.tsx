import { useState, type CSSProperties } from 'react';
import type { SupercycleData, SupercycleMilestone, SupercycleProject } from '../lib/api';
import { formatDay, toDay, todayDay } from '../lib/dates';

/** A supercycle is 8 weeks: 6 build weeks then 2 cooldown weeks, ending on its initiative's target date. */
const SUPERCYCLE_DAYS = 56;
const BUILD_DAYS = 42;

const HEALTH_LABELS: Record<string, string> = {
  onTrack: 'On track',
  atRisk: 'At risk',
  offTrack: 'Off track',
};

interface Props {
  data: SupercycleData;
  onRefresh: () => void;
  refreshing: boolean;
}

interface Week {
  start: number;
  label: string;
  cooldown: boolean;
}

function hasDates(project: SupercycleProject): project is SupercycleProject & { startDate: string; targetDate: string } {
  return project.startDate !== null && project.targetDate !== null;
}

export function SupercycleGantt({ data, onRefresh, refreshing }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { supercycle, projects } = data;

  if (!supercycle) {
    return <p className="muted">There's no Active "Supercycle N" initiative in Linear right now.</p>;
  }

  const scheduled = projects
    .filter(hasDates)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));
  const unscheduled = projects.filter((p) => !hasDates(p));

  // The initiative's target date is the Monday that ends cooldown; the cycle starts on the Tuesday 8 weeks earlier.
  const scEnd = supercycle.targetDate ? toDay(supercycle.targetDate) + 1 : todayDay() + SUPERCYCLE_DAYS;
  const scStart = scEnd - SUPERCYCLE_DAYS;
  // Snap the visible range to whole weeks aligned with the supercycle's Tuesdays.
  const earliest = Math.min(scStart, ...scheduled.map((p) => toDay(p.startDate)));
  const latest = Math.max(scEnd, ...scheduled.map((p) => toDay(p.targetDate) + 1));
  const rangeStart = scStart - Math.ceil((scStart - earliest) / 7) * 7;
  const rangeEnd = scEnd + Math.ceil((latest - scEnd) / 7) * 7;
  const totalDays = rangeEnd - rangeStart;
  const pct = (day: number) => `${((day - rangeStart) / totalDays) * 100}%`;

  const weeks: Week[] = [];
  for (let start = rangeStart; start < rangeEnd; start += 7) {
    const index = Math.floor((start - scStart) / 7);
    const label =
      index < 0 || start >= scEnd ? '' : index < BUILD_DAYS / 7 ? `Wk ${index + 1}` : `Cooldown ${index - 5}`;
    weeks.push({ start, label, cooldown: start >= scStart + BUILD_DAYS && start < scEnd });
  }

  const today = todayDay();
  const showToday = today >= rangeStart && today < rangeEnd;

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function gridBackground() {
    return (
      <div className="gantt-grid" aria-hidden="true">
        {weeks.map((week) => (
          <div
            key={week.start}
            className={`gantt-grid-week${week.cooldown ? ' cooldown' : ''}`}
            style={{ left: pct(week.start), width: pct(rangeStart + 7) }}
          />
        ))}
        {showToday && <div className="gantt-today" style={{ left: pct(today + 0.5) }} />}
      </div>
    );
  }

  function milestoneMarker(milestone: SupercycleMilestone, project: SupercycleProject) {
    if (!milestone.targetDate) return null;
    const day = toDay(milestone.targetDate);
    const done = milestone.progress >= 1;
    const late = !done && day < today;
    return (
      <span
        key={milestone.id}
        className={`gantt-milestone${done ? ' done' : ''}${late ? ' late' : ''}`}
        style={{ left: pct(day + 0.5) }}
        title={`${milestone.name} · ${formatDay(day)} · ${Math.round(milestone.progress * 100)}%`}
        aria-label={`${project.name} milestone: ${milestone.name}, due ${formatDay(day)}, ${Math.round(milestone.progress * 100)}% done`}
      />
    );
  }

  return (
    <div className="supercycle-page">
      <header className="supercycle-header">
        <div>
          <h1>{supercycle.name}</h1>
          <p className="muted">
            {formatDay(scStart)} – {formatDay(scEnd - 1, { month: 'short', day: 'numeric', year: 'numeric' })} ·{' '}
            {data.teamKey} projects · cooldown from {formatDay(scStart + BUILD_DAYS)} ·{' '}
            <a href={supercycle.url} target="_blank" rel="noreferrer">
              Open in Linear ↗
            </a>
          </p>
        </div>
        <button type="button" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <div className="gantt" role="table" aria-label={`${supercycle.name} project timeline`}>
        <div className="gantt-row gantt-head" role="row">
          <div className="gantt-label" role="columnheader">
            Project
          </div>
          <div className="gantt-track" role="columnheader">
            {weeks.map((week) => (
              <div
                key={week.start}
                className={`gantt-week-label${week.cooldown ? ' cooldown' : ''}`}
                style={{ left: pct(week.start), width: pct(rangeStart + 7) }}
              >
                <strong>{week.label}</strong>
                <span>{formatDay(week.start)}</span>
              </div>
            ))}
          </div>
        </div>

        {scheduled.map((project) => {
          const start = toDay(project.startDate);
          const end = toDay(project.targetDate) + 1;
          const isOpen = expanded.has(project.id);
          const barStyle: CSSProperties = { left: pct(start), width: `${((end - start) / totalDays) * 100}%` };
          return (
            <div key={project.id} className="gantt-group" role="rowgroup">
              <div className="gantt-row" role="row">
                <div className="gantt-label" role="rowheader">
                  <button
                    type="button"
                    className="gantt-toggle"
                    onClick={() => toggle(project.id)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? 'Hide' : 'Show'} milestones for ${project.name}`}
                    disabled={project.milestones.length === 0}
                  >
                    {project.milestones.length === 0 ? '·' : isOpen ? '−' : '+'}
                  </button>
                  <div className="gantt-project">
                    <a href={project.url} target="_blank" rel="noreferrer" className="gantt-name">
                      {project.name}
                    </a>
                    <span className="gantt-meta">
                      <span className="status-pill">
                        <span className="status-dot" style={{ background: project.status.color }} />
                        {project.status.name}
                      </span>
                      <span className="progress-pill">{Math.round(project.progress * 100)}%</span>
                      {project.health && (
                        <span className={`health-pill health-${project.health}`}>
                          {HEALTH_LABELS[project.health] ?? project.health}
                        </span>
                      )}
                      {project.lead && <span>{project.lead}</span>}
                    </span>
                  </div>
                </div>
                <div className="gantt-track" role="cell">
                  {gridBackground()}
                  <div
                    className={`gantt-bar status-${project.status.type}`}
                    style={barStyle}
                    title={`${project.name} · ${formatDay(start)} → ${formatDay(end - 1)} · ${Math.round(project.progress * 100)}%`}
                  >
                    <span className="gantt-bar-fill" style={{ width: `${project.progress * 100}%` }} />
                  </div>
                  {project.milestones.map((m) => milestoneMarker(m, project))}
                </div>
              </div>

              {isOpen &&
                project.milestones.map((milestone) => (
                  <div key={milestone.id} className="gantt-row gantt-milestone-row" role="row">
                    <div className="gantt-label" role="rowheader">
                      <span className="gantt-milestone-name">
                        <span className={`milestone-icon${milestone.progress >= 1 ? ' done' : ''}`} aria-hidden="true">
                          ◆
                        </span>
                        {milestone.name}
                      </span>
                      <span className="gantt-meta">
                        {milestone.targetDate ? formatDay(toDay(milestone.targetDate)) : 'No date'} ·{' '}
                        {Math.round(milestone.progress * 100)}%
                      </span>
                    </div>
                    <div className="gantt-track" role="cell">
                      {gridBackground()}
                      {milestoneMarker(milestone, project)}
                    </div>
                  </div>
                ))}
            </div>
          );
        })}
      </div>

      {unscheduled.length > 0 && (
        <section className="unscheduled">
          <h2>No dates set</h2>
          <ul>
            {unscheduled.map((project) => (
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

      <p className="gantt-legend muted">
        <span className="legend-item"><span className="gantt-bar status-started legend-swatch" /> In progress</span>
        <span className="legend-item"><span className="gantt-bar status-planned legend-swatch" /> Planned</span>
        <span className="legend-item"><span className="gantt-bar status-completed legend-swatch" /> Completed</span>
        <span className="legend-item"><span className="gantt-milestone legend-diamond" /> Milestone</span>
        <span className="legend-item"><span className="gantt-milestone done legend-diamond" /> Done</span>
        <span className="legend-item"><span className="gantt-milestone late legend-diamond" /> Overdue</span>
        <span className="legend-item"><span className="legend-today" /> Today</span>
      </p>
    </div>
  );
}
