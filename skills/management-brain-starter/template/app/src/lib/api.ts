/** 'monitor' sits outside the urgent/important grid: things in progress that need watching until they're done. */
export type Quadrant = 'do' | 'schedule' | 'delegate' | 'drop' | 'monitor' | 'inbox';

export interface Commitment {
  id: string;
  statement: string;
  due: string | null;
  status: string;
  source: string | null;
  firstSeen: string | null;
  /** Set when the debrief ledger itself marked the commitment completed. */
  completedAt: string | null;
}

export interface CustomItem {
  id: string;
  statement: string;
  createdAt: string;
}

export interface MatrixState {
  placements: Record<string, Quadrant>;
  customItems: CustomItem[];
  /** Item id → ISO timestamp it was marked complete in this app. */
  completed: Record<string, string>;
  /** Ids the ledger marked completed that were reopened in this app. */
  reopened: string[];
}

export interface BriefSummary {
  date: string;
  title: string;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchCommitments = () => getJson<Commitment[]>('/api/commitments');
export const fetchBriefs = () => getJson<BriefSummary[]>('/api/briefs');
export const fetchBrief = (date: string) =>
  getJson<{ date: string; markdown: string }>(`/api/briefs/${date}`);

export async function fetchMatrix(): Promise<MatrixState> {
  // Older matrix.json files are missing the keys added later.
  const saved = await getJson<Partial<MatrixState>>('/api/matrix');
  return {
    placements: saved.placements ?? {},
    customItems: saved.customItems ?? [],
    completed: saved.completed ?? {},
    reopened: saved.reopened ?? [],
  };
}

export async function loadTodoData() {
  const [commitments, matrix] = await Promise.all([fetchCommitments(), fetchMatrix()]);
  return { commitments, matrix };
}

export async function saveMatrix(state: MatrixState): Promise<void> {
  const res = await fetch('/api/matrix', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error(`Saving the matrix failed with ${res.status}`);
}

export interface SupercycleMilestone {
  id: string;
  name: string;
  targetDate: string | null;
  /** 0–1 */
  progress: number;
}

export interface SupercycleProject {
  id: string;
  name: string;
  url: string;
  color: string;
  startDate: string | null;
  targetDate: string | null;
  /** 0–1 */
  progress: number;
  health: 'onTrack' | 'atRisk' | 'offTrack' | null;
  priority: string;
  status: { name: string; type: string; color: string };
  lead: string | null;
  teams: string[];
  milestones: SupercycleMilestone[];
}

export interface SupercycleData {
  supercycle: { id: string; name: string; url: string; status: string; targetDate: string | null } | null;
  teamKey: string;
  projects: SupercycleProject[];
}

export async function fetchSupercycleData(): Promise<SupercycleData> {
  const res = await fetch('/api/supercycle');
  const body = (await res.json()) as SupercycleData | { error: string };
  if ('error' in body) throw new Error(body.error);
  return body;
}

export type PrState = 'draft' | 'open' | 'closed';

export interface SupercyclePr {
  url: string;
  number: number | null;
  title: string;
  repo: string | null;
  branch: string | null;
  author: string | null;
  /** Linear's GitHub status: draft, open, inReview, merged or closed. */
  status: string;
  state: PrState;
  createdAt: string | null;
  updatedAt: string | null;
  mergedAt: string | null;
  closedAt: string | null;
  hasConflicts: boolean;
  review: 'approved' | 'changesRequested' | null;
  tickets: { identifier: string; title: string; url: string; assignee: string | null }[];
}

export interface SupercyclePrData {
  supercycle: { id: string; name: string; url: string } | null;
  teamKey: string;
  projects: {
    id: string;
    name: string;
    url: string;
    status: { name: string; type: string; color: string };
    lead: string | null;
    prs: SupercyclePr[];
  }[];
}

export async function fetchSupercyclePrData(): Promise<SupercyclePrData> {
  const res = await fetch('/api/supercycle/prs');
  const body = (await res.json()) as SupercyclePrData | { error: string };
  if ('error' in body) throw new Error(body.error);
  return body;
}
