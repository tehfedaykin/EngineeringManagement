import { MS_PER_DAY, todayDay, toDay } from './dates';

export interface TeamNote {
  id: string;
  createdAt: string;
  updatedAt?: string;
  /** Markdown. Links, including Slack permalinks, live inline in the text. */
  text: string;
}

export interface TeamMember {
  id: string;
  name: string;
  title: string;
  /** YYYY-MM-DD, or null until it's filled in. */
  startDate: string | null;
  /** Markdown. */
  careerGoals: string;
  notes: TeamNote[];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchTeam = () => getJson<TeamMember[]>('/api/team');
export const fetchTeamMember = (id: string) => getJson<TeamMember>(`/api/team/${id}`);

export async function saveTeamMember(member: TeamMember): Promise<void> {
  const res = await fetch(`/api/team/${member.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(member),
  });
  if (!res.ok) throw new Error(`Saving ${member.name} failed with ${res.status}`);
}

export function tenure(startDate: string): string {
  const days = todayDay() - toDay(startDate);
  if (days < 0) return 'starts soon';
  const months = Math.floor(days / 30.4375);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0 && rest === 0) return `${days} day${days === 1 ? '' : 's'}`;
  const parts = [];
  if (years > 0) parts.push(`${years} yr${years === 1 ? '' : 's'}`);
  if (rest > 0) parts.push(`${rest} mo${rest === 1 ? '' : 's'}`);
  return parts.join(' ');
}

export function formatStartDate(startDate: string): string {
  return new Date(toDay(startDate) * MS_PER_DAY).toLocaleDateString(undefined, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
}

export interface SlackLink {
  url: string;
  /** When the linked message was posted, read from the permalink's p<timestamp>. */
  postedAt: Date | null;
}

const SLACK_URL = /https:\/\/[\w-]+\.slack\.com\/archives\/[\w-]+\/p(\d{10})(\d{6})\S*/g;

export function slackLinks(text: string): SlackLink[] {
  return [...text.matchAll(SLACK_URL)].map((match) => ({
    url: match[0].replace(/[)>.,]+$/, ''),
    postedAt: new Date(Number(match[1]) * 1000),
  }));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
