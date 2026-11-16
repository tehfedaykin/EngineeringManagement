import type { TodoItem } from '../lib/useTodos';

interface Props {
  item: TodoItem;
  onChange: (complete: boolean) => void;
}

export function CompleteCheckbox({ item, onChange }: Props) {
  const complete = item.completedAt !== null;
  return (
    <input
      type="checkbox"
      className="complete-checkbox"
      checked={complete}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={`Mark "${item.statement}" ${complete ? 'not complete' : 'complete'}`}
    />
  );
}

export function formatCompletedAt(completedAt: string): string {
  // Ledger dates are plain YYYY-MM-DD; parsing them as UTC would shift the day back.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(completedAt)
    ? new Date(`${completedAt}T00:00:00`)
    : new Date(completedAt);
  return date.toLocaleDateString();
}
