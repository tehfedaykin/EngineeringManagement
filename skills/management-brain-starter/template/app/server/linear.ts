const LINEAR_API = 'https://api.linear.app/graphql';

const INITIATIVES_QUERY = `
  query {
    initiatives(first: 50, filter: { name: { startsWith: "Supercycle" } }) {
      nodes { id name url status targetDate }
    }
  }
`;

// Linear rejects a single initiatives → projects → milestones query as too complex,
// so projects are fetched separately, filtered by initiative and team.
const PROJECTS_QUERY = `
  query ($initiativeId: ID!, $teamKey: String!) {
    projects(
      first: 50
      filter: {
        initiatives: { some: { id: { eq: $initiativeId } } }
        accessibleTeams: { some: { key: { eq: $teamKey } } }
      }
    ) {
      nodes {
        id name url color startDate targetDate progress health priorityLabel
        status { name type color }
        lead { name }
        teams(first: 10) { nodes { key name } }
        projectMilestones(first: 30) { nodes { id name targetDate progress sortOrder } }
      }
    }
  }
`;

const ISSUES_WITH_PRS_QUERY = `
  query ($projectIds: [ID!]!, $after: String) {
    issues(
      first: 100
      after: $after
      filter: {
        project: { id: { in: $projectIds } }
        attachments: { sourceType: { eq: "github" } }
      }
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        identifier title url
        project { id }
        assignee { name }
        attachments(first: 10, filter: { sourceType: { eq: "github" } }) {
          nodes { url metadata }
        }
      }
    }
  }
`;

interface Initiative {
  id: string;
  name: string;
  url: string;
  status: string;
  targetDate: string | null;
}

interface RawProject {
  id: string;
  name: string;
  url: string;
  color: string;
  startDate: string | null;
  targetDate: string | null;
  progress: number;
  health: string | null;
  priorityLabel: string;
  status: { name: string; type: string; color: string };
  lead: { name: string } | null;
  teams: { nodes: { key: string; name: string }[] };
  projectMilestones: {
    nodes: { id: string; name: string; targetDate: string | null; progress: number; sortOrder: number }[];
  };
}

/** The GitHub integration's metadata on a pull request attachment (only the fields used here). */
interface GitHubPrMetadata {
  number?: number;
  title?: string;
  status?: 'draft' | 'open' | 'inReview' | 'merged' | 'closed';
  draft?: boolean;
  branch?: string;
  repoLogin?: string;
  repoName?: string;
  userLogin?: string;
  createdAt?: string;
  updatedAt?: string;
  mergedAt?: string | null;
  closedAt?: string | null;
  hasConflicts?: boolean;
  reviews?: { isBot: boolean; state: string; reviewerLogin?: string; submittedAt: string }[];
}

interface RawIssue {
  identifier: string;
  title: string;
  url: string;
  project: { id: string } | null;
  assignee: { name: string } | null;
  attachments: { nodes: { url: string; metadata: GitHubPrMetadata | null }[] };
}

export class LinearConfigError extends Error {}

async function linearRequest<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    throw new LinearConfigError(
      'LINEAR_API_KEY is not set. Add it to your shell profile or to .env.local, then restart `yarn dev`.',
    );
  }
  const res = await fetch(LINEAR_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (!res.ok || body.errors?.length || !body.data) {
    throw new Error(`Linear API error: ${body.errors?.map((e) => e.message).join('; ') ?? res.status}`);
  }
  return body.data;
}

function supercycleNumber(name: string): number {
  return Number(/(\d+)/.exec(name)?.[1] ?? 0);
}

async function fetchCurrentSupercycle(): Promise<Initiative | null> {
  const { initiatives } = await linearRequest<{ initiatives: { nodes: Initiative[] } }>(
    INITIATIVES_QUERY,
  );
  return (
    initiatives.nodes
      .filter((i) => /^Supercycle \d+$/.test(i.name))
      .sort((a, b) => supercycleNumber(b.name) - supercycleNumber(a.name))
      .find((i) => i.status === 'Active') ?? null
  );
}

async function fetchTeamProjects(initiativeId: string, teamKey: string): Promise<RawProject[]> {
  const { projects } = await linearRequest<{ projects: { nodes: RawProject[] } }>(PROJECTS_QUERY, {
    initiativeId,
    teamKey,
  });
  return projects.nodes;
}

