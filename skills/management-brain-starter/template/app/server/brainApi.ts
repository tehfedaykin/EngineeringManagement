import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { LinearConfigError, fetchSupercycle, fetchSupercyclePrs } from './linear';
import { getNotionRefreshStatus, startNotionRefresh } from './notionRefresh';

const RECORDS_DIR =
  process.env.DEBRIEF_RECORDS_DIR ??
  path.join(os.homedir(), '.claude/skills/daily-debrief/records');
const BRIEFS_DIR = path.join(RECORDS_DIR, 'briefs');
const LEDGER_FILE = path.join(RECORDS_DIR, 'ledger.json');
const MATRIX_FILE = path.resolve('data/matrix.json');
// Written by Claude from Notion's notification emails (via Superhuman) plus the Notion connector for gaps and page URLs.
// Neither has an endpoint the app could call itself.
const NOTION_NOTIFICATIONS_FILE = path.resolve('data/notion-notifications.json');
const TEAM_FILE = path.resolve('data/team.json');
const REPORTS_DIR =path.resolve(process.env.REPORTS_DIR ?? 'data/reports');

const ACTIVE_STATUSES = new Set(['proposed', 'open', 'blocked', 'unclear']);
const BRIEF_FILE = /^(\d{4}-\d{2}-\d{2})\.md$/;

interface LedgerEntry {
  id: string;
  statement: string;
  owner?: string;
  due?: string | null;
  status: string;
  source?: string;
  firstSeen?: string;
  lastEvidence?: { date?: string };
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

async function listBriefs() {
  const files = await fs.readdir(BRIEFS_DIR).catch(() => []);
  const briefs = await Promise.all(
    files
      .map((file) => BRIEF_FILE.exec(file)?.[1])
      .filter((date): date is string => Boolean(date))
      .map(async (date) => {
        const text = await fs.readFile(path.join(BRIEFS_DIR, `${date}.md`), 'utf8');
        const heading = /^#{1,3}\s+(.+)$/m.exec(text)?.[1] ?? `Debrief ${date}`;
        return { date, title: heading };
      }),
  );
  return briefs.sort((a, b) => b.date.localeCompare(a.date));
}

interface ReportSummary {
  id: string;
  title: string;
  createdAt: string;
  description?: string;
}

async function listReports(): Promise<ReportSummary[]> {
  const files = await fs.readdir(REPORTS_DIR).catch(() => []);
  const reports = await Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .map(async (file): Promise<ReportSummary | null> => {
        const report = await readJson<Partial<ReportSummary> | null>(path.join(REPORTS_DIR, file), null);
        if (!report?.title || !report.createdAt) return null;
        return {
          id: file.replace(/\.json$/, ''),
          title: report.title,
          createdAt: report.createdAt,
          description: report.description,
        };
      }),
  );
  return reports
    .filter((report): report is ReportSummary => report !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/api/briefs' && req.method === 'GET') {
    return sendJson(res, 200, await listBriefs());
  }

  const briefMatch = /^\/api\/briefs\/(\d{4}-\d{2}-\d{2})$/.exec(url.pathname);
  if (briefMatch && req.method === 'GET') {
    try {
      const markdown = await fs.readFile(path.join(BRIEFS_DIR, `${briefMatch[1]}.md`), 'utf8');
      return sendJson(res, 200, { date: briefMatch[1], markdown });
    } catch {
      return sendJson(res, 404, { error: 'Brief not found' });
    }
  }

  if (url.pathname === '/api/commitments' && req.method === 'GET') {
    const ledger = await readJson<LedgerEntry[]>(LEDGER_FILE, []);
    const commitments = ledger
      .filter((entry) => ACTIVE_STATUSES.has(entry.status) || entry.status === 'completed')
      .filter((entry) => !entry.owner || entry.owner === '%%OWNER_FIRST%%')
      .map(({ id, statement, due, status, source, firstSeen, lastEvidence }) => ({
        id,
        statement,
        due: due ?? null,
        status,
        source: source ?? null,
        firstSeen: firstSeen ?? null,
        completedAt: status === 'completed' ? (lastEvidence?.date ?? null) : null,
      }));
    return sendJson(res, 200, commitments);
  }

