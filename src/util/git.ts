import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { CLAUDE_DIR } from './paths.js';

const execFile = promisify(execFileCb);

export interface GitResult {
  stdout: string;
  stderr: string;
}

export async function git(...args: string[]): Promise<GitResult> {
  const { stdout, stderr } = await execFile('git', args, {
    cwd: CLAUDE_DIR,
    env: { ...process.env },
  });
  return { stdout: stdout.trimEnd(), stderr: stderr.trimEnd() };
}

export async function isGitRepo(): Promise<boolean> {
  try {
    await git('rev-parse', '--is-inside-work-tree');
    return true;
  } catch {
    return false;
  }
}

export async function hasRemote(): Promise<boolean> {
  try {
    const { stdout } = await git('remote');
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export async function isClean(): Promise<boolean> {
  const { stdout } = await git('status', '--porcelain');
  return stdout.trim().length === 0;
}

export async function getRemoteUrl(name = 'origin'): Promise<string | null> {
  try {
    const { stdout } = await git('remote', 'get-url', name);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/** Convert an HTTPS git URL to SSH format. Returns null if not HTTPS. */
export function httpsToSsh(url: string): string | null {
  const m = url.match(/^https?:\/\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return `git@${m[1]}:${m[2]}`;
}

/**
 * If origin is an HTTPS URL, switch it to SSH.
 * Returns the new URL if converted, null if already SSH or no remote.
 */
export async function ensureSshRemote(name = 'origin'): Promise<string | null> {
  const url = await getRemoteUrl(name);
  if (!url) return null;
  const sshUrl = httpsToSsh(url);
  if (!sshUrl) return null; // already SSH or unknown format
  await git('remote', 'set-url', name, sshUrl);
  return sshUrl;
}
