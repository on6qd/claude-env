import { Command } from 'commander';
import { applyAction } from './apply.js';

export function registerStatus(program: Command): void {
  program
    .command('status')
    .description('Show resolved config for current platform (delegates to apply --dry-run)')
    .action(async () => {
      await applyAction({ dryRun: true });
    });
}
