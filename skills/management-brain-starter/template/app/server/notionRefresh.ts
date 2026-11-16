import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CLAUDE_BIN = process.env.CLAUDE_BIN ?? path.join(os.homedir(), '.local/bin/claude');
const TIMEOUT_MS = 15 * 60 * 1000;
const SNAPSHOT_FILE = path.resolve('data/notion-notifications.json');

export interface NotionRefreshStatus {
  state: 'idle' | 'running' | 'done' | 'error';
  startedAt: string | null;
  finishedAt: string | null;
  summary: string | null;
}

let status: NotionRefreshStatus = { state: 'idle', startedAt: null, finishedAt: null, summary: null };

export function getNotionRefreshStatus(): NotionRefreshStatus {
  return status;
}

async function readFetchedAt(): Promise<string | null> {
  try {
    const snapshot = JSON.parse(await fs.readFile(SNAPSHOT_FILE, 'utf8')) as { fetchedAt?: string };
    return snapshot.fetchedAt ?? null;
  } catch {
    return null;
  }
}

function finish(state: 'done' | 'error', summary: string) {
  status = { ...status, state, finishedAt: new Date().toISOString(), summary };
}

/**
 * Runs the refresh-notion-inbox skill in a headless Claude session. The tool allowlist is what keeps it
 * read-only on the mailbox: only Superhuman's list/get tools are allowed, so it can't mark mail read or reply.
 */
export async function startNotionRefresh(): Promise<NotionRefreshStatus> {
  if (status.state === 'running') return status;

  // realpath because macOS's tmpdir is under the /var -> /private/var symlink, and permission rules match real paths.
  const scratch = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'notion-refresh-')));
  const previousFetchedAt = await readFetchedAt();
  status = { state: 'running', startedAt: new Date().toISOString(), finishedAt: null, summary: null };

  const allowedTools = [
    'Skill',
    'ToolSearch',
    'Read',
    // Edit rules also govern the Write tool. A leading "//" makes the rule an absolute path.
    `Edit(/${scratch}/**)`,
    'Bash(python3 -I *)',
    'Bash(jq *)',
    'Bash(date *)',
    'mcp__claude_ai_Superhuman_Mail__list_threads',
    'mcp__claude_ai_Superhuman_Mail__get_thread',
    'mcp__claude_ai_Notion__notion-search',
  ];
  const prompt =
    `Run the refresh-notion-inbox skill. Put scratch files in ${scratch}. ` +
    'Do the work yourself without subagents. End with only the one-line summary from the skill.';

  const child = spawn(
    CLAUDE_BIN,
    ['-p', prompt, '--output-format', 'json', '--allowedTools', allowedTools.join(',')],
    { cwd: path.resolve('.'), stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
  child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));

  const timer = setTimeout(() => child.kill('SIGTERM'), TIMEOUT_MS);

  child.on('error', (error) => {
    clearTimeout(timer);
    finish('error', `Couldn't start Claude at ${CLAUDE_BIN}: ${error.message}`);
  });

  child.on('close', async (code, signal) => {
    clearTimeout(timer);
    void fs.rm(scratch, { recursive: true, force: true });
    if (signal) return finish('error', `Refresh stopped after ${TIMEOUT_MS / 60000} minutes.`);
    let result: { is_error?: boolean; result?: string };
    try {
      result = JSON.parse(stdout) as typeof result;
    } catch {
      return finish('error', (stderr || stdout).trim().slice(-500) || `Claude exited with code ${code}.`);
    }
    const summary = result.result?.trim() || 'Refresh finished.';
    // Claude can finish "successfully" after being blocked from writing, so trust the file, not the exit status.
    const updated = (await readFetchedAt()) !== previousFetchedAt;
    finish(result.is_error || code !== 0 || !updated ? 'error' : 'done', updated ? summary : `Snapshot not updated. ${summary}`);
  });

  return status;
}
