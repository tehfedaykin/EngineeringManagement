/**
 * A report is a JSON file in data/reports/<id>.json. Reports are generated outside the app
 * (e.g. by Claude from Slack or Linear data) and the app only renders them, so the format is a
 * list of generic blocks rather than anything report-specific.
 */
export interface Report {
  title: string;
  createdAt: string;
  description?: string;
  /** Where the data came from and how it was gathered, shown at the bottom. */
  method?: string;
  blocks: ReportBlock[];
}

export type ReportCell = string | number | { text: string; href: string };

export type ReportBlock =
  | { type: 'markdown'; text: string }
  | { type: 'stats'; items: { label: string; value: string | number; detail?: string }[] }
  | {
      type: 'bar';
      title: string;
      description?: string;
      /** Noun for one unit of value, e.g. "tags", used in tooltips. */
      unit?: string;
      data: { label: string; value: number; detail?: string }[];
    }
  | {
      type: 'line';
      title: string;
      description?: string;
      unit?: string;
      /** One point per period; `start`/`end` are ISO dates and the point sits at the period's midpoint. */
      data: { label: string; start: string; end: string; value: number; detail?: string }[];
      /** Labelled date ranges drawn as vertical boundary lines with a label, e.g. supercycles. */
      ranges?: { label: string; start: string; end: string }[];
    }
  | { type: 'table'; title: string; columns: string[]; rows: ReportCell[][]; collapsed?: boolean };

export interface ReportSummary {
  id: string;
  title: string;
  createdAt: string;
  description?: string;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchReports = () => getJson<ReportSummary[]>('/api/reports');
export const fetchReport = (id: string) => getJson<Report>(`/api/reports/${id}`);
