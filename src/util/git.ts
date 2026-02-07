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
