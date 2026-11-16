import { useState } from 'react';
import type { Commitment, MatrixState } from '../lib/api';
import { QUADRANT_LABELS, useTodos, type TodoItem } from '../lib/useTodos';
import { CompleteCheckbox, formatCompletedAt } from './CompleteCheckbox';

type Filter = 'all' | 'open' | 'completed';

interface Props {
  commitments: Commitment[];
  initialState: MatrixState;
}

export function TodoList({ commitments, initialState }: Props) {
  const { items, saveError, setComplete } = useTodos(commitments, initialState);
  const [filter, setFilter] = useState<Filter>('all');

  const open = items.filter((item) => item.completedAt === null);
  const completed = items
    .filter((item) => item.completedAt !== null)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));

  function renderRow(item: TodoItem) {
    return (
      <li key={item.id} className={`todo-row${item.completedAt ? ' done' : ''}`}>
        <CompleteCheckbox item={item} onChange={(complete) => setComplete(item.id, complete)} />
        <span className="todo-text">{item.statement}</span>
        <span className="todo-meta">
          {item.completedAt
            ? `Done ${formatCompletedAt(item.completedAt)}`
            : QUADRANT_LABELS[item.quadrant]}
          {' · '}
          {item.custom ? 'manual' : item.id}
          {item.meta ? ` · ${item.meta}` : ''}
        </span>
      </li>
    );
  }

  return (
    <div className="todo-page">
      <header className="todo-header">
        <h1>All to-dos</h1>
        <div className="filters" role="group" aria-label="Filter to-dos">
          {(['all', 'open', 'completed'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === 'all' ? `All (${items.length})` : value === 'open' ? `Open (${open.length})` : `Completed (${completed.length})`}
            </button>
          ))}
        </div>
      </header>
      {saveError && <p className="error">{saveError}</p>}

      {filter !== 'completed' && (
        <section>
          <h2>Open</h2>
          {open.length === 0 ? <p className="muted">Nothing open.</p> : <ul className="todo-list">{open.map(renderRow)}</ul>}
        </section>
      )}
      {filter !== 'open' && (
        <section>
          <h2>Completed</h2>
          {completed.length === 0 ? (
            <p className="muted">Nothing completed yet.</p>
          ) : (
            <ul className="todo-list">{completed.map(renderRow)}</ul>
          )}
        </section>
      )}
    </div>
  );
}
