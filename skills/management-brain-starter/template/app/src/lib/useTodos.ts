import { useState } from 'react';
import { saveMatrix, type Commitment, type MatrixState, type Quadrant } from './api';

export const QUADRANT_LABELS: Record<Quadrant, string> = {
  inbox: 'Unsorted',
  do: 'Do',
  schedule: 'Schedule',
  delegate: 'Delegate',
  drop: 'Drop',
  monitor: 'Monitor',
};

export function isQuadrant(value: string): value is Quadrant {
  return value in QUADRANT_LABELS;
}

export interface TodoItem {
  id: string;
  statement: string;
  meta: string | null;
  custom: boolean;
  quadrant: Quadrant;
  /** ISO timestamp or date it was completed; null while open. */
  completedAt: string | null;
}

export function useTodos(commitments: Commitment[], initialState: MatrixState) {
  const [state, setState] = useState(initialState);
  const [saveError, setSaveError] = useState<string | null>(null);

  function completedAt(id: string, ledgerCompletedAt: string | null): string | null {
    if (state.completed[id]) return state.completed[id];
    if (ledgerCompletedAt && !state.reopened.includes(id)) return ledgerCompletedAt;
    return null;
  }

  const items: TodoItem[] = [
    ...commitments.map((c) => ({
      id: c.id,
      statement: c.statement,
      meta:
        [c.status !== 'open' && c.status !== 'completed' ? c.status : null, c.due ? `due ${c.due}` : null]
          .filter(Boolean)
          .join(' · ') || null,
      custom: false,
      quadrant: state.placements[c.id] ?? 'inbox',
      completedAt: completedAt(c.id, c.completedAt),
    })),
    ...state.customItems.map((c) => ({
      id: c.id,
      statement: c.statement,
      meta: null,
      custom: true,
      quadrant: state.placements[c.id] ?? 'inbox',
      completedAt: completedAt(c.id, null),
    })),
  ];

  const ledgerCompleted = new Set(
    commitments.filter((c) => c.completedAt).map((c) => c.id),
  );

  function update(next: MatrixState) {
    setState(next);
    setSaveError(null);
    saveMatrix(next).catch((error: unknown) =>
      setSaveError(error instanceof Error ? error.message : 'Saving failed'),
    );
  }

  function setComplete(id: string, complete: boolean) {
    const { [id]: _previous, ...completed } = state.completed;
    const reopened = state.reopened.filter((reopenedId) => reopenedId !== id);
    if (complete) {
      update({ ...state, completed: { ...completed, [id]: new Date().toISOString() }, reopened });
    } else {
      update({
        ...state,
        completed,
        reopened: ledgerCompleted.has(id) ? [...reopened, id] : reopened,
      });
    }
  }

  function moveItem(id: string, quadrant: Quadrant) {
    update({ ...state, placements: { ...state.placements, [id]: quadrant } });
  }

  function addCustomItem(statement: string) {
    const item = { id: `M-${crypto.randomUUID()}`, statement, createdAt: new Date().toISOString() };
    update({ ...state, customItems: [...state.customItems, item] });
  }

  function removeCustomItem(id: string) {
    const { [id]: _removedPlacement, ...placements } = state.placements;
    const { [id]: _removedCompletion, ...completed } = state.completed;
    update({
      ...state,
      placements,
      completed,
      customItems: state.customItems.filter((item) => item.id !== id),
    });
  }

  return { items, saveError, setComplete, moveItem, addCustomItem, removeCustomItem };
}