export async function fetchSupercycle(teamKey: string) {
  const current = await fetchCurrentSupercycle();
  if (!current) return { supercycle: null, teamKey, projects: [] };
  const projects = await fetchTeamProjects(current.id, teamKey);

  return {
    supercycle: current,
    teamKey,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      url: p.url,
      color: p.color,
      startDate: p.startDate,
      targetDate: p.targetDate,
      progress: p.progress,
      health: p.health,
      priority: p.priorityLabel,
      status: p.status,
      lead: p.lead?.name ?? null,
      teams: p.teams.nodes.map((t) => t.key),
      milestones: [...p.projectMilestones.nodes]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        // Linear reports milestone progress as 0–100 but project progress as 0–1.
        .map(({ id, name, targetDate, progress }) => ({ id, name, targetDate, progress: progress / 100 })),
    })),
  };
}

/** Collapses each human reviewer's reviews to their latest state, ignoring bots and plain comments. */
function reviewDecision(reviews: GitHubPrMetadata['reviews'] = []): 'approved' | 'changesRequested' | null {
  const latestByReviewer = new Map<string, string>();
  for (const review of [...reviews].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))) {
    if (review.isBot || review.state === 'commented') continue;
    latestByReviewer.set(review.reviewerLogin ?? review.submittedAt, review.state);
  }
  const states = [...latestByReviewer.values()];
  if (states.includes('changes_requested') || states.includes('changesRequested')) return 'changesRequested';
  if (states.includes('approved')) return 'approved';
  return null;
}

export async function fetchSupercyclePrs(teamKey: string) {
  const current = await fetchCurrentSupercycle();
  if (!current) return { supercycle: null, teamKey, projects: [] };
  const projects = await fetchTeamProjects(current.id, teamKey);

  const issues: RawIssue[] = [];
  let after: string | null = null;
  do {
    const page: { issues: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: RawIssue[] } } =
      await linearRequest(ISSUES_WITH_PRS_QUERY, { projectIds: projects.map((p) => p.id), after });
    issues.push(...page.issues.nodes);
    after = page.issues.pageInfo.hasNextPage ? page.issues.pageInfo.endCursor : null;
  } while (after);

  // One PR can be linked to several issues; keep a single entry per project and list every ticket.
  const prsByProject = new Map<string, Map<string, ReturnType<typeof toPr>>>();
  function toPr(url: string, meta: GitHubPrMetadata) {
    const status = meta.status ?? (meta.draft ? 'draft' : 'open');
    return {
      url,
      number: meta.number ?? null,
      title: meta.title ?? url,
      repo: meta.repoLogin && meta.repoName ? `${meta.repoLogin}/${meta.repoName}` : null,
      branch: meta.branch ?? null,
      author: meta.userLogin || null,
      status,
      state: status === 'draft' ? 'draft' : status === 'merged' || status === 'closed' ? 'closed' : 'open',
      createdAt: meta.createdAt ?? null,
      updatedAt: meta.updatedAt ?? null,
      mergedAt: meta.mergedAt ?? null,
      closedAt: meta.closedAt ?? null,
      hasConflicts: meta.hasConflicts ?? false,
      review: reviewDecision(meta.reviews),
      tickets: [] as { identifier: string; title: string; url: string; assignee: string | null }[],
    };
  }

  for (const issue of issues) {
    if (!issue.project) continue;
    const projectPrs = prsByProject.get(issue.project.id) ?? new Map();
    prsByProject.set(issue.project.id, projectPrs);
    for (const { url, metadata } of issue.attachments.nodes) {
      // GitHub attachments also cover commits and issues; only pull requests have a number and status.
      if (!metadata?.number || !url.includes('/pull/')) continue;
      const pr = projectPrs.get(url) ?? toPr(url, metadata);
      pr.tickets.push({
        identifier: issue.identifier,
        title: issue.title,
        url: issue.url,
        assignee: issue.assignee?.name ?? null,
      });
      projectPrs.set(url, pr);
    }
  }

  return {
    supercycle: current,
    teamKey,
    projects: projects
      .map((p) => ({
        id: p.id,
        name: p.name,
        url: p.url,
        status: p.status,
        lead: p.lead?.name ?? null,
        startDate: p.startDate,
        prs: [...(prsByProject.get(p.id)?.values() ?? [])].sort((a, b) =>
          (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
        ),
      }))
      .sort((a, b) => (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999') || a.name.localeCompare(b.name)),
  };
}