  if (url.pathname === '/api/notion-notifications' && req.method === 'GET') {
    const snapshot = await readJson<unknown>(NOTION_NOTIFICATIONS_FILE, null);
    return snapshot ? sendJson(res, 200, snapshot) : sendJson(res, 404, { error: 'No Notion snapshot yet' });
  }

  if (url.pathname === '/api/notion-notifications/refresh') {
    if (req.method === 'GET') return sendJson(res, 200, getNotionRefreshStatus());
    // A custom header forces a CORS preflight, so other sites open in the browser can't start a refresh.
    if (req.method === 'POST' && req.headers['x-brain-refresh'] === '1') {
      return sendJson(res, 202, await startNotionRefresh());
    }
  }

  if (url.pathname === '/api/team' && req.method === 'GET') {
    const team = await readJson<{ id: string; name: string }[]>(TEAM_FILE, []);
    return sendJson(res, 200, [...team].sort((a, b) => a.name.localeCompare(b.name)));
  }

  const teamMatch = /^\/api\/team\/([a-z0-9-]+)$/.exec(url.pathname);
  if (teamMatch) {
    const team = await readJson<{ id: string }[]>(TEAM_FILE, []);
    const index = team.findIndex((member) => member.id === teamMatch[1]);
    if (index === -1) return sendJson(res, 404, { error: 'Team member not found' });
    if (req.method === 'GET') return sendJson(res, 200, team[index]);
    if (req.method === 'PUT') {
      const member = JSON.parse(await readBody(req)) as { id: string };
      if (member.id !== teamMatch[1]) return sendJson(res, 400, { error: 'id mismatch' });
      team[index] = member;
      await fs.writeFile(TEAM_FILE, JSON.stringify(team, null, 2));
      return sendJson(res, 200, { ok: true });
    }
  }

  if (url.pathname === '/api/reports' && req.method === 'GET') {
    return sendJson(res, 200, await listReports());
  }

  const reportMatch = /^\/api\/reports\/([a-z0-9-]+)$/.exec(url.pathname);
  if (reportMatch && req.method === 'GET') {
    const report = await readJson<unknown>(path.join(REPORTS_DIR, `${reportMatch[1]}.json`), null);
    return report ? sendJson(res, 200, report) : sendJson(res, 404, { error: 'Report not found' });
  }

  const linearRoutes: Record<string, (teamKey: string) => Promise<unknown>> = {
    '/api/supercycle': fetchSupercycle,
    '/api/supercycle/prs': fetchSupercyclePrs,
  };
  const linearRoute = linearRoutes[url.pathname];
  if (linearRoute && req.method === 'GET') {
    try {
      return sendJson(res, 200, await linearRoute(process.env.LINEAR_TEAM_KEY ?? '%%LINEAR_TEAM_KEY%%'));
    } catch (error) {
      if (error instanceof LinearConfigError) return sendJson(res, 503, { error: error.message });
      throw error;
    }
  }

  if (url.pathname === '/api/matrix') {
    if (req.method === 'GET') {
      return sendJson(res, 200, await readJson(MATRIX_FILE, { placements: {}, customItems: [], completed: {}, reopened: [] }));
    }
    if (req.method === 'PUT') {
      const body = await readBody(req);
      JSON.parse(body);
      await fs.mkdir(path.dirname(MATRIX_FILE), { recursive: true });
      await fs.writeFile(MATRIX_FILE, body);
      return sendJson(res, 200, { ok: true });
    }
  }

  return sendJson(res, 404, { error: 'Not found' });
}

/** Serves the debrief records and matrix state from local disk during `vite dev`. */
export function brainApi(): Plugin {
  return {
    name: 'brain-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        handle(req, res).catch((error: unknown) =>
          sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) }),
        );
      });
    },
  };
}
