import { Command } from 'commander';
import { hasRemote } from '../util/git.js';
import { pullAction } from './pull.js';
import { applyAction } from './apply.js';
import { info, warn } from '../util/log.js';

export function registerSync(program: Command): void {
  program
    .command('sync')
    .description('Pull latest config from remote, then apply to ~/.claude.json')
    .option('--dry-run', 'Preview changes without writing')
    .action(async (opts: { dryRun?: boolean }) => {
      // 1. Pull from remote if configured
      if (await hasRemote()) {
        await pullAction();
      } else {
        warn('No remote configured — skipping pull.');
      }

      // 2. Apply resolved config
      info('');
      await applyAction({ dryRun: opts.dryRun });
    });
}
