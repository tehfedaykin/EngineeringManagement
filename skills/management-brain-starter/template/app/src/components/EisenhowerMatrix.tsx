import { useState, type DragEvent, type FormEvent } from 'react';
import type { Commitment, MatrixState, Quadrant } from '../lib/api';
import { QUADRANT_LABELS, isQuadrant, useTodos } from '../lib/useTodos';
import { CompleteCheckbox, formatCompletedAt } from './CompleteCheckbox';

const QUADRANTS: { id: Exclude<Quadrant, 'inbox' | 'monitor'>; title: string; subtitle: string }[] = [
  { id: 'do', title: 'Do', subtitle: 'Urgent · Important' },
  { id: 'schedule', title: 'Schedule', subtitle: 'Not urgent · Important' },
  { id: 'delegate', title: 'Delegate', subtitle: 'Urgent · Not important' },
  { id: 'drop', title: 'Drop', subtitle: 'Not urgent · Not important' },
];

interface Props {
  commitments: Commitment[];
  initialState: MatrixState;
}

export function EisenhowerMatrix({ commitments, initialState }: Props) {
  const { items, saveError, setComplete, moveItem, addCustomItem, removeCustomItem } = useTodos(
    commitments,
    initialState,
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hovered, setHovered] = useState<Quadrant | null>(null);
  const [draft, setDraft] = useState('');

  const openItems = items.filter((item) => item.completedAt === null);
  const completedItems = items
    .filter((item) => item.completedAt !== null)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));

  function submitDraft(event: FormEvent) {
    event.preventDefault();
    const statement = draft.trim();
    if (!statement) return;
    addCustomItem(statement);
    setDraft('');
  }

  function dropProps(quadrant: Quadrant) {
    return {
      onDragOver: (event: DragEvent) => {
        event.preventDefault();
        setHovered(quadrant);
      },
      onDragLeave: () => setHovered((current) => (current === quadrant ? null : current)),
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        const id = event.dataTransfer.getData('text/plain');
        if (id) moveItem(id, quadrant);
        setHovered(null);
        setDraggingId(null);
      },
    };
  }

  function renderItems(quadrant: Quadrant) {
    const inQuadrant = openItems.filter((item) => item.quadrant === quadrant);
    if (inQuadrant.length === 0) return <p className="empty">Drop items here</p>;
    return (
      <ul className="cards">
        {inQuadrant.map((item) => (
          <li
            key={item.id}
            className={`card${draggingId === item.id ? ' dragging' : ''}`}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('text/plain', item.id);
              event.dataTransfer.effectAllowed = 'move';
              setDraggingId(item.id);
            }}
            onDragEnd={() => setDraggingId(null)}
          >
            <span className="card-text">
              <CompleteCheckbox item={item} onChange={(complete) => setComplete(item.id, complete)} />
              <span>{item.statement}</span>
            </span>
            <span className="card-footer">
              <span className="card-meta">
                {item.custom ? 'manual' : item.id}
                {item.meta ? ` · ${item.meta}` : ''}
              </span>
              <select
                aria-label={`Move "${item.statement}"`}
                value={quadrant}
                onChange={(event) => {
                  if (isQuadrant(event.target.value)) moveItem(item.id, event.target.value);
                }}
              >
                {Object.entries(QUADRANT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {item.custom && (
                <button type="button" className="link" onClick={() => removeCustomItem(item.id)}>
                  Remove
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="matrix-page">
      <section className={`inbox${hovered === 'inbox' ? ' hovered' : ''}`} {...dropProps('inbox')}>
        <h2>Unsorted</h2>
        <form className="add-item" onSubmit={submitDraft}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add a to-do…"
            aria-label="New to-do"
          />
          <button type="submit">Add</button>
        </form>
        {renderItems('inbox')}
        {saveError && <p className="error">{saveError}</p>}
        {completedItems.length > 0 && (
          <details className="completed">
            <summary>Completed ({completedItems.length})</summary>
            <ul className="cards">
              {completedItems.map((item) => (
                <li key={item.id} className="card done">
                  <span className="card-text">
                    <CompleteCheckbox item={item} onChange={(complete) => setComplete(item.id, complete)} />
                    <span>{item.statement}</span>
                  </span>
                  <span className="card-meta">Done {formatCompletedAt(item.completedAt ?? '')}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <div className="matrix">
        <div className="axis axis-top">
          <span>Urgent</span>
          <span>Not urgent</span>
        </div>
        {QUADRANTS.map((q) => (
          <section
            key={q.id}
            className={`quadrant q-${q.id}${hovered === q.id ? ' hovered' : ''}`}
            {...dropProps(q.id)}
          >
            <header>
              <h2>{q.title}</h2>
              <span className="muted">{q.subtitle}</span>
            </header>
            {renderItems(q.id)}
          </section>
        ))}
        <section className={`quadrant q-monitor${hovered === 'monitor' ? ' hovered' : ''}`} {...dropProps('monitor')}>
          <header>
            <h2>Monitor</h2>
            <span className="muted">In progress · Not done yet</span>
          </header>
          {renderItems('monitor')}
        </section>
      </div>
    </div>
  );
}
