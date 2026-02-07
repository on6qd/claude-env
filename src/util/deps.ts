import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { die } from './log.js';

const execFile = promisify(execFileCb);

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execFile('which', [cmd]);
    return true;
  } catch {
    return false;
  }
}

export function installHint(binary: string): string {
  const p = process.platform;
  switch (binary) {
    case 'git':
      if (p === 'darwin') return 'Install with: brew install git  (or: xcode-select --install)';
      if (p === 'linux') return 'Install with: sudo apt install git  (or: sudo dnf install git)';
      return 'Download from https://git-scm.com';
    case 'sops':
      if (p === 'darwin') return 'Install with: brew install sops';
      return 'Download from https://github.com/getsops/sops/releases';
    case 'age':
      if (p === 'darwin') return 'Install with: brew install age';
      if (p === 'linux') return 'Install with: sudo apt install age  (or download from https://github.com/FiloSottile/age/releases)';
      return 'Download from https://github.com/FiloSottile/age/releases';
    default:
      return `Install ${binary} and ensure it is on your PATH`;
  }
}

export async function requireGit(): Promise<void> {
  if (!(await commandExists('git'))) {
    die(`git is not installed.\n  ${installHint('git')}`);
  }
}
