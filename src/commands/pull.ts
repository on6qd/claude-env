import { Command } from 'commander';
import { git, hasRemote } from '../util/git.js';
import { success, warn, die } from '../util/log.js';

export async function pullAction(): Promise<void> {
  if (!(await hasRemote())) {
    die('No remote configured. Run: git -C ~/.claude remote add origin <url>');
  }

  try {
    await git('pull', '--rebase', '--autostash');
    success('Pulled and rebased successfully');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('CONFLICT') || msg.includes('rebase')) {
      warn('Rebase conflict detected. Aborting rebase.');
      try {
        await git('rebase', '--abort');
      } catch {
        // Already aborted or not in rebase
      }
      die(
        'Merge conflict during pull. Resolve manually:\n' +
          '  cd ~/.claude\n' +
          '  git pull --rebase\n' +
          '  # resolve conflicts\n' +
          '  git rebase --continue',
      );
    }
    die(`Pull failed: ${msg}`);
  }
}

export function registerPull(program: Command): void {
  program
    .command('pull')
    .description('Pull latest config from remote (rebase)')
    .action(pullAction);
}
