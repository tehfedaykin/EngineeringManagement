export const MS_PER_DAY = 86_400_000;

/** Days since the epoch for a YYYY-MM-DD date, in UTC so time zones can't shift it. */
export function toDay(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

export function fromDay(day: number): Date {
  return new Date(day * MS_PER_DAY);
}

export function todayDay(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / MS_PER_DAY;
}

export function formatDay(day: number, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  return fromDay(day).toLocaleDateString(undefined, { ...options, timeZone: 'UTC' });
}
