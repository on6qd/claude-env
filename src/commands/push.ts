import { Command } from 'commander';
import { git, isClean, hasRemote } from '../util/git.js';
import { info, success, die } from '../util/log.js';

export function registerPush(program: Command): void {
  program
    .command('push [message]')
    .description('Stage, commit, and push config changes')
    .action(async (message?: string) => {
      if (!(await hasRemote())) {
        die('No remote configured. Run: git -C ~/.claude remote add origin <url>');
      }

      await git('add', '-A');

      if (await isClean()) {
        info('Nothing to commit, working tree clean');
        return;
      }

      const commitMsg = message ?? 'claude-env sync';
      await git('commit', '-m', commitMsg);
      success(`Committed: ${commitMsg}`);

      try {
        await git('push', '-u', 'origin', 'HEAD');
        success('Pushed to remote');
      } catch (e) {
        die(`Push failed: ${e instanceof Error ? e.message : e}`);
      }
    });
}
